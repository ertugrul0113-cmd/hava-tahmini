// Haritadaki veri ızgarası: hangi noktalar istenecek, aradaki değerler nasıl hesaplanır.

const ADIMLAR = [0.1, 0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7.5, 10, 15, 20];

// Görünen alana göre ızgara aralığı (derece). Hedef: kısa kenarda ~9 nokta, toplam en çok ~260 nokta.
export function adimSec(guney, kuzey, bati, dogu, hedef = 8, enCok = 170) {
  const enlem = Math.max(0.01, kuzey - guney), boylam = Math.max(0.01, dogu - bati);
  const kisa = Math.min(enlem, boylam);
  let i = ADIMLAR.findIndex(a => a >= kisa / hedef);
  if (i < 0) i = ADIMLAR.length - 1;
  while (i < ADIMLAR.length - 1 && ((enlem / ADIMLAR[i] + 3) * (boylam / ADIMLAR[i] + 3)) > enCok) i++;
  return ADIMLAR[i];
}

const yuvarla = x => Math.round(x * 1000) / 1000;
export const boylamDuzelt = lon => yuvarla(((lon + 540) % 360 + 360) % 360 - 180);

// Görünen alanı kaplayan ızgara (bir kenar fazladan).
export function izgaraKur(guney, kuzey, bati, dogu, adim) {
  const s = Math.max(-89, Math.floor(guney / adim) * adim - adim);
  const n = Math.min(89, Math.ceil(kuzey / adim) * adim + adim);
  const w = Math.floor(bati / adim) * adim - adim;
  const e = Math.ceil(dogu / adim) * adim + adim;
  const nLat = Math.round((n - s) / adim) + 1;
  const nLon = Math.round((e - w) / adim) + 1;
  return { lat0: yuvarla(s), lon0: yuvarla(w), adim, nLat, nLon };
}

export function noktaAnahtari(lat, lon) { return `${yuvarla(lat)},${boylamDuzelt(lon)}`; }

export function izgaraNoktalari(iz) {
  const liste = [];
  for (let y = 0; y < iz.nLat; y++)
    for (let x = 0; x < iz.nLon; x++) {
      const lat = yuvarla(iz.lat0 + y * iz.adim), lon = yuvarla(iz.lon0 + x * iz.adim);
      liste.push({ y, x, lat, lon, anahtar: noktaAnahtari(lat, lon) });
    }
  return liste;
}

// Izgaradaki tek bir zaman diliminden çift doğrusal (bilinear) değer.
// alan.veri: Float32Array, uzunluk nLat*nLon, satır = enlem.
export function aradeger(alan, lat, lon) {
  const fy = (lat - alan.lat0) / alan.adim, fx = (lon - alan.lon0) / alan.adim;
  const y0 = Math.floor(fy), x0 = Math.floor(fx);
  if (y0 < 0 || x0 < 0 || y0 >= alan.nLat - 1 || x0 >= alan.nLon - 1) return NaN;
  const ty = fy - y0, tx = fx - x0, n = alan.nLon, v = alan.veri;
  const a = v[y0 * n + x0], b = v[y0 * n + x0 + 1], c = v[(y0 + 1) * n + x0], d = v[(y0 + 1) * n + x0 + 1];
  if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) {
    // Kıyıda ya da veri eksikse: en yakın dolu köşe
    const k = [[a, (1 - tx) * (1 - ty)], [b, tx * (1 - ty)], [c, (1 - tx) * ty], [d, tx * ty]].filter(z => !Number.isNaN(z[0]));
    if (!k.length) return NaN;
    let top = 0, ag = 0;
    for (const [deg, w] of k) { top += deg * w; ag += w; }
    return ag > 0.35 ? top / ag : NaN;
  }
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

// Zaman serisinden istenen ana (saat) bir dilim çıkar, saatler arası doğrusal geçiş.
// seriler: Map(anahtar -> {t0, veri: Float32Array saatlik}), t: unix saniye
export function dilimKur(iz, noktalar, seriler, t, carpan = 1) {
  const veri = new Float32Array(iz.nLat * iz.nLon).fill(NaN);
  for (const p of noktalar) {
    const s = seriler.get(p.anahtar);
    if (!s) continue;
    const f = (t - s.t0) / 3600;
    const i = Math.floor(f);
    if (i < 0 || i >= s.veri.length) continue;
    const a = s.veri[i], b = i + 1 < s.veri.length ? s.veri[i + 1] : a, k = f - i;
    let v;
    if (Number.isNaN(a)) v = b; else if (Number.isNaN(b)) v = a; else v = a + (b - a) * k;
    veri[p.y * iz.nLon + p.x] = v * carpan;
  }
  return { ...iz, veri };
}

