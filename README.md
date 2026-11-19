# netcad-araclari

Netcad kullanan harita büroları, kurumlar ve tüm harita mühendisi ve teknikerleri için küçük, bağımsız araçlar. Depoda **yalnızca kod ve belge** vardır; hiçbir kuruma ait parsel, pafta, koordinat, belge ya da görüntü verisi yoktur. Örnekler tamamen uydurmadır.

**Canlı demo (kurulum gerekmez):** https://samethcan.github.io/netcad-araclari/
- [Aplikasyon Alan Hesabı](https://samethcan.github.io/netcad-araclari/aplikasyon/aplikasyon_alan_hesabi.html)
- [3B Pafta İndeksi (uydurma veri)](https://samethcan.github.io/netcad-araclari/demo/pafta-indeksi-3b/)
- [Netcad NCZ dosya biçimi (Türkçe anlatım)](https://samethcan.github.io/netcad-araclari/ncz-bicimi/)

**NCZ okuyucu Python paketi:** `pip install netcad-ncz` → `ncz-oku dosya.ncz --geojson dosya.geojson`

| Klasör | İçerik |
|---|---|
| `ncz/` | `ncz_reader.py`: Netcad 8.x NCZ okuyucu (katmanlar, nokta, çizgi, poligon, yazı, pafta çerçevesi). `NCZ_FORMAT.md`: biçim notları. |
| `aplikasyon/` | `aplikasyon_alan_hesabi.html`: Aplikasyon belgesinden köşe koordinatlarını alıp alan hesabı, tapu–hesap alanı ve yanılma sınırı kontrolü yapan, **doğrudan NCZ** (ve DXF/NCN/rapor) üreten tek dosyalık sayfa. |
| `pafta-indeksi-3b/` | Parselin hangi paftalara girdiğini gösteren, telefonda da çalışan 3B pafta indeksi (MapLibre). `ornek_veri.py` uydurma veriyle deneme paketi üretir. |
| `kadastro/` | `kad.py`: Açık kadastro pafta çizgilerinden numaralı pafta alanları üretir (düğümleme + boşluk kapatma). |
| `geodezi/` | ITRF 1/1000 pafta adı hesabı ve tapu alanı yanılma sınırı. |

## Gereksinimler
- Python 3.10+, `shapely>=2.0` (kadastro ve örnek veri için)
- Pafta indeksi derlemesi için `maplibre-gl@4.7.1` paketi (`npm pack maplibre-gl@4.7.1`)

## Pafta indeksini uydurma veriyle denemek
```
cd pafta-indeksi-3b
python ornek_veri.py ornek.b64
python build.py --veri ornek.b64 --maplibre <maplibre-gl/package/dist>
```
`cikti/index.html` tarayıcıda açılır.

## Uyarılar
- NCZ biçimi resmî olarak belgelenmemiştir; notlar tersine mühendisliktir. Üretilen dosyaları Netcad'de kontrol edin.
- Yanılma sınırı fonksiyonundaki 0–10 m² kuralı doğrulanmamıştır.

## Lisans
MIT açık kaynak yazılım lisansı (yazılım kullanım izni; üniversite ile ilgisi yoktur): kod ücretsiz kullanılabilir, değiştirilebilir ve dağıtılabilir, yeter ki telif notu korunsun. Ayrıntı için `LICENSE`. `demo/pafta-indeksi-3b/` içindeki derlenmiş demo MapLibre GL JS (BSD-3) içerir; lisansı `MAPLIBRE_LICENSE.txt`.
