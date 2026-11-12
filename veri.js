// Open-Meteo'dan veri çekme ve önbellek.

const ADRES = {
  hava: 'https://api.open-meteo.com/v1/forecast',
  deniz: 'https://marine-api.open-meteo.com/v1/marine',
  hava_kalitesi: 'https://air-quality-api.open-meteo.com/v1/air-quality'
};
const GUN = { hava: 7, deniz: 7, hava_kalitesi: 5 };
const OMUR = 60 * 60 * 1000; // 1 saat sonra veriyi yenile
const PARCA = 90;            // bir istekte en çok kaç nokta

// önbellek: "kaynak|model|degisken" -> Map(noktaAnahtari -> {t0, veri, zaman})
const onbellek = new Map();
const bekleyen = new Map();

function seriHaritasi(kaynak, model, degisken) {
  const k = `${kaynak}|${kaynak === 'hava' ? model : '-'}|${degisken}`;
  if (!onbellek.has(k)) onbellek.set(k, new Map());
  return onbellek.get(k);
}

export class KotaHatasi extends Error {}

async function istek(url) {
  const r = await fetch(url);
  if (r.status === 429) throw new KotaHatasi('Ücretsiz veri sınırına takıldı. Biraz bekleyip tekrar dene.');
  if (!r.ok) {
    let m = 'Veri alınamadı (' + r.status + ')';
    try { const j = await r.json(); if (j.reason) m += ': ' + j.reason; } catch { /* boş */ }
    throw new Error(m);
  }
  return r.json();
}

function sayilar(dizi) {
  const f = new Float32Array(dizi.length);
  for (let i = 0; i < dizi.length; i++) f[i] = dizi[i] == null ? NaN : dizi[i];
  return f;
}

// Noktalar için değişkenleri getirir (önbellekte olmayanları). Geriye her değişken için Map döner.
export async function izgaraVerisi(kaynak, model, degiskenler, noktalar) {
  degiskenler = [...new Set(degiskenler)];
  const simdi = Date.now();
  const haritalar = degiskenler.map(d => seriHaritasi(kaynak, model, d));
  const eskiMi = (h, p) => { const s = h.get(p.anahtar); return !s || simdi - s.zaman > OMUR; };
  // yalnız eksik değişkenleri, yalnız eksik noktalar için iste
  const eksikDeg = degiskenler.filter((d, k) => noktalar.some(p => eskiMi(haritalar[k], p)));
  if (eksikDeg.length) {
    const eksikHar = eksikDeg.map(d => seriHaritasi(kaynak, model, d));
    const eksik = noktalar.filter(p => eksikHar.some(h => eskiMi(h, p)));
    const tekil = [...new Map(eksik.map(p => [p.anahtar, p])).values()];
    const isler = [];
    for (let i = 0; i < tekil.length; i += PARCA) isler.push(tekil.slice(i, i + PARCA));
    let siradaki = 0;
    const calis = async () => {
      while (siradaki < isler.length) {
        const grup = isler[siradaki++];
        const anahtar = kaynak + model + eksikDeg.join() + grup[0].anahtar + grup.length;
        if (!bekleyen.has(anahtar)) bekleyen.set(anahtar, parcaGetir(kaynak, model, eksikDeg, grup, eksikHar).finally(() => bekleyen.delete(anahtar)));
        await bekleyen.get(anahtar);
      }
    };
    await Promise.all([calis(), calis()]);
  }
  return haritalar;
}

// Dakikalık sınıra takılınca bir kez bekleyip yeniden dene
let beklemeBildir = null;
export function beklemeDinle(f) { beklemeBildir = f; }
async function istekTekrarli(url) {
  try { return await istek(url); } catch (e) {
    if (!(e instanceof KotaHatasi)) throw e;
    if (beklemeBildir) beklemeBildir();
    await new Promise(r => setTimeout(r, 20000));
    return istek(url);
  }
}

