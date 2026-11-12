// Haritadaki katmanlar ve yükseklik seviyeleri.

export const SEVIYELER = [
  { id: 'yuzey', ad: 'Yüzey', kisa: 'Yüzey' },
  { id: '100m', ad: '100 m', kisa: '100m' },
  { id: '950', ad: '600 m · 950 hPa', kisa: '600m' },
  { id: '925', ad: '750 m · 925 hPa', kisa: '750m' },
  { id: '850', ad: '1.500 m · 850 hPa', kisa: '1500m' },
  { id: '700', ad: '3.000 m · 700 hPa', kisa: '3000m' },
  { id: '500', ad: '5.500 m · 500 hPa', kisa: '5500m' },
  { id: '300', ad: '9.000 m · 300 hPa', kisa: '9000m' },
  { id: '250', ad: '10.000 m · 250 hPa', kisa: 'FL340' },
  { id: '200', ad: '12.000 m · 200 hPa', kisa: 'FL390' }
];

const HPA = ['950', '925', '850', '700', '500', '300', '250', '200'];

function seviyeli(yuzey, ek100, onEk) {
  return s => {
    if (s === 'yuzey') return yuzey;
    if (s === '100m') return ek100 || null;
    if (HPA.includes(s)) return `${onEk}_${s}hPa`;
    return null;
  };
}
const sabit = d => s => (s === 'yuzey' ? d : null);

