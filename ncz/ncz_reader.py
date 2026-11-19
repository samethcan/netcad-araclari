"""Netcad NCZ okuyucu (8.x düzeni, tersine mühendislik bilgisiyle).

Blok düzeni: [kind u8][len u32 LE][payload], blok toplamı = len + 5.
Geometri blokları: kind 21 (düz) / 22 (GIS nesnesi, +28 kayma).
Kayıt içinde (blok başına göre): tip +6, katman kodu +7, ilk koordinat +8/+16 (X kuzey, Y doğu).
Tip 7 (çoklu çizgi/poligon): köşeler +113(+kayma)'dan, her biri 24 bayt (f64 X, f64 Y, f64 Z).
Tip 1 (nokta): ad uzunluğu +86, ad +87.
Tip 5 (yazı): yükseklik f32 +86, dönüklük f32 +90, metin uzunluğu +97, metin +98 (cp1254).
Tip 7 etiket: uzunluk +86, metin +87 (kayıt içinde en çok 10 karakter; daha uzun ad bir önceki kind 33 bloğunda tam olarak durur); bayrak i32 +101 (1 kapalı, 2 dolgu, 16 adlı).
Tip 15 (akıllı nesne): len alanı 81 B eksik — blocks() düzeltir. Katman için +7 kullan (her sürümde güvenilir).
Katman tablosu: kind 6, adet u16 @+16, 29 baytlık kayıtlar @+18 (ad uzunluğu r[4], ad r[5:]).
Çıktı koordinatları: (Y doğu, X kuzey) — Netcad ekranındaki sağa/yukarı.
"""
import struct
from collections import Counter


def u32(b, o):
    return int.from_bytes(b[o:o + 4], 'little')


KNOWN_KINDS = {1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31, 33}


def _ok_next(b, q):
    """q konumunda geçerli bir blok başlığı var mı (ya da dosya sonu mu)?"""
    if q == len(b):
        return True
    return q + 5 <= len(b) and b[q] in KNOWN_KINDS and q + u32(b, q + 1) + 5 <= len(b)


def blocks(b):
    """Blok yürüyüşü. Tip 15 (akıllı nesne) kayıtlarında len alanı gövdeden sonra gelen
    81 baytlık başlığı saymaz (8.5.1 gerçek dosyada doğrulandı); sonraki başlık geçerli
    değilse +81 denenir."""
    out, p = [], 0
    while p + 5 <= len(b):
        n = u32(b, p + 1) + 5
        if b[p] in (21, 22) and p + 7 <= len(b) and b[p + 6] == 15 and not _ok_next(b, p + n) and _ok_next(b, p + n + 81):
            n += 81
        if n < 5 or p + n > len(b):
            out.append((p, None, len(b) - p))
            break
        out.append((p, b[p], n))
        p += n
    return out


def _s(b, o, maxlen=255):
    L = b[o]
    if L > maxlen or o + 1 + L > len(b):
        return None
    return b[o + 1:o + 1 + L].decode('cp1254', 'replace')


def layer_names(b, bl):
    for o, k, n in bl:
        if k == 6:
            cnt = int.from_bytes(b[o + 16:o + 18], 'little')
            names = []
            for i in range(cnt):
                r = b[o + 18 + i * 29:o + 18 + (i + 1) * 29]
                if len(r) < 29:
                    break
                names.append(r[5:5 + r[4]].decode('cp1254', 'replace'))
            return names
    return []