async function parcaGetir(kaynak, model, degiskenler, grup, haritalar) {
  const q = new URLSearchParams({
    latitude: grup.map(p => p.lat).join(','),
    longitude: grup.map(p => p.lon).join(','),
    hourly: degiskenler.join(','),
    forecast_days: GUN[kaynak],
    timeformat: 'unixtime',
    timezone: 'GMT'
  });
  if (kaynak === 'hava') {
    q.set('wind_speed_unit', 'ms');
    if (model !== 'best_match') q.set('models', model);
  }
  if (kaynak === 'hava_kalitesi') q.set('domains', 'auto');
  const j = await istekTekrarli(ADRES[kaynak] + '?' + q.toString().replace(/%2C/g, ','));
  const liste = Array.isArray(j) ? j : [j];
  const zaman = Date.now();
  liste.forEach((sonuc, i) => {
    const p = grup[i];
    const h = sonuc.hourly || {};
    const t0 = h.time ? h.time[0] : 0;
    degiskenler.forEach((d, k) => {
      haritalar[k].set(p.anahtar, { t0, veri: sayilar(h[d] || []), zaman });
    });
  });
}

// Tek nokta için ayrıntılı tahmin
export async function noktaTahmini(lat, lon, model) {
  const q = new URLSearchParams({
    latitude: lat, longitude: lon,
    hourly: ['temperature_2m', 'apparent_temperature', 'precipitation', 'precipitation_probability', 'snowfall', 'weather_code',
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
      'relative_humidity_2m', 'pressure_msl', 'dew_point_2m', 'visibility', 'cape', 'uv_index', 'freezing_level_height', 'is_day'].join(','),
    daily: ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'precipitation_probability_max',
      'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'sunrise', 'sunset', 'uv_index_max', 'daylight_duration'].join(','),
    current: ['temperature_2m', 'apparent_temperature', 'weather_code', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'relative_humidity_2m', 'pressure_msl', 'is_day', 'precipitation'].join(','),
    forecast_days: 10, timeformat: 'unixtime', timezone: 'auto', wind_speed_unit: 'ms'
  });
  if (model && model !== 'best_match') q.set('models', model);
  return istek(ADRES.hava + '?' + q.toString().replace(/%2C/g, ','));
}

// Modelleri karşılaştırma
export async function modelKarsilastir(lat, lon, modeller) {
  const q = new URLSearchParams({
    latitude: lat, longitude: lon,
    hourly: 'temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,cloud_cover,weather_code',
    models: modeller.join(','), forecast_days: 7, timeformat: 'unixtime', timezone: 'auto', wind_speed_unit: 'ms'
  });
  return istek(ADRES.hava + '?' + q.toString().replace(/%2C/g, ','));
}

export async function denizTahmini(lat, lon) {
  const q = new URLSearchParams({
    latitude: lat, longitude: lon,
    hourly: 'wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction',
    forecast_days: 7, timeformat: 'unixtime', timezone: 'auto'
  });
  return istek(ADRES.deniz + '?' + q.toString().replace(/%2C/g, ','));
}

export async function havaKalitesi(lat, lon) {
  const q = new URLSearchParams({
    latitude: lat, longitude: lon,
    hourly: 'european_aqi,pm2_5,pm10,dust,ozone,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide,uv_index,alder_pollen,birch_pollen,grass_pollen,olive_pollen,ragweed_pollen',
    forecast_days: 5, timeformat: 'unixtime', timezone: 'auto', domains: 'auto'
  });
  return istek(ADRES.hava_kalitesi + '?' + q.toString().replace(/%2C/g, ','));
}

export async function yerAra(ad) {
  const q = new URLSearchParams({ name: ad, count: 10, language: 'tr', format: 'json' });
  const j = await istek('https://geocoding-api.open-meteo.com/v1/search?' + q);
  return (j.results || []).map(r => ({
    ad: r.name, alt: [r.admin2, r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude
  }));
}

export async function yerAdi(lat, lon) {
  try {
    const q = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: 'tr' });
    const j = await istek('https://api.bigdatacloud.net/data/reverse-geocode-client?' + q);
    const ad = j.locality || j.city || j.principalSubdivision || '';
    const alt = [j.city !== ad ? j.city : '', j.principalSubdivision !== ad ? j.principalSubdivision : '', j.countryName].filter(Boolean).join(', ');
    return { ad: ad || 'Seçilen nokta', alt };
  } catch {
    return { ad: 'Seçilen nokta', alt: '' };
  }
}

export async function radarKareleri() {
  const j = await istek('https://api.rainviewer.com/public/weather-maps.json');
  const kareler = [...(j.radar?.past || []), ...(j.radar?.nowcast || []).map(k => ({ ...k, tahmin: true }))];
  return { host: j.host, kareler };
}
