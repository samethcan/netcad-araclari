# netcad-ncz

Netcad 8.x **NCZ** dosyalarını Python ile okur: katmanlar, noktalar, çizgiler, poligonlar ve yazılar. Sonucu **GeoJSON** olarak verir, böylece QGIS, ArcGIS ya da herhangi bir CBS yazılımında açılabilir.

```
pip install netcad-ncz
```

## Komut satırı
```
ncz-oku dosya.ncz
ncz-oku dosya.ncz --geojson dosya.geojson
```

## Python
```python
import netcad_ncz

r = netcad_ncz.read("dosya.ncz")
print(netcad_ncz.summary(r))      # katmanlar ve nesne sayıları
for f in r["feats"]:
    print(f["layer"], f["type"], f.get("label"), f["pts"][:2])

gj = netcad_ncz.to_geojson(r)     # FeatureCollection (dict)
```

- Koordinatlar dosyadaki projeksiyonda kalır; sıra **(Y doğu, X kuzey)**, yani Netcad ekranındaki sağa/yukarı.
- Metinler Türkçe Windows kod sayfasıyla (cp1254) çözülür.
- Bağımlılık yoktur, yalnızca Python standart kütüphanesi.

## Uyarı
NCZ biçimi resmî olarak belgelenmemiştir; bu okuyucu Netcad 8.5.x dosyaları incelenerek yazılmıştır. Biçim notları: [NCZ dosya biçimi](https://samethcan.github.io/netcad-araclari/ncz-bicimi/).

Netcad, Netcad Yazılım A.Ş.'nin markasıdır. Bu paket bağımsızdır, Netcad ile resmî bir ilişkisi yoktur.

Kaynak kod ve diğer araçlar: https://github.com/samethcan/netcad-araclari · Lisans: MIT
