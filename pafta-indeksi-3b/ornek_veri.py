"""Tamamen uydurma örnek veri paketi üretir (gerçek hiçbir parsel/pafta içermez).

Kullanım: python ornek_veri.py ornek.b64
Sonra:    python build.py --veri ornek.b64 --maplibre <maplibre-gl/dist>
Gerekli: shapely >= 2.0
"""
import base64
import gzip
import json
import sys

from shapely.geometry import box

OY, OX = 500000.0, 4300000.0        # uydurma başlangıç (TM27)
FR_W = [40.0, 10.0, 2.5, 0.7]


def enc(coords, closed=True):
    pts = list(coords)
    if closed and len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    out, py, px = [], 0, 0
    for y, x in pts:
        iy, ix = round((y - OY) * 100), round((x - OX) * 100)
        out += [iy - py, ix - px]; py, px = iy, ix
    return out


def frames(g):
    out = []
    for w in FR_W:
        inner = g.buffer(-w, join_style=2)
        rings = [enc(g.exterior.coords)]
        if not inner.is_empty:
            rings.append(enc(inner.exterior.coords))
        out.append(rings)
    return out


def sheets(geoms, names):
    return [{'n': n, 'r': enc(g.exterior.coords), 'f': frames(g), 't': 0} for g, n in zip(geoms, names)]


# Yersel benzeri 2x2, ITRF benzeri 3x2 paftalar (adlar uydurma)
Y = [box(OY + i * 1000, OX + j * 750, OY + (i + 1) * 1000, OX + (j + 1) * 750) for j in range(2) for i in range(2)]
YN = ['01A1A', '01A1B', '01A1D', '01A1C']
I = [box(OY + 150 + i * 650, OX + 100 + j * 650, OY + 150 + (i + 1) * 650, OX + 100 + (j + 1) * 650) for j in range(2) for i in range(3)]
IN = ['ORNEK01', 'ORNEK02', 'ORNEK03', 'ORNEK04', 'ORNEK05', 'ORNEK06']
K = [box(OY, OX, OY + 1000, OX + 1500), box(OY + 1000, OX, OY + 2000, OX + 1500)]
KN = [['1'], ['2']]
M = [box(OY, OX, OY + 1200, OX + 1500), box(OY + 1200, OX, OY + 2000, OX + 1500)]
MN = ['ÖRNEK MAH.', 'DENEME MAH.']

# Parseller: 50 m blokluk ızgara, 10 m yollarla
P, LAB = [], []
for bj in range(12):
    for bi in range(16):
        ada = 100 + bj * 16 + bi
        x0, y0 = OX + 100 + bj * 110, OY + 100 + bi * 110
        k = 1
        for pj in range(2):
            for pi in range(2):
                P.append(box(y0 + pi * 50, x0 + pj * 50, y0 + (pi + 1) * 50, x0 + (pj + 1) * 50)); LAB.append(f'{ada}/{k}'); k += 1


def over(g, L):
    res = []
    for j, s in enumerate(L):
        a = g.intersection(s).area
        if a >= 1 or a / g.area >= 0.01:
            res.append([j, round(a, 2)])
    return sorted(res, key=lambda z: -z[1])


G = []
for i, (g, k) in enumerate(zip(P, LAB)):
    m = [MN[j] for j, mm in enumerate(M) if g.intersection(mm).area / g.area > 0.05]
    e = {'k': k, 'm': ' / '.join(m), 'a': round(g.area, 2), 'p': [i], 'y': over(g, Y), 'i': over(g, I), 'c': 1}
    e['kd'] = over(g, K); e['kc'] = 100.0
    G.append(e)

data = {
    'o': [OY, OX], 'sy': sheets(Y, YN), 'si': sheets(I, IN), 'fw': FR_W,
    'kf': [{'n': n, 'r': enc(g.exterior.coords)} for g, n in zip(K, KN)],
    'kl': [enc(g.exterior.coords, closed=False) for g in K],
    'kt': [[n[0], round((g.centroid.x - OY) * 100), round((g.centroid.y - OX) * 100)] for g, n in zip(K, KN)],
    'mh': [{'n': n, 'r': [enc(g.exterior.coords)], 'c': [round((g.centroid.x - OY) * 100), round((g.centroid.y - OX) * 100)]} for g, n in zip(M, MN)],
    'pg': [enc(g.exterior.coords) for g in P],
    'pl': [v for g in P for c in [g.representative_point()] for v in (round((c.x - OY) * 100), round((c.y - OX) * 100))],
    'g': G,
    'meta': {'kaynak': 'uydurma örnek veri', 'tarih': '-', 'parsel': len(P), 'yersel': len(Y), 'itrf': len(I), 'kadastro': len(K), 'crs': 'TUREF / TM27 (EPSG:5253)'},
}
raw = json.dumps(data, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
with open(sys.argv[1] if len(sys.argv) > 1 else 'ornek.b64', 'w') as fh:
    fh.write(base64.b64encode(gzip.compress(raw, 9, mtime=0)).decode())
print(f'{len(P)} uydurma parsel yazıldı')