// Hız + yön (derece) -> u (doğu), v (kuzey). nereden: meteorolojik yön.
export function uvHesapla(hiz, yon, yonTipi = 'nereden') {
  const r = yon * Math.PI / 180;
  const k = yonTipi === 'nereden' ? -1 : 1;
  return [k * hiz * Math.sin(r), k * hiz * Math.cos(r)];
}

// Yön içeren seriyi zamanla aradeğerlerken açıyı değil u/v'yi karıştır.
export function akisDilimi(iz, noktalar, hizSeri, yonSeri, t, yonTipi, carpan = 1) {
  const u = new Float32Array(iz.nLat * iz.nLon).fill(NaN);
  const v = new Float32Array(iz.nLat * iz.nLon).fill(NaN);
  for (const p of noktalar) {
    const h = hizSeri.get(p.anahtar), y = yonSeri.get(p.anahtar);
    if (!h || !y) continue;
    const f = (t - h.t0) / 3600, i = Math.floor(f), k = f - i;
    if (i < 0 || i >= h.veri.length) continue;
    const j = Math.min(i + 1, h.veri.length - 1);
    const [u1, v1] = uvHesapla(h.veri[i], y.veri[i], yonTipi);
    const [u2, v2] = uvHesapla(h.veri[j], y.veri[j], yonTipi);
    const n = p.y * iz.nLon + p.x;
    u[n] = (u1 + (u2 - u1) * k) * carpan;
    v[n] = (v1 + (v2 - v1) * k) * carpan;
  }
  return { u: { ...iz, veri: u }, v: { ...iz, veri: v } };
}

// Basınç çizgileri (izobar) için kare yürütme (marching squares). Çıktı: [[lat,lon],[lat,lon]] parçaları, seviyeye göre.
export function esCizgiler(alan, aralik) {
  const { nLat, nLon, veri, lat0, lon0, adim } = alan;
  let min = Infinity, max = -Infinity;
  for (const x of veri) if (!Number.isNaN(x)) { if (x < min) min = x; if (x > max) max = x; }
  if (!Number.isFinite(min)) return [];
  const cikti = [];
  const nokta = (y, x) => [lat0 + y * adim, lon0 + x * adim];
  for (let seviye = Math.ceil(min / aralik) * aralik; seviye <= max; seviye += aralik) {
    const parcalar = [];
    for (let y = 0; y < nLat - 1; y++)
      for (let x = 0; x < nLon - 1; x++) {
        const a = veri[y * nLon + x], b = veri[y * nLon + x + 1], c = veri[(y + 1) * nLon + x + 1], d = veri[(y + 1) * nLon + x];
        if ([a, b, c, d].some(Number.isNaN)) continue;
        const kod = (a >= seviye ? 8 : 0) | (b >= seviye ? 4 : 0) | (c >= seviye ? 2 : 0) | (d >= seviye ? 1 : 0);
        if (kod === 0 || kod === 15) continue;
        const ara = (v1, v2) => (seviye - v1) / (v2 - v1);
        const ust = () => { const t = ara(a, b); const p = nokta(y, x + t); return p; };
        const sag = () => { const t = ara(b, c); return nokta(y + t, x + 1); };
        const alt = () => { const t = ara(d, c); return nokta(y + 1, x + t); };
        const sol = () => { const t = ara(a, d); return nokta(y + t, x); };
        const T = {
          1: [[sol, alt]], 2: [[alt, sag]], 3: [[sol, sag]], 4: [[ust, sag]], 5: [[sol, ust], [alt, sag]],
          6: [[ust, alt]], 7: [[sol, ust]], 8: [[sol, ust]], 9: [[ust, alt]], 10: [[sol, alt], [ust, sag]],
          11: [[ust, sag]], 12: [[sol, sag]], 13: [[alt, sag]], 14: [[sol, alt]]
        }[kod];
        for (const [f1, f2] of T) parcalar.push([f1(), f2()]);
      }
    if (parcalar.length) cikti.push({ seviye, parcalar });
  }
  return cikti;
}

// Kaba ızgarayı k kat inceltir (izobarlar daha yumuşak görünsün diye).
export function incelt(alan, k = 3) {
  const nLat = (alan.nLat - 1) * k + 1, nLon = (alan.nLon - 1) * k + 1, adim = alan.adim / k;
  const veri = new Float32Array(nLat * nLon);
  for (let y = 0; y < nLat; y++)
    for (let x = 0; x < nLon; x++)
      veri[y * nLon + x] = aradeger(alan, alan.lat0 + y * adim - (y === nLat - 1 ? 1e-9 : 0), alan.lon0 + x * adim - (x === nLon - 1 ? 1e-9 : 0));
  return { lat0: alan.lat0, lon0: alan.lon0, adim, nLat, nLon, veri };
}
