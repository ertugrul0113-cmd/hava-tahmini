// Tahminden uyarı çıkarır (önümüzdeki 48 saat). Değerler: m/s, °C, mm.

export const ESIKLER = {
  hamle: 17,        // ~60 km/s
  hamleCok: 25,     // ~90 km/s
  yagisSaat: 8,     // mm/saat
  yagisGun: 30,     // mm / 24 saat
  kar: 2,           // cm/saat
  don: -2,
  sicak: 37,
  sis: 300          // görüş metre
};

const FIRTINA = [95, 96, 99];

// h: Open-Meteo hourly nesnesi (time unix, değişkenler dizi). simdi: unix saniye.
export function uyarilariBul(h, simdi, saat = 48) {
  const sonuc = [];
  if (!h || !h.time) return sonuc;
  const bas = h.time.findIndex(t => t >= simdi - 3600);
  if (bas < 0) return sonuc;
  const son = Math.min(h.time.length, bas + saat);
  const ilk = (kosul) => { for (let i = bas; i < son; i++) if (kosul(i)) return i; return -1; };
  const enBuyuk = (dizi) => { let m = -Infinity, mi = -1; for (let i = bas; i < son; i++) if (dizi?.[i] != null && dizi[i] > m) { m = dizi[i]; mi = i; } return [m, mi]; };

  const [hamle, hi] = enBuyuk(h.wind_gusts_10m);
  if (hamle >= ESIKLER.hamleCok) sonuc.push({ seviye: 'kirmizi', simge: '🌪️', metin: 'Çok kuvvetli rüzgar', deger: hamle, tur: 'hiz', zaman: h.time[hi] });
  else if (hamle >= ESIKLER.hamle) sonuc.push({ seviye: 'turuncu', simge: '💨', metin: 'Kuvvetli rüzgar', deger: hamle, tur: 'hiz', zaman: h.time[hi] });

  const fi = ilk(i => FIRTINA.includes(h.weather_code?.[i]));
  if (fi >= 0) sonuc.push({ seviye: 'turuncu', simge: '⛈️', metin: 'Gök gürültülü fırtına', zaman: h.time[fi] });

  const [ys, yi] = enBuyuk(h.precipitation);
  if (ys >= ESIKLER.yagisSaat) sonuc.push({ seviye: 'turuncu', simge: '🌧️', metin: 'Kuvvetli yağış', deger: ys, tur: 'yagis', ek: '/saat', zaman: h.time[yi] });
  else if (h.precipitation) {
    for (let i = bas; i + 24 <= son; i++) {
      let top = 0; for (let k = i; k < i + 24; k++) top += h.precipitation[k] || 0;
      if (top >= ESIKLER.yagisGun) { sonuc.push({ seviye: 'sari', simge: '🌧️', metin: '24 saatte çok yağış', deger: top, tur: 'yagis', zaman: h.time[i] }); break; }
    }
  }

  const [ks, ki] = enBuyuk(h.snowfall);
  if (ks >= ESIKLER.kar) sonuc.push({ seviye: 'turuncu', simge: '❄️', metin: 'Yoğun kar', deger: ks, tur: 'kar', ek: '/saat', zaman: h.time[ki] });
  else if (ks > 0.2) sonuc.push({ seviye: 'sari', simge: '🌨️', metin: 'Kar yağışı', zaman: h.time[ki] });

  const di = ilk(i => h.temperature_2m?.[i] != null && h.temperature_2m[i] <= ESIKLER.don);
  if (di >= 0) sonuc.push({ seviye: 'sari', simge: '🧊', metin: 'Don / buzlanma', deger: Math.min(...h.temperature_2m.slice(bas, son).filter(x => x != null)), tur: 'sicaklik', zaman: h.time[di] });

  const [sc, si] = enBuyuk(h.temperature_2m);
  if (sc >= ESIKLER.sicak) sonuc.push({ seviye: 'turuncu', simge: '🥵', metin: 'Aşırı sıcak', deger: sc, tur: 'sicaklik', zaman: h.time[si] });

  const gi = ilk(i => h.visibility?.[i] != null && h.visibility[i] < ESIKLER.sis);
  if (gi >= 0) sonuc.push({ seviye: 'sari', simge: '🌫️', metin: 'Yoğun sis', zaman: h.time[gi] });

  const sira = { kirmizi: 0, turuncu: 1, sari: 2 };
  return sonuc.sort((a, b) => sira[a.seviye] - sira[b.seviye] || a.zaman - b.zaman);
}
