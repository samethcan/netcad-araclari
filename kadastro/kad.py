"""Kadastro pafta çizgilerinden pafta yüzleri: düğümleme + 10 m'ye kadar uç boşluklarını kapatma + yazı ataması.

Kullanım: python kad.py pafta_cizgileri.ncz
Gerekli: shapely >= 2.0
"""
import os, sys, struct
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ncz'))
import ncz_reader as R
from collections import Counter, defaultdict
from shapely import STRtree, polygonize_full
from shapely import unary_union as _uu
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points

def faces(path, gap=10.0):
    b = open(path, 'rb').read(); r = R.read(path); F = r['feats']
    lines = []
    for f in F:
        if f['type'] == 7 and len(f['pts']) >= 2: lines.append(LineString(f['pts']))
        elif f['type'] == 2:
            o = f['off']; X1, Y1 = struct.unpack_from('<dd', b, o + 8); X2, Y2 = struct.unpack_from('<dd', b, o + 86)
            lines.append(LineString([(Y1, X1), (Y2, X2)]))
    texts = {}
    for f in F:
        if f['type'] == 5 and f['text'].strip():
            texts[(f['text'].strip(), round(f['pts'][0][0], 1), round(f['pts'][0][1], 1))] = Point(f['pts'][0])
    T = [(k[0], p) for k, p in texts.items()]
    # snap-rounding ile düğümleme (0.05 m ızgara): birbirine değen ama ortak noktası olmayan çizgiler de düğümlenir
    U = _uu(lines, grid_size=0.05)
    pieces = list(U.geoms); tr = STRtree(pieces)
    deg = Counter()
    for g in pieces:
        deg[tuple(g.coords[0])] += 1; deg[tuple(g.coords[-1])] += 1
    free = [pt for pt, n in deg.items() if n == 1]          # serbest uçlar
    add = []
    for pt in free:
        e = Point(pt); best = None
        for i in tr.query(e.buffer(gap)):
            g = pieces[i]
            if pt in (tuple(g.coords[0]), tuple(g.coords[-1])): continue   # ucun kendi çizgisi
            dist = g.distance(e)
            if dist <= gap and (best is None or dist < best[0]): best = (dist, nearest_points(e, g)[1])
        if best: add.append(LineString([e, best[1]]))
    U2 = _uu(list(U.geoms) + add, grid_size=0.05)
    polys, cuts, dangles2, _ = polygonize_full(list(U2.geoms))
    P = list(polys.geoms); t2 = STRtree(P); ins = defaultdict(list); orphan = []; pending = []
    for t, p in T:
        h = [i for i in t2.query(p) if P[i].contains(p)]
        if not h: pending.append((t, p))
        for i in h: ins[i].append(t)
    # tam sınır üstündeki yazı: sınırına değdiği alanlardan yazısı olmayana verilir
    for t, p in pending:
        h = [i for i in t2.query(p.buffer(0.5)) if P[i].distance(p) <= 0.5]
        empty = [i for i in h if not ins[i]]
        if len(empty) == 1: ins[empty[0]].append(t)
        else: orphan.append(t)
    out = [{'geom': P[i], 'nolar': sorted(set(ins[i]), key=lambda s: (len(s), s))} for i in range(len(P))]
    return out, {'cizgi': len(lines), 'yazi': len(T), 'kapatilan_bosluk': len(add), 'kalan_dangle': len(dangles2.geoms), 'yuz_disi_yazi': orphan}

if __name__ == '__main__':
    K, st = faces(sys.argv[1])
    print(st)
    print('yüz', len(K), 'yüz başına numara', dict(sorted(Counter(len(k['nolar']) for k in K).items())))
