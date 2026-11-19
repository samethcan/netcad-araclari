/* TUREF/TM27 (EPSG:5253) <-> enlem/boylam. GRS80, Krüger n-serisi (6. derece), Karney 2011. */
const TM = (() => {
  const a = 6378137, f = 1 / 298.257222101, k0 = 1, FE = 500000, L0 = 27 * Math.PI / 180;
  const n = f / (2 - f), e = Math.sqrt(f * (2 - f)), n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
  const A = a / (1 + n) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
  const al = [0, n / 2 - 2 * n2 / 3 + 5 * n3 / 16 + 41 * n4 / 180 - 127 * n5 / 288 + 7891 * n6 / 37800,
    13 * n2 / 48 - 3 * n3 / 5 + 557 * n4 / 1440 + 281 * n5 / 630 - 1983433 * n6 / 1935360,
    61 * n3 / 240 - 103 * n4 / 140 + 15061 * n5 / 26880 + 167603 * n6 / 181440,
    49561 * n4 / 161280 - 179 * n5 / 168 + 6601661 * n6 / 7257600,
    34729 * n5 / 80640 - 3418889 * n6 / 1995840, 212378941 * n6 / 319334400];
  const be = [0, n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360 - 81 * n5 / 512 + 96199 * n6 / 604800,
    n2 / 48 + n3 / 15 - 437 * n4 / 1440 + 46 * n5 / 105 - 1118711 * n6 / 3870720,
    17 * n3 / 480 - 37 * n4 / 840 - 209 * n5 / 4480 + 5569 * n6 / 90720,
    4397 * n4 / 161280 - 11 * n5 / 504 - 830251 * n6 / 7257600,
    4583 * n5 / 161280 - 108847 * n6 / 3991680, 20648693 * n6 / 638668800];
  const D = 180 / Math.PI;
  function fwd(lon, lat){ // -> [Y(doğu), X(kuzey)]
    const ph = lat / D, lm = lon / D - L0, s = Math.sin(ph);
    const t = Math.sinh(Math.atanh(s) - e * Math.atanh(e * s));
    const xp = Math.atan2(t, Math.cos(lm)), ep = Math.atanh(Math.sin(lm) / Math.sqrt(1 + t * t));
    let xi = xp, et = ep;
    for (let j = 1; j <= 6; j++){ xi += al[j] * Math.sin(2 * j * xp) * Math.cosh(2 * j * ep); et += al[j] * Math.cos(2 * j * xp) * Math.sinh(2 * j * ep); }
    return [FE + k0 * A * et, k0 * A * xi];
  }
  function inv(Y, X){ // -> [lon, lat]
    const xi = X / (k0 * A), et = (Y - FE) / (k0 * A);
    let xp = xi, ep = et;
    for (let j = 1; j <= 6; j++){ xp -= be[j] * Math.sin(2 * j * xi) * Math.cosh(2 * j * et); ep -= be[j] * Math.cos(2 * j * xi) * Math.sinh(2 * j * et); }
    const tp = Math.sin(xp) / Math.sqrt(Math.sinh(ep) ** 2 + Math.cos(xp) ** 2);
    let ta = tp;
    for (let i = 0; i < 6; i++){
      const sg = Math.sinh(e * Math.atanh(e * ta / Math.sqrt(1 + ta * ta)));
      const tpi = ta * Math.sqrt(1 + sg * sg) - sg * Math.sqrt(1 + ta * ta);
      const d = (tp - tpi) / Math.sqrt(1 + tpi * tpi) * (1 + (1 - e * e) * ta * ta) / ((1 - e * e) * Math.sqrt(1 + ta * ta));
      ta += d; if (Math.abs(d) < 1e-14) break;
    }
    return [(L0 + Math.atan2(Math.sinh(ep), Math.cos(xp))) * D, Math.atan(ta) * D];
  }
  return {fwd, inv};
})();
if (typeof module !== 'undefined') module.exports = TM;
