"""netcad_ncz okuyucu testleri.

fixtures/ornek_100.ncz: depodaki aplikasyon aracının NCZ yazıcısıyla, uydurma
örnek veriden (100 ada, 3 parsel, 8 köşe) üretilmiştir; kurum verisi içermez.
"""
import json
import struct
from pathlib import Path

import netcad_ncz as ncz
import pytest

FIX = Path(__file__).parent / 'fixtures' / 'ornek_100.ncz'


def shoelace(pts):
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:]))) / 2


@pytest.fixture(scope='module')
def r():
    return ncz.read(FIX)


def test_blok_zinciri_tam(r):
    assert r['broken'] == []
    assert r['bytes'] == FIX.stat().st_size


def test_katmanlar(r):
    assert r['layers'] == ['0', 'PARSEL', 'NOKTA']


def test_parseller_ve_alanlar(r):
    parseller = {f['label']: f for f in r['feats'] if f['layer'] == 'PARSEL' and f['type'] == 7}
    assert sorted(parseller) == ['100/1', '100/2', '100/3']
    for f in parseller.values():
        assert f['pts'][0] == f['pts'][-1]
        assert shoelace(f['pts']) == pytest.approx(150.0)


def test_noktalar(r):
    noktalar = {f['label']: f['pts'][0] for f in r['feats'] if f['layer'] == 'NOKTA' and f['type'] == 1}
    assert sorted(noktalar) == [f'K{i}' for i in range(1, 9)]
    assert noktalar['K1'] == (1000.0, 2015.0)          # (Y doğu, X kuzey)


def test_geojson(r):
    gj = ncz.to_geojson(r)
    tipler = [f['geometry']['type'] for f in gj['features']]
    assert tipler.count('Polygon') == 3
    assert tipler.count('Point') >= 8
    json.dumps(gj)                                     # JSON'a yazılabilir olmalı


def test_komut_satiri(tmp_path, capsys):
    out = tmp_path / 'c.geojson'
    assert ncz.main([str(FIX), '--geojson', str(out)]) == 0
    assert 'PARSEL' in capsys.readouterr().out
    assert len(json.loads(out.read_text(encoding='utf-8'))['features']) >= 11


def _blok(kind, govde):
    return bytes([kind]) + struct.pack('<I', len(govde)) + govde


def _katman_tablosu(adlar):
    g = bytearray(11) + struct.pack('<H', len(adlar))   # adet @+16 (5 baytlık blok başı + 11)
    for ad in adlar:
        b = ad.encode('cp1254')
        r = bytearray(29)
        r[4] = len(b)
        r[5:5 + len(b)] = b
        g += r
    return _blok(6, bytes(g))


def _nesne(tip, katman, x, y, etiket='', koseler=()):
    g = bytearray(108)                                   # gövde: blok başından +5
    g[1], g[2] = tip, katman                             # tip @+6, katman @+7
    g[3:19] = struct.pack('<dd', x, y)                   # X @+8, Y @+16
    e = etiket.encode('cp1254')
    g[81] = len(e)                                       # etiket uzunluğu @+86
    g[82:82 + len(e)] = e
    for kx, ky in koseler:                               # köşeler @+113
        g += struct.pack('<ddd', kx, ky, 0.0)
    return _blok(21, bytes(g))


def test_elle_kurulan_dosya(tmp_path):
    kare = [(0, 0), (0, 10), (10, 10), (10, 0), (0, 0)]  # (X kuzey, Y doğu)
    veri = (_blok(1, bytes(90)) + _katman_tablosu(['0', 'YAPI', 'Şev'])
            + _nesne(7, 1, 0, 0, 'B1', kare) + _nesne(1, 2, 5.0, 7.0, 'N1'))
    p = tmp_path / 'elle.ncz'
    p.write_bytes(veri)
    r = ncz.read(p)
    assert r['broken'] == [] and r['layers'] == ['0', 'YAPI', 'Şev']
    poli, nokta = [f for f in r['feats']]
    assert (poli['layer'], poli['label'], len(poli['pts'])) == ('YAPI', 'B1', 5)
    assert shoelace(poli['pts']) == pytest.approx(100.0)
    assert (nokta['layer'], nokta['label'], nokta['pts']) == ('Şev', 'N1', [(7.0, 5.0)])
