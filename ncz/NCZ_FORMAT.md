# Netcad NCZ dosya biçimi (8.x) — tersine mühendislik notları

Resmî belge değildir. Netcad 8.5.x ile üretilmiş dosyalar üzerinde okunarak ve yazılan dosyalar Netcad'de açılarak çıkarılmıştır.

## Blok yapısı
- Dosya bloklardan oluşur: `[kind u8][len u32 LE][payload]`; blok boyu `len + 5`. Zincir dosya sonunda tam biter.
- Dosya her zaman kind 1 başlıkla başlar: dosya boyu (`u32 @+5`), diğer başlık bloklarının ofsetleri, proje sınır kutusu (`4×f64 @+49`), geometri sayısı (`u32 @+81`). Sıkıştırma yok.
- Katman tablosu: `kind 6`; katman sayısı `u16 @+16`; `+18`'den itibaren 29 baytlık kayıtlar; `r[4]` ad uzunluğu, `r[5:]` ad (cp1254). Geometrinin `+7`'deki katman kodu bu listede doğrudan indekstir.
- Görünüm alanı: `kind 4`, `4×f64 @+5`. Küçük resim: `kind 14` içinde BMP.
- `kind 28` / `kind 25`: adlı veri blokları (proje XML'leri vb.). `kind 33`: sonraki nesnenin uzun adı ya da yazının devamı.

## Geometri kayıtları
- `kind 21` (CAD nesnesi) ve `kind 22` (GIS nesnesi). GIS nesnesinde köşe ve etiket alanları **+28 bayt kayar** (sınıf adı `+86` 11 B, nesne anahtarı `+97` 17 B).
- Ortak: tip `+6`, katman `+7`, konum `f64 X(kuzey) @+8`, `Y(doğu) @+16`, sınır kutusu `4×f64 @+50` (minX, minY, maxX, maxY).
- **Tip 7 (çoklu çizgi/poligon):** köşe sayısı `(blok−113−kayma)/24`; köşeler `+113(+kayma)`, her biri `X, Y, Z f64`. Etiket: uzunluk `+86`, metin `+87` (kayıt içinde en çok 10 karakter; daha uzunsa tam ad önceki kind 33'te). Bayraklar `i32 @+101`: 1 kapalı, 2 dolgulu, 16 adlı.
- **Tip 1 (nokta):** ad uzunluğu `+86`, ad `+87`.
- **Tip 2 (çizgi):** başlangıç `+8/+16`, bitiş `X @+86`, `Y @+94`.
- **Tip 5 (yazı):** yükseklik `f32 @+86`, dönüklük `f32 (radyan) @+90`, metin uzunluğu `+97`, metin `+98` (cp1254, en çok 50 karakter; devamı kind 33'te).
- **Tip 10 (döndürülmüş dikdörtgen, pafta çerçevesi):** P1 `+8/+16`, P3 `+104/+112`, dönüklük `f32 @+120`. `W = P3.Y − P1.Y`, `H = P3.X − P1.X`; köşeler P1 etrafında θ kadar döndürülür.
- **Tip 15 (akıllı nesne):** `len` alanı 81 bayt eksik yazılır; okuyucu bunu düzeltir.

## Yazma
Netcad'in ürettiği boş bir şablonun başlık blokları kopyalanır; katman tablosu, görünüm alanı, sınır kutusu, dosya boyu ve geometri sayısı yeniden yazılır, geometri kayıtları eklenir. Bkz. `aplikasyon/aplikasyon_alan_hesabi.html` içindeki `NCZ.build`.
