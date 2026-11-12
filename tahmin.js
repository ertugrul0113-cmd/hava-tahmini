// Bir noktanın ayrıntılı tahmini (alttan açılan sayfa)
import { noktaTahmini, modelKarsilastir, denizTahmini, havaKalitesi } from './veri.js';
import { yaz, yonAdi, cevir, birimAdi } from './birim.js';
import { havaKodu } from './hava-kodu.js';
import { renkBul, OLCEKLER } from './olcek.js';
import { grafikCiz } from './grafik.js';
import { uyarilariBul } from './uyari.js';
import { MODELLER } from './katmanlar.js';

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const GUN_K = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export function yerelSaat(t, ofset) {
  const d = new Date((t + ofset) * 1000);
  const iki = x => String(x).padStart(2, '0');
  return {
    gun: d.toISOString().slice(0, 10),
    gunAdi: GUNLER[d.getUTCDay()],
    gunKisa: GUN_K[d.getUTCDay()] + ' ' + d.getUTCDate(),
    tarih: d.getUTCDate() + ' ' + AYLAR[d.getUTCMonth()],
    saat: iki(d.getUTCHours()),
    saatDk: iki(d.getUTCHours()) + ':' + iki(d.getUTCMinutes())
  };
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ok = (yon, renk = '') => yon == null || Number.isNaN(yon) ? '' : `<span class="ok" style="transform:rotate(${Math.round(yon)}deg)${renk ? ';color:' + renk : ''}">↓</span>`;
function hucreRenk(olcek, v) {
  const [r, g, b, a] = renkBul(OLCEKLER[olcek], v);
  if (a < 10) return '';
  const k = Math.min(0.85, a / 255);
  // Arka plan açıksa yazı koyu olsun
  const parlak = (0.299 * r + 0.587 * g + 0.114 * b) * k + 27 * (1 - k);
  return `background:rgba(${r},${g},${b},${k})${parlak > 150 ? ';color:#111' : ''}`;
}
const MODEL_RENK = ['#ffd166', '#06d6a0', '#ef476f', '#4cc9f0', '#f78c6b', '#b5a1ff', '#9be564', '#ff9ff3'];

const AQI_AD = v => v == null ? '–' : v <= 20 ? 'Çok iyi' : v <= 40 ? 'İyi' : v <= 60 ? 'Orta' : v <= 80 ? 'Kötü' : v <= 100 ? 'Çok kötü' : 'Aşırı kötü';

export class TahminSayfasi {
  constructor(kok, { ayar, favoriMi, favoriDegistir, kapat }) {
    this.kok = kok;
    this.ayar = ayar;
    this.favoriMi = favoriMi;
    this.favoriDegistir = favoriDegistir;
    this.kapat = kapat;
    this.sekme = 'saatlik';
    this.adim = 1;
    this.modelDeg = 'temperature_2m';
    kok.addEventListener('click', e => this._tik(e));
  }

  async ac(yer) {
    this.yer = yer;
    this.veri = null; this.model = null; this.deniz = undefined; this.hava = undefined;
    this._ciz('<div class="yukleme-kutu">Tahmin yükleniyor…</div>');
    try {
      this.veri = await noktaTahmini(yer.lat, yer.lon, this.ayar().model);
      this._goster();
    } catch (e) {
      this._ciz(`<div class="hata-kutu">${esc(e.message)}</div>`);
    }
  }

  yenile() { if (this.veri) this._goster(); }

  _ciz(icerik) {
    const y = this.yer;
    const fav = this.favoriMi(y);
    this.kok.innerHTML = `
      <div class="tutamak"></div>
      <div class="ts-ust">
        <div class="ts-ad"><b>${esc(y.ad || 'Seçilen nokta')}</b><small>${esc(y.alt || '')} · ${y.lat.toFixed(3)}, ${y.lon.toFixed(3)}${this.veri ? ' · ' + Math.round(this.veri.elevation) + ' m' : ''}</small></div>
        <button class="ikon-btn" data-is="favori" title="Favori">${fav ? '★' : '☆'}</button>
        <button class="ikon-btn" data-is="kapat" title="Kapat">✕</button>
      </div>
      <div class="ts-govde">${icerik}</div>`;
  }

  _goster() {
    const v = this.veri, b = this.ayar().birim, c = v.current || {};
    const kod = havaKodu(c.weather_code, c.is_day !== 0);
    const uyarilar = uyarilariBul(v.hourly, Date.now() / 1000);
    const sekmeler = [['saatlik', 'Saatlik'], ['gunluk', '10 gün'], ['grafik', 'Grafik'], ['modeller', 'Modeller'], ['deniz', 'Deniz'], ['kalite', 'Hava kalitesi'], ['gunes', 'Güneş']];
    this._ciz(`
      <div class="simdi">
        <div class="simdi-sol"><span class="simdi-simge">${kod.simge}</span><span class="simdi-derece">${yaz('sicaklik', c.temperature_2m, b)}</span></div>
        <div class="simdi-sag">
          <b>${kod.ad}</b>
          <span>Hissedilen ${yaz('sicaklik', c.apparent_temperature, b)}</span>
          <span>${ok(c.wind_direction_10m)} ${yaz('hiz', c.wind_speed_10m, b)} ${yonAdi(c.wind_direction_10m)} · hamle ${yaz('hiz', c.wind_gusts_10m, b)}</span>
          <span>Nem %${Math.round(c.relative_humidity_2m)} · ${yaz('basinc', c.pressure_msl, b)}</span>
        </div>
      </div>
      ${uyarilar.length ? `<div class="uyari-liste">${uyarilar.map(u => this._uyariSatir(u, v.utc_offset_seconds)).join('')}</div>` : ''}
      <div class="sekmeler">${sekmeler.map(([id, ad]) => `<button data-sekme="${id}" class="${this.sekme === id ? 'secili' : ''}">${ad}</button>`).join('')}</div>
      <div class="sekme-icerik" id="sekmeIcerik"></div>
      <p class="kaynak">Model: ${esc((MODELLER.find(m => m.id === this.ayar().model) || MODELLER[0]).ad)} · Veri: Open-Meteo</p>`);
    this._sekmeCiz();
  }

  _uyariSatir(u, ofset) {
    const z = yerelSaat(u.zaman, ofset);
    const deger = u.deger != null ? ' · ' + yaz(u.tur, u.deger, this.ayar().birim) + (u.ek || '') : '';
    return `<div class="uyari uyari-${u.seviye}">${u.simge} <b>${u.metin}</b>${deger} <small>${z.gunAdi} ${z.saatDk}</small></div>`;
  }

  async _sekmeCiz() {
    const yer = this.kok.querySelector('#sekmeIcerik');
    if (!yer) return;
    const s = this.sekme;
    try {
      if (s === 'saatlik') yer.innerHTML = this._saatlik();
      else if (s === 'gunluk') yer.innerHTML = this._gunluk();
      else if (s === 'grafik') { yer.innerHTML = this._grafikKutu(); this._grafikCiz(); }
      else if (s === 'gunes') yer.innerHTML = this._gunes();
      else if (s === 'modeller') {
        if (!this.model) {
          yer.innerHTML = '<div class="yukleme-kutu">Modeller yükleniyor…</div>';
          this.model = await modelKarsilastir(this.yer.lat, this.yer.lon, MODELLER.slice(1).map(m => m.id));
          if (this.sekme !== 'modeller') return;
        }
        yer.innerHTML = this._modeller(); this._modelGrafik();
      } else if (s === 'deniz') {
        if (this.deniz === undefined) {
          yer.innerHTML = '<div class="yukleme-kutu">Deniz verisi yükleniyor…</div>';
          try { this.deniz = await denizTahmini(this.yer.lat, this.yer.lon); } catch { this.deniz = null; }
          if (this.sekme !== 'deniz') return;
        }
        yer.innerHTML = this._deniz();
      } else if (s === 'kalite') {
        if (this.hava === undefined) {
          yer.innerHTML = '<div class="yukleme-kutu">Hava kalitesi yükleniyor…</div>';
          try { this.hava = await havaKalitesi(this.yer.lat, this.yer.lon); } catch { this.hava = null; }
          if (this.sekme !== 'kalite') return;
        }
        yer.innerHTML = this._kalite();
      }
    } catch (e) {
      yer.innerHTML = `<div class="hata-kutu">${esc(e.message)}</div>`;
    }
  }

  // Yatay kaydırmalı saatlik tablo
  _saatlik() {
    const h = this.veri.hourly, of = this.veri.utc_offset_seconds, b = this.ayar().birim;
    const simdi = Date.now() / 1000 - 3600;
    const idx = [];
    for (let i = 0; i < h.time.length; i++) if (h.time[i] >= simdi && (this.adim === 1 ? i < (h.time.findIndex(t => t >= simdi) + 72) : yerelSaat(h.time[i], of).saat % 3 === 0)) idx.push(i);
    const gunBas = [];
    let onceki = null;
    for (const i of idx) { const g = yerelSaat(h.time[i], of); if (g.gun !== onceki) { gunBas.push({ ad: g.gunAdi + ' ' + g.tarih, n: 1 }); onceki = g.gun; } else gunBas[gunBas.length - 1].n++; }
    const sat = (baslik, f, sinif = '') => `<tr class="${sinif}"><th>${baslik}</th>${idx.map(f).join('')}</tr>`;
    return `
      <div class="adim-sec"><button data-adim="1" class="${this.adim === 1 ? 'secili' : ''}">Saatlik · 3 gün</button><button data-adim="3" class="${this.adim === 3 ? 'secili' : ''}">3 saatlik · 10 gün</button></div>
      <div class="tablo-kap"><table class="saat-tablo">
        <tr class="gun-satir"><th></th>${gunBas.map(g => `<td colspan="${g.n}">${g.n > 2 ? g.ad : ''}</td>`).join('')}</tr>
        ${sat('Saat', i => `<td>${yerelSaat(h.time[i], of).saat}</td>`, 'saat-satir')}
        ${sat('', i => `<td class="simge-h">${havaKodu(h.weather_code[i], h.is_day[i] !== 0).simge}</td>`)}
        ${sat(birimAdi('sicaklik', b), i => `<td style="${hucreRenk('sicaklik', h.temperature_2m[i])}">${yaz('sicaklik', h.temperature_2m[i], b, false)}</td>`)}
        ${sat('Hiss.', i => `<td>${yaz('sicaklik', h.apparent_temperature[i], b, false)}</td>`, 'soluk')}
        ${sat(birimAdi('yagis', b), i => `<td style="${hucreRenk('yagis', h.precipitation[i])}">${h.precipitation[i] > 0 ? yaz('yagis', h.precipitation[i], b, false) : ''}</td>`)}
        ${sat('%', i => `<td class="soluk">${h.precipitation_probability?.[i] ?? ''}</td>`)}
        ${sat(birimAdi('hiz', b), i => `<td style="${hucreRenk('hiz', h.wind_speed_10m[i])}">${yaz('hiz', h.wind_speed_10m[i], b, false)}</td>`)}
        ${sat('Hamle', i => `<td>${yaz('hiz', h.wind_gusts_10m[i], b, false)}</td>`, 'soluk')}
        ${sat('Yön', i => `<td>${ok(h.wind_direction_10m[i])}</td>`)}
        ${sat('Bulut', i => `<td style="${hucreRenk('bulut', h.cloud_cover[i])}">${h.cloud_cover[i] ?? ''}</td>`)}
        ${sat('Nem', i => `<td>${h.relative_humidity_2m[i] ?? ''}</td>`, 'soluk')}
        ${sat(birimAdi('basinc', b), i => `<td>${yaz('basinc', h.pressure_msl[i], b, false)}</td>`, 'soluk')}
      </table></div>`;
  }

  _gunluk() {
    const d = this.veri.daily, of = this.veri.utc_offset_seconds, b = this.ayar().birim;
    const enAz = Math.min(...d.temperature_2m_min), enCok = Math.max(...d.temperature_2m_max);
    return `<div class="gun-liste">${d.time.map((t, i) => {
      const z = yerelSaat(t, of), k = havaKodu(d.weather_code[i]);
      const sol = ((d.temperature_2m_min[i] - enAz) / (enCok - enAz || 1)) * 100;
      const gen = ((d.temperature_2m_max[i] - d.temperature_2m_min[i]) / (enCok - enAz || 1)) * 100;
      const [r1, g1, b1] = renkBul(OLCEKLER.sicaklik, d.temperature_2m_min[i]), [r2, g2, b2] = renkBul(OLCEKLER.sicaklik, d.temperature_2m_max[i]);
      return `<div class="gun">
        <div class="gun-ad"><b>${i === 0 ? 'Bugün' : z.gunAdi}</b><small>${z.tarih}</small></div>
        <div class="gun-simge" title="${k.ad}">${k.simge}</div>
        <div class="gun-sicak"><span>${yaz('sicaklik', d.temperature_2m_min[i], b)}</span>
          <div class="cubuk"><i style="left:${sol}%;width:${Math.max(4, gen)}%;background:linear-gradient(90deg,rgb(${r1},${g1},${b1}),rgb(${r2},${g2},${b2}))"></i></div>
          <span>${yaz('sicaklik', d.temperature_2m_max[i], b)}</span></div>
        <div class="gun-ek"><span>💧 ${d.precipitation_sum[i] > 0 ? yaz('yagis', d.precipitation_sum[i], b) : '–'}${d.precipitation_probability_max?.[i] != null ? ' · %' + d.precipitation_probability_max[i] : ''}</span>
          <span>${ok(d.wind_direction_10m_dominant[i])} ${yaz('hiz', d.wind_speed_10m_max[i], b)} (${yaz('hiz', d.wind_gusts_10m_max[i], b, false)})</span></div>
      </div>`;
    }).join('')}</div>`;
  }

  _grafikKutu() {
    return `<h4>Sıcaklık ve yağış</h4><canvas class="grafik" id="g1"></canvas>
      <div class="lejant"><i style="background:#ff9f43"></i>Sıcaklık <i style="background:#6fb1fc"></i>Yağış <i style="background:#aaa"></i>Hissedilen</div>
      <h4>Rüzgar</h4><canvas class="grafik" id="g2"></canvas>
      <div class="lejant"><i style="background:#4fd1a5"></i>Rüzgar <i style="background:#e8e8e8"></i>Hamle</div>
      <h4>Bulut (alçak / orta / yüksek)</h4><canvas class="grafik" id="g3"></canvas>
      <div class="lejant"><i style="background:#d9dde5"></i>Alçak <i style="background:#9aa4b5"></i>Orta <i style="background:#5d6880"></i>Yüksek</div>
      <h4>Basınç</h4><canvas class="grafik" id="g4"></canvas>`;
  }

  _grafikCiz() {
    const h = this.veri.hourly, of = this.veri.utc_offset_seconds, b = this.ayar().birim;
    const n = Math.min(h.time.length, 24 * 7), z = h.time.slice(0, n);
    const yerel = t => yerelSaat(t, of);
    const c = (dizi, tur) => dizi.slice(0, n).map(v => cevir(tur, v, b));
    grafikCiz(this.kok.querySelector('#g1'), z, [
      { tip: 'sutun', renk: 'rgba(111,177,252,0.8)', deger: c(h.precipitation, 'yagis'), eksen: 'sag' },
      { renk: '#aaa', deger: c(h.apparent_temperature, 'sicaklik'), kalin: 1, kesik: true },
      { renk: '#ff9f43', deger: c(h.temperature_2m, 'sicaklik') }
    ], { yerel, solBirim: '°', sagBirim: '' });
    grafikCiz(this.kok.querySelector('#g2'), z, [
      { renk: '#e8e8e8', deger: c(h.wind_gusts_10m, 'hiz'), kalin: 1 },
      { renk: '#4fd1a5', deger: c(h.wind_speed_10m, 'hiz') }
    ], { yerel, yukseklik: 140 });
    grafikCiz(this.kok.querySelector('#g3'), z, [
      { renk: '#5d6880', deger: h.cloud_cover_high.slice(0, n) },
      { renk: '#9aa4b5', deger: h.cloud_cover_mid.slice(0, n) },
      { renk: '#d9dde5', deger: h.cloud_cover_low.slice(0, n) }
    ], { yerel, yukseklik: 120, solBirim: '%', solUst: 100 });
    grafikCiz(this.kok.querySelector('#g4'), z, [{ renk: '#c39bff', deger: c(h.pressure_msl, 'basinc') }], { yerel, yukseklik: 110 });
  }

  _modeller() {
    const secenek = [['temperature_2m', 'Sıcaklık'], ['precipitation', 'Yağış'], ['wind_speed_10m', 'Rüzgar'], ['wind_gusts_10m', 'Hamle'], ['cloud_cover', 'Bulut']];
    const m = this.model, of = m.utc_offset_seconds, b = this.ayar().birim, h = m.hourly;
    const modeller = MODELLER.slice(1).filter(x => (h['temperature_2m_' + x.id] || []).some(v => v != null));
    // Günlük özet: her model için gün gün en yüksek/en düşük sıcaklık ve toplam yağış
    const gunler = [];
    h.time.forEach((t, i) => { const g = yerelSaat(t, of); let s = gunler.find(x => x.gun === g.gun); if (!s) gunler.push(s = { gun: g.gun, ad: g.gunKisa, i: [] }); s.i.push(i); });
    const ozet = (model, gun) => {
      const T = gun.i.map(i => h['temperature_2m_' + model.id][i]).filter(v => v != null);
      const P = gun.i.map(i => h['precipitation_' + model.id][i]).filter(v => v != null);
      if (!T.length) return '<td>–</td>';
      const top = P.reduce((a, x) => a + x, 0);
      return `<td><b>${yaz('sicaklik', Math.max(...T), b)}</b> <span class="soluk">${yaz('sicaklik', Math.min(...T), b)}</span><br><small>${top > 0.05 ? '💧' + yaz('yagis', top, b, false) : ''}</small></td>`;
    };
    return `<div class="adim-sec">${secenek.map(([id, ad]) => `<button data-modeldeg="${id}" class="${this.modelDeg === id ? 'secili' : ''}">${ad}</button>`).join('')}</div>
      <canvas class="grafik" id="gm"></canvas>
      <div class="lejant">${modeller.map((x, i) => `<i style="background:${MODEL_RENK[i]}"></i>${x.kisa}`).join(' ')}</div>
      <h4>Günlük karşılaştırma (en yüksek / en düşük, yağış)</h4>
      <div class="tablo-kap"><table class="saat-tablo model-tablo">
        <tr><th>Model</th>${gunler.map(g => `<td>${g.ad}</td>`).join('')}</tr>
        ${modeller.map((x, k) => `<tr><th><i class="nokta" style="background:${MODEL_RENK[k]}"></i>${x.kisa}</th>${gunler.map(g => ozet(x, g)).join('')}</tr>`).join('')}
      </table></div>`;
  }

  _modelGrafik() {
    const m = this.model, h = m.hourly, b = this.ayar().birim, d = this.modelDeg;
    const tur = d === 'temperature_2m' ? 'sicaklik' : d === 'precipitation' ? 'yagis' : d === 'cloud_cover' ? 'yuzde' : 'hiz';
    const modeller = MODELLER.slice(1).filter(x => (h['temperature_2m_' + x.id] || []).some(v => v != null));
    grafikCiz(this.kok.querySelector('#gm'), h.time, modeller.map((x, i) => ({
      renk: MODEL_RENK[i], kalin: 1.6, deger: (h[d + '_' + x.id] || []).map(v => cevir(tur, v, b))
    })), { yerel: t => yerelSaat(t, m.utc_offset_seconds), yukseklik: 200, solBirim: tur === 'sicaklik' ? '°' : '', solUst: tur === 'yuzde' ? 100 : null });
  }

  _deniz() {
    const d = this.deniz;
    if (!d || !d.hourly || !(d.hourly.wave_height || []).some(v => v != null)) return '<div class="bos-kutu">🏝️ Bu nokta karada. Deniz verisi için denizde bir noktaya dokun.</div>';
    const h = d.hourly, of = d.utc_offset_seconds, b = this.ayar().birim, simdi = Date.now() / 1000 - 3600;
    const idx = h.time.map((t, i) => i).filter(i => h.time[i] >= simdi && yerelSaat(h.time[i], of).saat % 3 === 0).slice(0, 40);
    const sat = (baslik, f, sinif = '') => `<tr class="${sinif}"><th>${baslik}</th>${idx.map(f).join('')}</tr>`;
    let onceki = null;
    return `<div class="tablo-kap"><table class="saat-tablo">
      ${sat('Gün', i => { const g = yerelSaat(h.time[i], of); const s = g.gun !== onceki ? g.gunKisa : ''; onceki = g.gun; return `<td class="gun-h">${s}</td>`; }, 'gun-satir')}
      ${sat('Saat', i => `<td>${yerelSaat(h.time[i], of).saat}</td>`, 'saat-satir')}
      ${sat('Dalga', i => `<td style="${hucreRenk('dalga', h.wave_height[i])}">${yaz('uzunluk', h.wave_height[i], b, false)}</td>`)}
      ${sat('Yön', i => `<td>${ok(h.wave_direction[i])}</td>`)}
      ${sat('Periyot', i => `<td>${yaz('periyot', h.wave_period[i], b, false)}</td>`, 'soluk')}
      ${sat('R. dalgası', i => `<td>${yaz('uzunluk', h.wind_wave_height[i], b, false)}</td>`)}
      ${sat('Soluğan', i => `<td style="${hucreRenk('dalga', h.swell_wave_height[i])}">${yaz('uzunluk', h.swell_wave_height[i], b, false)}</td>`)}
      ${sat('S. yön', i => `<td>${ok(h.swell_wave_direction[i])}</td>`)}
      ${sat('S. periyot', i => `<td>${yaz('periyot', h.swell_wave_period[i], b, false)}</td>`, 'soluk')}
      ${sat('Su °', i => `<td style="${hucreRenk('denizSicaklik', h.sea_surface_temperature[i])}">${yaz('sicaklik', h.sea_surface_temperature[i], b, false)}</td>`)}
      ${sat('Akıntı', i => `<td>${yaz('akinti', h.ocean_current_velocity[i] / 3.6, b, false)}</td>`, 'soluk')}
      ${sat('A. yön', i => `<td>${h.ocean_current_direction[i] == null ? '' : ok(h.ocean_current_direction[i] + 180)}</td>`)}
    </table></div><p class="kaynak">Birimler: dalga ${birimAdi('uzunluk', b)}, periyot sn, akıntı ${birimAdi('akinti', b)}.</p>`;
  }

  _kalite() {
    const a = this.hava;
    if (!a || !a.hourly) return '<div class="bos-kutu">Hava kalitesi verisi alınamadı.</div>';
    const h = a.hourly, of = a.utc_offset_seconds, simdi = Date.now() / 1000;
    const si = Math.max(0, h.time.findIndex(t => t >= simdi - 1800));
    const aqi = h.european_aqi[si];
    const [r, g, bb] = renkBul(OLCEKLER.aqi, aqi);
    const idx = h.time.map((t, i) => i).filter(i => h.time[i] >= simdi - 3600 && yerelSaat(h.time[i], of).saat % 3 === 0).slice(0, 40);
    const sat = (baslik, d, olcek) => `<tr><th>${baslik}</th>${idx.map(i => `<td style="${olcek ? hucreRenk(olcek, h[d][i]) : ''}">${h[d]?.[i] == null ? '' : Math.round(h[d][i])}</td>`).join('')}</tr>`;
    const polen = ['alder_pollen', 'birch_pollen', 'grass_pollen', 'olive_pollen', 'ragweed_pollen'];
    const polenAd = { alder_pollen: 'Kızılağaç', birch_pollen: 'Huş', grass_pollen: 'Çimen', olive_pollen: 'Zeytin', ragweed_pollen: 'Pelinotu' };
    const polenVar = polen.filter(p => (h[p] || []).some(v => v != null));
    let onceki = null;
    return `<div class="aqi-kutu" style="background:rgba(${r},${g},${bb},0.25);border-color:rgb(${r},${g},${bb})">
        <span class="aqi-sayi">${aqi == null ? '–' : Math.round(aqi)}</span><div><b>${AQI_AD(aqi)}</b><small>Avrupa hava kalitesi endeksi (0 iyi, 100+ çok kötü)</small></div></div>
      <div class="tablo-kap"><table class="saat-tablo">
        <tr class="gun-satir"><th>Gün</th>${idx.map(i => { const z = yerelSaat(h.time[i], of); const s = z.gun !== onceki ? z.gunKisa : ''; onceki = z.gun; return `<td class="gun-h">${s}</td>`; }).join('')}</tr>
        <tr class="saat-satir"><th>Saat</th>${idx.map(i => `<td>${yerelSaat(h.time[i], of).saat}</td>`).join('')}</tr>
        ${sat('Endeks', 'european_aqi', 'aqi')}
        ${sat('PM2.5', 'pm2_5', 'pm')}
        ${sat('PM10', 'pm10', 'pm')}
        ${sat('Toz', 'dust', 'toz')}
        ${sat('Ozon', 'ozone', 'ozon')}
        ${sat('NO₂', 'nitrogen_dioxide', 'no2')}
        ${sat('UV', 'uv_index', 'uv')}
        ${polenVar.map(p => sat(polenAd[p], p)).join('')}
      </table></div><p class="kaynak">µg/m³ · ${polenVar.length ? 'Polen: tane/m³ (yalnız Avrupa)' : 'Polen verisi yalnız Avrupa için var.'} · Veri: CAMS / Open-Meteo</p>`;
  }

  _gunes() {
    const d = this.veri.daily, of = this.veri.utc_offset_seconds;
    return `<div class="gun-liste">${d.time.map((t, i) => {
      const z = yerelSaat(t, of), dog = yerelSaat(d.sunrise[i], of), bat = yerelSaat(d.sunset[i], of);
      const sure = d.daylight_duration[i] / 3600;
      return `<div class="gun gunes-satir"><div class="gun-ad"><b>${i === 0 ? 'Bugün' : z.gunAdi}</b><small>${z.tarih}</small></div>
        <span>🌅 ${dog.saatDk}</span><span>🌇 ${bat.saatDk}</span><span class="soluk">${Math.floor(sure)} sa ${Math.round((sure % 1) * 60)} dk</span><span>UV ${d.uv_index_max[i] == null ? '–' : Math.round(d.uv_index_max[i])}</span></div>`;
    }).join('')}</div>`;
  }

  _tik(e) {
    const el = e.target.closest('button');
    if (!el) return;
    if (el.dataset.is === 'kapat') return this.kapat();
    if (el.dataset.is === 'favori') { this.favoriDegistir(this.yer); el.textContent = this.favoriMi(this.yer) ? '★' : '☆'; return; }
    if (el.dataset.sekme) {
      this.sekme = el.dataset.sekme;
      this.kok.querySelectorAll('[data-sekme]').forEach(b => b.classList.toggle('secili', b === el));
      this._sekmeCiz();
    }
    if (el.dataset.adim) { this.adim = +el.dataset.adim; this._sekmeCiz(); }
    if (el.dataset.modeldeg) { this.modelDeg = el.dataset.modeldeg; this._sekmeCiz(); }
  }
}
