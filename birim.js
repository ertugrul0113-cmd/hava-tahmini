// Birim çevirme ve yazdırma. İç değerler: m/s, °C, mm, hPa, metre.

export const BIRIM_SECENEK = {
  hiz: [['kmh', 'km/s'], ['ms', 'm/s'], ['kt', 'knot'], ['bft', 'Bofor']],
  sicaklik: [['c', '°C'], ['f', '°F']],
  yagis: [['mm', 'mm'], ['in', 'inç']],
  basinc: [['hpa', 'hPa'], ['inhg', 'inHg']],
  uzunluk: [['m', 'm'], ['ft', 'ft']]
};

export const VARSAYILAN_BIRIM = { hiz: 'kmh', sicaklik: 'c', yagis: 'mm', basinc: 'hpa', uzunluk: 'm' };

export function bofor(ms) {
  const s = [0.3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
  let b = 0;
  while (b < s.length && ms >= s[b]) b++;
  return b;
}

// tur: hiz | sicaklik | yagis | kar | basinc | yuzde | gorus | uzunluk | yukseklik | enerji | yogunluk | endeks | periyot | yon
export function cevir(tur, deger, b) {
  if (deger == null || Number.isNaN(deger)) return NaN;
  switch (tur) {
    case 'hiz':
      if (b.hiz === 'kmh') return deger * 3.6;
      if (b.hiz === 'kt') return deger * 1.943844;
      if (b.hiz === 'bft') return bofor(deger);
      return deger;
    case 'akinti':
      if (b.hiz === 'ms') return deger;
      if (b.hiz === 'kt') return deger * 1.943844;
      return deger * 3.6;
    case 'sicaklik': return b.sicaklik === 'f' ? deger * 9 / 5 + 32 : deger;
    case 'yagis': return b.yagis === 'in' ? deger / 25.4 : deger;
    case 'kar': return b.yagis === 'in' ? deger / 2.54 : deger;
    case 'basinc': return b.basinc === 'inhg' ? deger * 0.02953 : deger;
    case 'gorus': return deger / 1000;
    case 'uzunluk': case 'yukseklik': return b.uzunluk === 'ft' ? deger * 3.28084 : deger;
    case 'karDerinlik': return b.uzunluk === 'ft' ? deger * 39.37 : deger * 100;
    default: return deger;
  }
}

export function birimAdi(tur, b) {
  switch (tur) {
    case 'hiz': return { kmh: 'km/s', ms: 'm/s', kt: 'kt', bft: 'Bft' }[b.hiz];
    case 'akinti': return { kmh: 'km/s', ms: 'm/s', kt: 'kt', bft: 'km/s' }[b.hiz];
    case 'sicaklik': return b.sicaklik === 'f' ? '°F' : '°C';
    case 'yagis': return b.yagis === 'in' ? 'in' : 'mm';
    case 'kar': return b.yagis === 'in' ? 'in' : 'cm';
    case 'basinc': return b.basinc === 'inhg' ? 'inHg' : 'hPa';
    case 'yuzde': return '%';
    case 'gorus': return 'km';
    case 'uzunluk': case 'yukseklik': return b.uzunluk === 'ft' ? 'ft' : 'm';
    case 'karDerinlik': return b.uzunluk === 'ft' ? 'in' : 'cm';
    case 'enerji': return 'J/kg';
    case 'yogunluk': return 'µg/m³';
    case 'periyot': return 'sn';
    case 'endeks': return '';
    default: return '';
  }
}

export function yaz(tur, deger, b, birimli = true) {
  const v = cevir(tur, deger, b);
  if (Number.isNaN(v)) return '–';
  let s;
  const m = Math.abs(v);
  if (tur === 'hiz' && b.hiz === 'bft') s = String(v);
  else if (tur === 'basinc' && b.basinc === 'inhg') s = v.toFixed(2);
  else if (tur === 'yagis' || tur === 'kar') s = m < 10 ? v.toFixed(1) : Math.round(v).toString();
  else if (tur === 'uzunluk' && m < 10) s = v.toFixed(1);
  else if (tur === 'gorus') s = m < 10 ? v.toFixed(1) : Math.round(v).toString();
  else if (tur === 'akinti') s = v.toFixed(1);
  else if (tur === 'periyot') s = v.toFixed(0);
  else s = Math.round(v).toString();
  s = s.replace('.', ',');
  if (!birimli) return s;
  const ad = birimAdi(tur, b);
  if (tur === 'sicaklik') return s + '°';
  return ad ? s + ' ' + ad : s;
}

// Yön (derece) -> Türkçe kısaltma
export function yonAdi(derece) {
  if (derece == null || Number.isNaN(derece)) return '';
  const adlar = ['K', 'KKD', 'KD', 'DKD', 'D', 'DGD', 'GD', 'GGD', 'G', 'GGB', 'GB', 'BGB', 'B', 'BKB', 'KB', 'KKB'];
  return adlar[Math.round(((derece % 360) + 360) % 360 / 22.5) % 16];
}
