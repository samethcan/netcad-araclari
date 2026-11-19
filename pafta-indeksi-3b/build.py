"""Parçaları tek bir index.html dosyasında birleştirir.

Kullanım:
  python build.py --veri veri.b64 --maplibre node_modules/maplibre-gl/dist --cikti cikti/index.html [--paylas URL]

veri.b64 : gzip + base64 JSON veri paketi (biçim: README.md; örnek üretici: ornek_veri.py)
maplibre : maplibre-gl@4.7.1 paketinin dist klasörü (npm pack maplibre-gl@4.7.1)
"""
import argparse
import pathlib

W = pathlib.Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument('--veri', required=True)
ap.add_argument('--maplibre', required=True)
ap.add_argument('--cikti', default=str(W / 'cikti' / 'index.html'))
ap.add_argument('--paylas', default='')
a = ap.parse_args()
ML = pathlib.Path(a.maplibre)
mljs = (ML / 'maplibre-gl.js').read_text(encoding='utf-8')
assert '</script' not in mljs.lower()
app = (W / 'app.js').read_text(encoding='utf-8')
if a.paylas:
    app = app.replace("'__SHARE__'.startsWith('__') ? '' : '__SHARE__'", repr(a.paylas))
parts = {
    '/*__MLCSS__*/': (ML / 'maplibre-gl.css').read_text(encoding='utf-8'),
    '/*__APPCSS__*/': (W / 'app.css').read_text(encoding='utf-8'),
    '/*__MLJS__*/': mljs,
    '/*__PROJ__*/': (W / 'proj.js').read_text(encoding='utf-8').replace("if (typeof module !== 'undefined') module.exports = TM;", ''),
    '/*__APPJS__*/': app,
    '__DATA__': pathlib.Path(a.veri).read_text(encoding='utf-8').strip(),
}
out = (W / 'shell.html').read_text(encoding='utf-8')
for k, v in parts.items():
    assert out.count(k) == 1, k
    out = out.replace(k, v)
p = pathlib.Path(a.cikti); p.parent.mkdir(parents=True, exist_ok=True); p.write_text(out, encoding='utf-8')
print(f'{p} {len(out.encode()) / 1e6:.2f} MB')