// tur: izgara (Open-Meteo verisi) | karo (hazır görüntü katmanı)
// parcacik: üstünde hangi akış gösterilir (ruzgar | akinti | dalga | null)
export const KATMANLAR = [
  // Rüzgar
  { id: 'ruzgar', ad: 'Rüzgar', ikon: '🌬️', grup: 'Rüzgar', tur: 'izgara', kaynak: 'hava',
    degisken: seviyeli('wind_speed_10m', 'wind_speed_100m', 'wind_speed'), birim: 'hiz', olcek: 'hiz', parcacik: 'ruzgar' },
  { id: 'hamle', ad: 'Rüzgar hamlesi', ikon: '💨', grup: 'Rüzgar', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('wind_gusts_10m'), birim: 'hiz', olcek: 'hiz', parcacik: 'ruzgar' },

  // Yağış
  { id: 'yagis', ad: 'Yağmur, kar', ikon: '🌧️', grup: 'Yağış', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('precipitation'), birim: 'yagis', olcek: 'yagis', parcacik: 'ruzgar' },
  { id: 'radar', ad: 'Radar', ikon: '📡', grup: 'Yağış', tur: 'karo', parcacik: null, olcek: 'radar', birim: 'dbz' },
  { id: 'kar', ad: 'Kar yağışı', ikon: '🌨️', grup: 'Yağış', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('snowfall'), birim: 'kar', olcek: 'kar', parcacik: 'ruzgar' },
  { id: 'olasilik', ad: 'Yağış ihtimali', ikon: '☔', grup: 'Yağış', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('precipitation_probability'), birim: 'yuzde', olcek: 'olasilik', parcacik: 'ruzgar' },
  { id: 'karDerinlik', ad: 'Kar kalınlığı', ikon: '⛄', grup: 'Yağış', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('snow_depth'), birim: 'karDerinlik', olcek: 'karDerinlik', parcacik: 'ruzgar' },

  // Sıcaklık
  { id: 'sicaklik', ad: 'Sıcaklık', ikon: '🌡️', grup: 'Sıcaklık', tur: 'izgara', kaynak: 'hava',
    degisken: seviyeli('temperature_2m', null, 'temperature'), birim: 'sicaklik', olcek: 'sicaklik', parcacik: 'ruzgar' },
  { id: 'hissedilen', ad: 'Hissedilen', ikon: '🥵', grup: 'Sıcaklık', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('apparent_temperature'), birim: 'sicaklik', olcek: 'sicaklik', parcacik: 'ruzgar' },
  { id: 'ciy', ad: 'Çiy noktası', ikon: '💧', grup: 'Sıcaklık', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('dew_point_2m'), birim: 'sicaklik', olcek: 'sicaklik', parcacik: 'ruzgar' },
  { id: 'donma', ad: 'Donma seviyesi', ikon: '🧊', grup: 'Sıcaklık', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('freezing_level_height'), birim: 'yukseklik', olcek: 'donma', parcacik: 'ruzgar' },
  { id: 'nem', ad: 'Nem', ikon: '💦', grup: 'Sıcaklık', tur: 'izgara', kaynak: 'hava',
    degisken: seviyeli('relative_humidity_2m', null, 'relative_humidity'), birim: 'yuzde', olcek: 'nem', parcacik: 'ruzgar' },

  // Bulut, basınç
  { id: 'bulut', ad: 'Bulutlar', ikon: '☁️', grup: 'Bulut ve basınç', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('cloud_cover'), birim: 'yuzde', olcek: 'bulut', parcacik: 'ruzgar' },
  { id: 'alcakBulut', ad: 'Alçak bulut', ikon: '🌫️', grup: 'Bulut ve basınç', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('cloud_cover_low'), birim: 'yuzde', olcek: 'bulut', parcacik: 'ruzgar' },
  { id: 'ortaBulut', ad: 'Orta bulut', ikon: '🌥️', grup: 'Bulut ve basınç', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('cloud_cover_mid'), birim: 'yuzde', olcek: 'bulut', parcacik: 'ruzgar' },
  { id: 'yuksekBulut', ad: 'Yüksek bulut', ikon: '🌤️', grup: 'Bulut ve basınç', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('cloud_cover_high'), birim: 'yuzde', olcek: 'bulut', parcacik: 'ruzgar' },
  { id: 'gorus', ad: 'Görüş mesafesi', ikon: '👁️', grup: 'Bulut ve basınç', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('visibility'), birim: 'gorus', olcek: 'gorus', parcacik: 'ruzgar' },
  { id: 'basinc', ad: 'Basınç', ikon: '🧭', grup: 'Bulut ve basınç', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('pressure_msl'), birim: 'basinc', olcek: 'basinc', parcacik: 'ruzgar' },

  // Fırtına
  { id: 'cape', ad: 'Fırtına riski (CAPE)', ikon: '⛈️', grup: 'Fırtına', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('cape'), birim: 'enerji', olcek: 'cape', parcacik: 'ruzgar' },
  { id: 'yildirim', ad: 'Yıldırım (canlı)', ikon: '⚡', grup: 'Fırtına', tur: 'karo', parcacik: null, olcek: 'yildirim', birim: 'endeks' },

  // Uydu
  { id: 'uydu', ad: 'Uydu (canlı)', ikon: '🛰️', grup: 'Uydu', tur: 'karo', parcacik: null },
  { id: 'uyduKizil', ad: 'Uydu kızılötesi', ikon: '🌡', grup: 'Uydu', tur: 'karo', parcacik: null },
  { id: 'uyduDunya', ad: 'Uydu tüm dünya (günlük)', ikon: '🌍', grup: 'Uydu', tur: 'karo', parcacik: null },

  // Deniz
  { id: 'dalga', ad: 'Dalgalar', ikon: '🌊', grup: 'Deniz', tur: 'izgara', kaynak: 'deniz',
    degisken: sabit('wave_height'), birim: 'uzunluk', olcek: 'dalga', parcacik: 'dalga' },
  { id: 'ruzgarDalgasi', ad: 'Rüzgar dalgası', ikon: '〰️', grup: 'Deniz', tur: 'izgara', kaynak: 'deniz',
    degisken: sabit('wind_wave_height'), birim: 'uzunluk', olcek: 'dalga', parcacik: 'ruzgar' },
  { id: 'soluk', ad: 'Soluğan (swell)', ikon: '🏄', grup: 'Deniz', tur: 'izgara', kaynak: 'deniz',
    degisken: sabit('swell_wave_height'), birim: 'uzunluk', olcek: 'dalga', parcacik: 'dalga' },
  { id: 'periyot', ad: 'Dalga periyodu', ikon: '⏱️', grup: 'Deniz', tur: 'izgara', kaynak: 'deniz',
    degisken: sabit('wave_period'), birim: 'periyot', olcek: 'periyot', parcacik: 'dalga' },
  { id: 'akinti', ad: 'Akıntılar', ikon: '🌀', grup: 'Deniz', tur: 'izgara', kaynak: 'deniz',
    degisken: sabit('ocean_current_velocity'), carpan: 1 / 3.6, birim: 'akinti', olcek: 'akinti', parcacik: 'akinti' },
  { id: 'denizSicaklik', ad: 'Deniz sıcaklığı', ikon: '🐟', grup: 'Deniz', tur: 'izgara', kaynak: 'deniz',
    degisken: sabit('sea_surface_temperature'), birim: 'sicaklik', olcek: 'denizSicaklik', parcacik: 'akinti' },

  // Hava kalitesi
  { id: 'aqi', ad: 'Hava kalitesi', ikon: '😷', grup: 'Hava kalitesi', tur: 'izgara', kaynak: 'hava_kalitesi',
    degisken: sabit('european_aqi'), birim: 'endeks', olcek: 'aqi', parcacik: 'ruzgar' },
  { id: 'pm25', ad: 'PM2.5', ikon: '🏭', grup: 'Hava kalitesi', tur: 'izgara', kaynak: 'hava_kalitesi',
    degisken: sabit('pm2_5'), birim: 'yogunluk', olcek: 'pm', parcacik: 'ruzgar' },
  { id: 'pm10', ad: 'PM10', ikon: '🌫', grup: 'Hava kalitesi', tur: 'izgara', kaynak: 'hava_kalitesi',
    degisken: sabit('pm10'), birim: 'yogunluk', olcek: 'pm', parcacik: 'ruzgar' },
  { id: 'toz', ad: 'Çöl tozu', ikon: '🏜️', grup: 'Hava kalitesi', tur: 'izgara', kaynak: 'hava_kalitesi',
    degisken: sabit('dust'), birim: 'yogunluk', olcek: 'toz', parcacik: 'ruzgar' },
  { id: 'ozon', ad: 'Ozon', ikon: '🟦', grup: 'Hava kalitesi', tur: 'izgara', kaynak: 'hava_kalitesi',
    degisken: sabit('ozone'), birim: 'yogunluk', olcek: 'ozon', parcacik: 'ruzgar' },
  { id: 'no2', ad: 'Azot dioksit (NO₂)', ikon: '🚗', grup: 'Hava kalitesi', tur: 'izgara', kaynak: 'hava_kalitesi',
    degisken: sabit('nitrogen_dioxide'), birim: 'yogunluk', olcek: 'no2', parcacik: 'ruzgar' },
  { id: 'co', ad: 'Karbon monoksit (CO)', ikon: '🔥', grup: 'Hava kalitesi', tur: 'izgara', kaynak: 'hava_kalitesi',
    degisken: sabit('carbon_monoxide'), birim: 'yogunluk', olcek: 'co', parcacik: 'ruzgar' },
  { id: 'uv', ad: 'UV endeksi', ikon: '☀️', grup: 'Hava kalitesi', tur: 'izgara', kaynak: 'hava',
    degisken: sabit('uv_index'), birim: 'endeks', olcek: 'uv', parcacik: 'ruzgar' }
];