def read(path):
    b = open(path, 'rb').read()
    bl = blocks(b)
    names = layer_names(b, bl)
    feats, kinds, broken = [], Counter(), [x for x in bl if x[1] is None]
    ext = None   # kind 33: sonraki nesnenin tam adı (nokta/alan) ya da yazı devamı
    for o, k, n in bl:
        kinds[k] += 1
        if k == 33:
            ext = _s(b, o + 11)
            continue
        if k not in (21, 22) or n < 30:
            ext = None if k not in (21, 22) else ext
            continue
        sh = 0 if k == 21 else 28
        t, lc = b[o + 6], b[o + 7]
        f = {'off': o, 'kind': k, 'type': t, 'lcode': lc,
             'layer': names[lc] if lc < len(names) else f'#{lc}'}
        try:
            if t == 7:
                cnt = (n - 113 - sh) // 24
                v = [struct.unpack_from('<dd', b, o + 113 + sh + 24 * i) for i in range(cnt)]
                f['pts'] = [(y, x) for x, y in v]
                f['label'] = _s(b, o + 86 + sh, 30)
            elif t == 1:
                x, y = struct.unpack_from('<dd', b, o + 8)
                f['pts'] = [(y, x)]
                f['label'] = _s(b, o + 86 + sh, 40)
            elif t == 5:
                x, y = struct.unpack_from('<dd', b, o + 8)
                f['pts'] = [(y, x)]
                f['h'], f['rot'] = struct.unpack_from('<ff', b, o + 86 + sh)
                f['text'] = _s(b, o + 97 + sh)
            else:
                x, y = struct.unpack_from('<dd', b, o + 8)
                f['pts'] = [(y, x)]
        except struct.error:
            f['err'] = True
        if ext:
            if t in (1, 7) and f.get('label') and ext.startswith(f['label']):
                f['label'] = ext          # kayıt içi ad 10 karakterde kesilir; tam ad kind 33'te
            elif t == 5 and f.get('text') is not None:
                f['text'] = f['text'] + ext   # yazı kaydı 50 karakterde biter; devamı kind 33'te
            ext = None
        feats.append(f)
    return {'bytes': len(b), 'blocks': len(bl), 'broken': broken, 'kinds': kinds,
            'layers': names, 'feats': feats}


def summary(r):
    c = Counter((f['layer'], f['type'], f['kind']) for f in r['feats'])
    lines = [f"{r['bytes']} bayt, {r['blocks']} blok, kırık: {len(r['broken'])}",
             'katmanlar: ' + ', '.join(r['layers'])]
    for (lay, t, k), m in sorted(c.items(), key=lambda z: (-z[1])):
        lines.append(f'  {lay:<20} tip={t:<3} kind={k} adet={m}')
    return '\n'.join(lines)


def to_geojson(r):
    """read() sonucunu GeoJSON FeatureCollection'a çevirir.

    Koordinatlar dosyadaki projeksiyonda kalır (dönüşüm yapılmaz), sıra (Y doğu, X kuzey).
    Tip 7: ilk ve son köşe aynıysa Polygon, değilse LineString. Diğer tipler: Point.
    """
    feats = []
    for f in r['feats']:
        pts = f.get('pts')
        if not pts or f.get('err'):
            continue
        props = {'katman': f['layer'], 'tip': f['type']}
        if f.get('label'):
            props['ad'] = f['label']
        if f.get('text') is not None:
            props.update(yazi=f['text'], yukseklik=f.get('h'), donukluk=f.get('rot'))
        if f['type'] == 7 and len(pts) >= 2:
            if len(pts) >= 4 and pts[0] == pts[-1]:
                geom = {'type': 'Polygon', 'coordinates': [[list(q) for q in pts]]}
            else:
                geom = {'type': 'LineString', 'coordinates': [list(q) for q in pts]}
        else:
            geom = {'type': 'Point', 'coordinates': list(pts[0])}
        feats.append({'type': 'Feature', 'geometry': geom, 'properties': props})
    return {'type': 'FeatureCollection', 'features': feats}


def main(argv=None):
    """Komut satırı: ncz-oku dosya.ncz [dosya2.ncz ...] [--geojson cikti.geojson]"""
    import argparse
    import json
    ap = argparse.ArgumentParser(prog='ncz-oku', description='Netcad NCZ dosyasının özetini yazar, isteğe bağlı GeoJSON üretir.')
    ap.add_argument('dosya', nargs='+', help='.ncz dosya(lar)ı')
    ap.add_argument('--geojson', metavar='CIKTI', help='tek dosya için GeoJSON çıktı yolu')
    a = ap.parse_args(argv)
    if a.geojson and len(a.dosya) != 1:
        ap.error('--geojson yalnızca tek dosyayla kullanılabilir')
    for p in a.dosya:
        r = read(p)
        print(p)
        print(summary(r))
        if a.geojson:
            with open(a.geojson, 'w', encoding='utf-8') as fh:
                json.dump(to_geojson(r), fh, ensure_ascii=False)
            print(f'GeoJSON yazıldı: {a.geojson}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
