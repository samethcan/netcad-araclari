"""ITRF (ulusal) 1/1000 pafta adı ve tapu alanı yanılma sınırı.

itrf_ad: Coğrafi koordinattan 22,5" x 22,5" (1/1000) pafta adı. Ad şeması:
  blok (30' x 30') + A-D (15') + 01-25 (3', 5x5, kuzeyden satır satır) + A-D (1'30") + 1-4 (45") + A-D (22,5")
  Çeyrekler saat yönünde: A/1 KB, B/2 KD, C/3 GD, D/4 GB.
  L0/T0 bloğun kuzeybatı köşesi (derece). Varsayılan L18 bloğu (27,0 D / 38,5 K).

yanilma_siniri: Tapu alanı yanılma sınırı (m²), dilim tablosu; dilim arası küsurat alt dilimden.
  0-10 m² kuralı doğrulanmadı.
"""
cw = {(0, 0): 0, (0, 1): 1, (1, 1): 2, (1, 0): 3}  # (satır kuzeyden, sütun batıdan)


def itrf_ad(lon, lat, L0=27.0, T0=38.5, blok='L18'):
    x = (lon - L0) * 3600; y = (T0 - lat) * 3600
    q = 'ABCD'[cw[(int(y // 900), int(x // 900))]]; x %= 900; y %= 900
    n = int(y // 180) * 5 + int(x // 180) + 1; x %= 180; y %= 180
    a = 'ABCD'[cw[(int(y // 90), int(x // 90))]]; x %= 90; y %= 90
    b = '1234'[cw[(int(y // 45), int(x // 45))]]; x %= 45; y %= 45
    c = 'ABCD'[cw[(int(y // 22.5), int(x // 22.5))]]
    return f'{blok}{q}{n:02d}{a}{b}{c}'


def yanilma_siniri(A):
    for lo, base, r in [(25000, 84.80, .0015), (5000, 24.80, .003), (1000, 8.80, .004), (500, 6.30, .005), (100, 2.30, .01), (10, 0.50, .02)]:
        if lo + 1 <= A:
            return base + (A - lo) * r
    return min(A * 0.05, 0.50)


if __name__ == '__main__':
    assert itrf_ad(27.0001, 38.4999) == 'L18A01A1A'
    assert round(yanilma_siniri(100), 2) == 2.30 and round(yanilma_siniri(950), 2) == 8.55
    print('testler geçti')