// Sağdaki hızlı menüde görünenler
export const HIZLI = ['ruzgar', 'yagis', 'radar', 'uydu', 'sicaklik', 'bulut', 'dalga', 'aqi'];

export function katmanBul(id) { return KATMANLAR.find(k => k.id === id) || KATMANLAR[0]; }

// Parçacık akışı için (hız, yön) değişkenleri. yonTipi: 'nereden' (rüzgar, dalga) | 'nereye' (akıntı)
export function akisDegiskenleri(tip, seviye) {
  if (tip === 'ruzgar') {
    const s = seviye === 'yuzey' ? '10m' : seviye === '100m' ? '100m' : `${seviye}hPa`;
    return { kaynak: 'hava', hiz: `wind_speed_${s}`, yon: `wind_direction_${s}`, yonTipi: 'nereden', carpan: 1 };
  }
  if (tip === 'akinti') {
    return { kaynak: 'deniz', hiz: 'ocean_current_velocity', yon: 'ocean_current_direction', yonTipi: 'nereye', carpan: 1 / 3.6 * 12 };
  }
  if (tip === 'dalga') {
    // Hız yerine dalga yüksekliği: karada boş olduğu için çizgiler denizde kalır
    return { kaynak: 'deniz', hiz: 'wave_height', yon: 'wave_direction', yonTipi: 'nereden', carpan: 4 };
  }
  return null;
}

export const MODELLER = [
  { id: 'best_match', ad: 'En iyi (otomatik)', kisa: 'Oto' },
  { id: 'ecmwf_ifs025', ad: 'ECMWF (Avrupa)', kisa: 'ECMWF' },
  { id: 'gfs_seamless', ad: 'GFS (ABD)', kisa: 'GFS' },
  { id: 'icon_seamless', ad: 'ICON (Almanya)', kisa: 'ICON' },
  { id: 'meteofrance_seamless', ad: 'ARPEGE/AROME (Fransa)', kisa: 'Météo-Fr' },
  { id: 'ukmo_seamless', ad: 'UKMO (İngiltere)', kisa: 'UKMO' },
  { id: 'gem_seamless', ad: 'GEM (Kanada)', kisa: 'GEM' },
  { id: 'jma_seamless', ad: 'JMA (Japonya)', kisa: 'JMA' }
];
