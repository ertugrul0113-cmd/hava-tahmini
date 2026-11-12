// Hava Tahmini — ana ekran
import { KATMANLAR, HIZLI, SEVIYELER, MODELLER, katmanBul, akisDegiskenleri } from './katmanlar.js';
import { OLCEKLER, renkTablosu } from './olcek.js';
import { adimSec, izgaraKur, izgaraNoktalari, dilimKur, akisDilimi, aradeger } from './izgara.js';
import { izgaraVerisi, yerAra, yerAdi, radarKareleri, noktaTahmini, KotaHatasi, beklemeDinle } from './veri.js';
import { Tuval, renkCiz, Parcacik, izobarCiz } from './harita-cizim.js';
import { TahminSayfasi, yerelSaat } from './tahmin.js';
import { VARSAYILAN_BIRIM, BIRIM_SECENEK, yaz, birimAdi, cevir, yonAdi } from './birim.js';
import { uyarilariBul } from './uyari.js';

/* global L */
export const SURUM = '0.1';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const oku = (k, v) => { try { const x = localStorage.getItem(k); return x ? JSON.parse(x) : v; } catch { return v; } };
const sakla = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* özel pencere */ } };

const ayar = Object.assign({
  katman: 'ruzgar', seviye: 'yuzey', model: 'best_match', parcacik: true, izobar: false, yogunluk: 1, saydamlik: 0.8
}, oku('ht-ayar', {}));
ayar.birim = Object.assign({}, VARSAYILAN_BIRIM, ayar.birim || {});
const ayarKaydet = () => sakla('ht-ayar', ayar);
let favoriler = oku('ht-favori', []);

// ---------------- Harita ----------------
const gorunum = oku('ht-gorunum', { lat: 39.2, lon: 35.2, z: 6 });
const map = L.map('harita', { zoomControl: false, worldCopyJump: false, minZoom: 2, maxZoom: 12, attributionControl: true })
  .setView([gorunum.lat, gorunum.lon], gorunum.z);
map.attributionControl.setPrefix(false);
const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/';
L.tileLayer(ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 16, attribution: 'Harita © Esri, HERE, Garmin, © OpenStreetMap'
}).addTo(map);
map.createPane('karoPane').style.zIndex = 340;
map.createPane('etiketPane').style.zIndex = 420;
map.getPane('etiketPane').style.pointerEvents = 'none';
L.tileLayer(ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 16, pane: 'etiketPane'
}).addTo(map);

const tuval = new Tuval(map);
const parcacik = new Parcacik(tuval);
parcacik.yogunluk = ayar.yogunluk;

// ---------------- Zaman ----------------
const SAAT = 3600;
const bugun0 = () => Math.floor(Date.now() / 1000 / 86400) * 86400;
let zaman = Math.floor(Date.now() / 1000 / SAAT) * SAAT;
let oynuyor = null;

// ---------------- Durum ----------------
let alanBilgi = null; // { iz, noktalar, seriler, akis }
let yuklemeNo = 0;
let karoKatman = null;
let radar = null; // { host, kareler, katmanlar, i }

function bildir(metin, sure = 3500) {
  const el = $('#bildirim');
  el.textContent = metin; el.hidden = false;
  clearTimeout(bildir.z);
  bildir.z = setTimeout(() => { el.hidden = true; }, sure);
}
function yukleniyor(evet) { $('#yukleniyor').hidden = !evet; }
beklemeDinle(() => bildir('Çok hızlı veri istendi, 20 saniye bekleniyor…', 20000));

function gecerliSeviye(k) {
  if (k.tur !== 'izgara') return 'yuzey';
  return k.degisken(ayar.seviye) ? ayar.seviye : 'yuzey';
}

// Görünen alanın verisini getir ve çiz
async function veriYukle() {
  const k = katmanBul(ayar.katman);
  const no = ++yuklemeNo;
  const b = map.getBounds();
  const adim = adimSec(b.getSouth(), b.getNorth(), b.getWest(), b.getEast());
  const iz = izgaraKur(b.getSouth(), b.getNorth(), b.getWest(), b.getEast(), adim);
  const noktalar = izgaraNoktalari(iz);
  const seviye = gecerliSeviye(k);
  const akisTip = ayar.parcacik ? (k.parcacik === 'ruzgar' || k.parcacik === 'akinti' || k.parcacik === 'dalga' ? k.parcacik : null) : null;
  const akis = akisTip ? akisDegiskenleri(akisTip, k.parcacik === 'ruzgar' ? seviye : 'yuzey') : null;

  // Aynı kaynaktan gereken tüm değişkenler tek istekte
  const gerek = {};
  const ekle = (kaynak, d) => { (gerek[kaynak] = gerek[kaynak] || []).includes(d) || gerek[kaynak].push(d); };
  if (k.tur === 'izgara') ekle(k.kaynak, k.degisken(seviye));
  if (akis) { ekle(akis.kaynak, akis.hiz); ekle(akis.kaynak, akis.yon); }
  if (ayar.izobar) ekle('hava', 'pressure_msl');

  yukleniyor(true);
  try {
    const sonuc = {};
    for (const [kaynak, degler] of Object.entries(gerek)) {
      const h = await izgaraVerisi(kaynak, ayar.model, degler, noktalar);
      if (no !== yuklemeNo) return;
      degler.forEach((d, i) => { sonuc[kaynak + '|' + d] = h[i]; });
    }
    const deger = k.tur === 'izgara' ? sonuc[k.kaynak + '|' + k.degisken(seviye)] : null;
    const akisVeri = akis ? [sonuc[akis.kaynak + '|' + akis.hiz], sonuc[akis.kaynak + '|' + akis.yon]] : null;
    alanBilgi = { k, iz, noktalar, deger, akis, akisVeri, basinc: ayar.izobar ? sonuc['hava|pressure_msl'] : null };
    if (deger) {
      const herhangi = noktalar.some(p => { const s = deger.get(p.anahtar); return s && s.veri.some(v => !Number.isNaN(v)); });
      if (!herhangi) bildir(k.kaynak === 'deniz' ? 'Bu bölgede deniz verisi yok.' : 'Bu model veya seviye için bu katmanın verisi yok.');
    }
    ciz();
  } catch (e) {
    if (no !== yuklemeNo) return;
    bildir(e instanceof KotaHatasi ? e.message : 'Veri alınamadı: ' + e.message, 6000);
  } finally {
    if (no === yuklemeNo) yukleniyor(false);
  }
}

let renkler = {};
const tabloAl = ad => renkler[ad] || (renkler[ad] = renkTablosu(OLCEKLER[ad]));

function dilimAl() {
  const a = alanBilgi;
  if (!a || !a.deger) return null;
  return dilimKur(a.iz, a.noktalar, a.deger, zaman, a.k.carpan || 1);
}

function ciz(sadeceRenk = false) {
  const a = alanBilgi;
  tuval.konumla();
  if (!a) return;
  const dilim = dilimAl();
  renkCiz(tuval, a.k.tur === 'izgara' ? dilim : null, tabloAl(a.k.olcek || 'hiz'));
  tuval.renk.style.opacity = ayar.saydamlik;
  if (ayar.izobar && a.basinc) {
    const p = dilimKur(a.iz, a.noktalar, a.basinc, zaman);
    izobarCiz(tuval, p, v => yaz('basinc', v, ayar.birim, false));
  } else izobarCiz(tuval, null);
  if (a.akis && a.akisVeri) {
    const { u, v } = akisDilimi(a.iz, a.noktalar, a.akisVeri[0], a.akisVeri[1], zaman, a.akis.yonTipi, a.akis.carpan);
    parcacik.ayarla(u, v);
    if (!sadeceRenk || !parcacik.calisiyor) parcacik.basla();
  } else parcacik.dur();
  seciciGuncelle();
}

// Harita hareketinde
map.on('movestart zoomstart', () => { parcacik.dur(); });
map.on('zoomstart', () => tuval.gizle(true));
map.on('zoomend', () => tuval.gizle(false));
let hareketZ;
map.on('moveend', () => {
  const c = map.getCenter();
  sakla('ht-gorunum', { lat: c.lat, lon: c.lng, z: map.getZoom() });
  ciz();
  clearTimeout(hareketZ);
  hareketZ = setTimeout(veriYukle, 300);
});
map.on('resize', () => { tuval.boyutla(); ciz(); });

// ---------------- Karo katmanlar (radar, uydu, yıldırım) ----------------
const EUMETSAT = 'https://view.eumetsat.int/geoserver/ows';
function wms(katman, ek = {}) {
  return L.tileLayer.wms(EUMETSAT, Object.assign({
    layers: katman, format: 'image/png', transparent: true, version: '1.3.0', pane: 'karoPane',
    attribution: '© EUMETSAT', tileSize: 512, zoomOffset: -1, maxZoom: 12
  }, ek));
}
function dunDun() {
  const d = new Date(Date.now() - 86400000 * 1.2);
  return d.toISOString().slice(0, 10);
}

async function karoKur(k) {
  karoKaldir();
  if (k.id === 'radar') {
    try {
      const r = await radarKareleri();
      if (ayar.katman !== 'radar') return;
      radar = { ...r, katmanlar: r.kareler.map(() => null), i: r.kareler.length - 1 };
      radarGoster(radar.i);
      zamanCiz();
    } catch (e) { bildir('Radar alınamadı: ' + e.message); }
    return;
  }
  if (k.id === 'uydu') karoKatman = wms('mtg_fd:rgb_geocolour', { opacity: 0.95 });
  else if (k.id === 'uyduKizil') karoKatman = wms('mtg_fd:ir105_hrfi', { opacity: 0.85 });
  else if (k.id === 'uyduDunya') karoKatman = L.tileLayer(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${dunDun()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`, {
    pane: 'karoPane', maxNativeZoom: 9, maxZoom: 12, attribution: 'NASA GIBS', opacity: 0.95
  });
  else if (k.id === 'yildirim') karoKatman = L.layerGroup([wms('mtg_fd:ir105_hrfi', { opacity: 0.35 }), wms('mtg_fd:li_afa', { opacity: 1 })]);
  if (karoKatman) karoKatman.addTo(map);
}
function karoKaldir() {
  if (karoKatman) { map.removeLayer(karoKatman); karoKatman = null; }
  if (radar) { radar.katmanlar.forEach(l => l && map.removeLayer(l)); radar = null; }
}
function radarKatmani(i) {
  if (!radar.katmanlar[i]) {
    const k = radar.kareler[i];
    radar.katmanlar[i] = L.tileLayer(`${radar.host}${k.path}/256/{z}/{x}/{y}/2/1_1.png`, {
      pane: 'karoPane', maxNativeZoom: 7, maxZoom: 12, opacity: 0, attribution: 'RainViewer'
    }).addTo(map);
  }
  return radar.katmanlar[i];
}
function radarGoster(i) {
  radar.i = i;
  radarKatmani(i).setOpacity(0.85);
  radar.katmanlar.forEach((l, j) => { if (l && j !== i) l.setOpacity(0); });
  // bir sonrakini önceden yükle
  if (i + 1 < radar.kareler.length) radarKatmani(i + 1);
}
// Uydu/yıldırım 10 dakikada bir yenilensin
setInterval(() => {
  if (karoKatman && karoKatman.setParams) karoKatman.setParams({ _t: Date.now() });
  if (karoKatman && karoKatman.eachLayer) karoKatman.eachLayer(l => l.setParams && l.setParams({ _t: Date.now() }));
}, 10 * 60 * 1000);

// ---------------- Katman seçimi ----------------
function katmanSec(id) {
  const k = katmanBul(id);
  ayar.katman = id; ayarKaydet();
  karoKaldir();
  if (k.tur === 'karo') { renkCiz(tuval, null); izobarCiz(tuval, null); parcacik.dur(); alanBilgi = null; karoKur(k); }
  if (oynuyor) oynatDur();
  hizliCiz(); seviyeCiz(); gostergeCiz(); zamanCiz();
  if (k.tur === 'izgara') { alanBilgi = null; renkCiz(tuval, null); veriYukle(); }
  else if (ayar.izobar) veriYukle();
}

function hizliCiz() {
  const secili = katmanBul(ayar.katman);
  const liste = HIZLI.includes(secili.id) ? HIZLI : [...HIZLI.slice(0, -1), secili.id];
  $('#katmanSerit').innerHTML = liste.map(id => {
    const k = katmanBul(id);
    return `<button data-katman="${id}" class="${id === secili.id ? 'secili' : ''}"><span>${k.ikon}</span><small>${esc(k.ad.split(' (')[0])}</small></button>`;
  }).join('') + '<button data-is="katmanlar"><span>☰</span><small>Daha fazla</small></button>';
}

function seviyeCiz() {
  const k = katmanBul(ayar.katman);
  const el = $('#seviyeSerit');
  if (k.tur !== 'izgara') { el.hidden = true; return; }
  const uygun = SEVIYELER.filter(s => k.degisken(s.id));
  if (uygun.length < 2) { el.hidden = true; return; }
  const s = gecerliSeviye(k);
  el.hidden = false;
  if (!seviyeCiz.acik) {
    const x = SEVIYELER.find(z => z.id === s);
    el.innerHTML = `<button data-seviye-ac class="secili">⇕ ${x.kisa}</button>`;
    return;
  }
  el.innerHTML = [...uygun].reverse().map(x => `<button data-seviye="${x.id}" class="${x.id === s ? 'secili' : ''}">${x.kisa}</button>`).join('');
}

function gostergeCiz() {
  const k = katmanBul(ayar.katman);
  const el = $('#gosterge');
  if (k.tur === 'karo' && !['radar', 'yildirim'].includes(k.id)) {
    el.innerHTML = `<span class="gosterge-ad">${esc(k.ad)}</span><span class="gosterge-not">${k.id === 'uyduDunya' ? 'Dünkü görüntü' : 'Avrupa, Afrika, Orta Doğu · ~15 dk gecikme'}</span>`;
    return;
  }
  const olcek = OLCEKLER[k.olcek];
  const min = olcek[0][0], max = olcek[olcek.length - 1][0];
  const duraklar = olcek.map(d => `rgba(${d[1]},${d[2]},${d[3]},${Math.max(d[4], 0.15)}) ${((d[0] - min) / (max - min) * 100).toFixed(1)}%`).join(',');
  let etiketler;
  if (k.id === 'radar') etiketler = ['hafif', 'orta', 'kuvvetli', 'şiddetli'];
  else if (k.id === 'yildirim') etiketler = ['son 10 dk', '', 'yoğun'];
  else {
    const adet = 5;
    etiketler = Array.from({ length: adet }, (_, i) => {
      const v = min + (max - min) * i / (adet - 1);
      return yaz(k.birim, v, ayar.birim, false);
    });
  }
  const birim = k.birim ? birimAdi(k.birim, ayar.birim) : '';
  el.innerHTML = `<span class="gosterge-ad">${esc(k.ad)}${birim && k.tur === 'izgara' ? ' · ' + birim : ''}</span>
    <div class="gosterge-cubuk" style="background:linear-gradient(90deg,${duraklar})"></div>
    <div class="gosterge-etiket">${etiketler.map(e => `<span>${e}</span>`).join('')}</div>`;
}

// ---------------- Zaman çubuğu ----------------
const GUN_K = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
function aralik() {
  const k = katmanBul(ayar.katman);
  if (k.id === 'radar' && radar) return { radar: true, bas: radar.kareler[0].time, son: radar.kareler[radar.kareler.length - 1].time };
  if (k.tur === 'karo') return null;
  const gun = k.kaynak === 'hava_kalitesi' ? 5 : 7;
  return { bas: bugun0(), son: bugun0() + gun * 86400 - SAAT };
}
function zamanCiz() {
  const a = aralik();
  const el = $('#zamanCubugu');
  el.hidden = !a;
  if (!a) return;
  if (!a.radar) zaman = Math.min(Math.max(zaman, a.bas), a.son);
  const gunler = $('#gunler');
  if (a.radar) {
    gunler.innerHTML = radar.kareler.map((k, i) => `<span class="radar-cizgi${k.tahmin ? ' tahmin' : ''}" style="left:${i / (radar.kareler.length - 1) * 100}%"></span>`).join('')
      + `<span class="radar-not">Son ${Math.round((a.son - a.bas) / 60)} dakika</span>`;
  } else {
    let html = '';
    const d = new Date(a.bas * 1000); d.setHours(0, 0, 0, 0);
    for (let t = d.getTime() / 1000; t <= a.son; t += 86400) {
      const g = new Date(t * 1000); g.setHours(0, 0, 0, 0);
      const bas = Math.max(g.getTime() / 1000, a.bas), sonG = Math.min(g.getTime() / 1000 + 86400, a.son + SAAT);
      if (sonG <= bas) continue;
      const sol = (bas - a.bas) / (a.son + SAAT - a.bas) * 100, gen = (sonG - bas) / (a.son + SAAT - a.bas) * 100;
      html += `<span class="gun-dilim" style="left:${sol}%;width:${gen}%">${gen > 6 ? GUN_K[g.getDay()] + ' ' + g.getDate() : ''}</span>`;
      t = g.getTime() / 1000; // yaz saati kaymasına karşı
    }
    gunler.innerHTML = html;
  }
  imlecCiz();
}
function imlecCiz() {
  const a = aralik();
  if (!a) return;
  let oran, etiket;
  if (a.radar) {
    oran = radar.i / Math.max(1, radar.kareler.length - 1);
    const t = radar.kareler[radar.i].time;
    const d = new Date(t * 1000);
    etiket = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const fark = Math.round((Date.now() / 1000 - t) / 60);
    etiket += fark > 3 ? ` · ${fark} dk önce` : ' · şimdi';
  } else {
    oran = (zaman - a.bas) / (a.son + SAAT - a.bas);
    const d = new Date(zaman * 1000);
    etiket = `${GUN_K[d.getDay()]} ${d.getDate()} · ${String(d.getHours()).padStart(2, '0')}:00`;
  }
  const imlec = $('#imlec');
  imlec.style.left = (oran * 100) + '%';
  const et = $('#zamanEtiket');
  et.textContent = etiket;
  // Etiket kenarlardan taşmasın
  const izGen = $('#zamanIz').clientWidth, etGen = et.offsetWidth;
  const x = oran * izGen;
  const kay = Math.min(Math.max(-etGen / 2, -x), izGen - x - etGen);
  et.style.transform = `translateX(${kay}px)`;
  const ss = $('#simdiCizgi');
  if (!a.radar) {
    const so = (Date.now() / 1000 - a.bas) / (a.son + SAAT - a.bas);
    ss.hidden = so < 0 || so > 1; ss.style.left = (so * 100) + '%';
  } else ss.hidden = true;
}
function zamanAyarla(oran, yuvarla = true) {
  const a = aralik();
  if (!a) return;
  oran = Math.min(1, Math.max(0, oran));
  if (a.radar) {
    const i = Math.round(oran * (radar.kareler.length - 1));
    if (i !== radar.i) radarGoster(i);
    imlecCiz();
    return;
  }
  let t = a.bas + oran * (a.son + SAAT - a.bas);
  t = yuvarla ? Math.round(t / SAAT) * SAAT : t;
  zaman = Math.min(a.son, Math.max(a.bas, t));
  imlecCiz();
  ciz(true);
}
(function zamanSurukle() {
  const iz = $('#zamanIz');
  let basili = false;
  const oran = e => { const r = iz.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  iz.addEventListener('pointerdown', e => { basili = true; iz.setPointerCapture(e.pointerId); if (oynuyor) oynatDur(); zamanAyarla(oran(e)); });
  iz.addEventListener('pointermove', e => { if (basili) zamanAyarla(oran(e)); });
  const bit = e => { if (!basili) return; basili = false; zamanAyarla(oran(e)); };
  iz.addEventListener('pointerup', bit);
  iz.addEventListener('pointercancel', bit);
})();
function oynatDur() { clearInterval(oynuyor); oynuyor = null; $('#oynatBtn').textContent = '▶'; }
$('#oynatBtn').addEventListener('click', () => {
  if (oynuyor) return oynatDur();
  $('#oynatBtn').textContent = '❚❚';
  oynuyor = setInterval(() => {
    const a = aralik();
    if (!a) return oynatDur();
    if (a.radar) { radarGoster((radar.i + 1) % radar.kareler.length); imlecCiz(); return; }
    zaman = zaman + SAAT > a.son ? a.bas : zaman + SAAT;
    imlecCiz(); ciz(true);
  }, katmanBul(ayar.katman).id === 'radar' ? 600 : 700);
});

// ---------------- Nokta seçici (dokununca değer balonu) ----------------
let secici = null;
map.on('click', e => {
  const ll = e.latlng;
  if (secici) map.removeLayer(secici);
  secici = L.marker(ll, { icon: L.divIcon({ className: 'secici-kap', html: '<div class="secici"></div>', iconSize: [0, 0] }), keyboard: false }).addTo(map);
  secici.yer = { lat: ll.lat, lon: ((ll.lng + 540) % 360) - 180, ad: '', alt: '' };
  secici.on('click', () => tahminAc(secici.yer));
  seciciGuncelle();
  yerAdi(secici.yer.lat, secici.yer.lon).then(y => { if (secici && secici.yer.lat === ll.lat) { Object.assign(secici.yer, y); seciciGuncelle(); } });
});
function seciciGuncelle() {
  if (!secici) return;
  const el = secici.getElement()?.querySelector('.secici');
  if (!el) return;
  const k = katmanBul(ayar.katman), a = alanBilgi;
  let deger = '';
  if (a && a.deger && k.tur === 'izgara') {
    const d = dilimAl();
    const ll = secici.getLatLng();
    const v = d ? aradeger(d, ll.lat, ll.lng) : NaN;
    deger = Number.isNaN(v) ? '–' : yaz(k.birim, v, ayar.birim);
    if (a.akis && a.akisVeri && (k.parcacik === 'ruzgar' && (k.id === 'ruzgar'))) {
      const { u, v: vv } = akisDilimi(a.iz, a.noktalar, a.akisVeri[0], a.akisVeri[1], zaman, a.akis.yonTipi, 1);
      const uu = aradeger(u, ll.lat, ll.lng), v2 = aradeger(vv, ll.lat, ll.lng);
      if (!Number.isNaN(uu)) {
        const yon = (Math.atan2(-uu, -v2) * 180 / Math.PI + 360) % 360;
        deger = `<span class="ok" style="transform:rotate(${Math.round(yon)}deg)">↓</span> ` + deger + ' ' + yonAdi(yon);
      }
    }
  }
  el.innerHTML = `<b>${deger || esc(secici.yer.ad || 'Seçilen nokta')}</b><small>${deger ? esc(secici.yer.ad || '') + ' · ' : ''}Tahmin ›</small>`;
}

// ---------------- Sayfalar ----------------
function sayfaAc(id) {
  document.querySelectorAll('.sayfa').forEach(s => s.classList.toggle('acik', s.id === id));
  $('#perde').hidden = false;
}
function sayfaKapat() {
  document.querySelectorAll('.sayfa').forEach(s => s.classList.remove('acik'));
  $('#perde').hidden = true;
}
$('#perde').addEventListener('click', sayfaKapat);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-kapat]');
  if (b) sayfaKapat();
});

const favoriAnahtar = y => y.lat.toFixed(3) + ',' + y.lon.toFixed(3);
const tahmin = new TahminSayfasi($('#tahminSayfa'), {
  ayar: () => ayar,
  favoriMi: y => favoriler.some(f => favoriAnahtar(f) === favoriAnahtar(y)),
  favoriDegistir: y => {
    const k = favoriAnahtar(y);
    if (favoriler.some(f => favoriAnahtar(f) === k)) favoriler = favoriler.filter(f => favoriAnahtar(f) !== k);
    else favoriler.push({ ad: y.ad || 'Favori', alt: y.alt || '', lat: y.lat, lon: y.lon });
    sakla('ht-favori', favoriler);
    favoriIsaretleri();
  },
  kapat: sayfaKapat
});
function tahminAc(yer) { sayfaAc('tahminSayfa'); tahmin.ac(yer); }

// Katmanlar sayfası
function katmanSayfaCiz() {
  const gruplar = [...new Set(KATMANLAR.map(k => k.grup))];
  $('#katmanListe').innerHTML = gruplar.map(g => `<h4>${g}</h4><div class="katman-izgara">${KATMANLAR.filter(k => k.grup === g).map(k =>
    `<button data-katman="${k.id}" class="${k.id === ayar.katman ? 'secili' : ''}"><span>${k.ikon}</span>${esc(k.ad)}</button>`).join('')}</div>`).join('')
    + `<h4>Harita üstü</h4><div class="anahtar-liste">
      <label><input type="checkbox" id="parcacikAc" ${ayar.parcacik ? 'checked' : ''}> Hareketli akış çizgileri</label>
      <label><input type="checkbox" id="izobarAc" ${ayar.izobar ? 'checked' : ''}> Basınç çizgileri (izobar)</label></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-katman]');
  if (b) { katmanSec(b.dataset.katman); if (b.closest('#katmanSayfa')) { sayfaKapat(); } return; }
  const s = e.target.closest('[data-seviye]');
  if (e.target.closest('[data-seviye-ac]')) { seviyeCiz.acik = true; seviyeCiz(); return; }
  if (s) { ayar.seviye = s.dataset.seviye; ayarKaydet(); seviyeCiz.acik = false; seviyeCiz(); alanBilgi = null; renkCiz(tuval, null); veriYukle(); return; }
  const is = e.target.closest('[data-is]');
  if (is && is.dataset.is === 'katmanlar') { katmanSayfaCiz(); sayfaAc('katmanSayfa'); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'parcacikAc') { ayar.parcacik = e.target.checked; ayarKaydet(); veriYukle(); }
  if (e.target.id === 'izobarAc') { ayar.izobar = e.target.checked; ayarKaydet(); if (!ayar.izobar) izobarCiz(tuval, null); veriYukle(); }
});

// Arama sayfası
let aramaZ;
$('#araBtn').addEventListener('click', () => { aramaCiz([]); sayfaAc('araSayfa'); setTimeout(() => $('#araKutu').focus(), 250); });
$('#araKutu').addEventListener('input', e => {
  clearTimeout(aramaZ);
  const q = e.target.value.trim();
  if (q.length < 2) return aramaCiz([]);
  aramaZ = setTimeout(async () => {
    try { aramaCiz(await yerAra(q), true); } catch (er) { $('#araSonuc').innerHTML = `<p class="hata-kutu">${esc(er.message)}</p>`; }
  }, 300);
});
function aramaCiz(sonuc, arandi = false) {
  const satir = (y, i, tur) => `<button class="yer-satir" data-yer="${tur}:${i}"><b>${esc(y.ad)}</b><small>${esc(y.alt)}</small></button>`;
  aramaCiz.sonuc = sonuc;
  $('#araSonuc').innerHTML = (arandi ? (sonuc.length ? sonuc.map((y, i) => satir(y, i, 's')).join('') : '<p class="bos-kutu">Bulunamadı.</p>') : '')
    + (!arandi ? `<button class="yer-satir" data-yer="konum"><b>📍 Konumum</b><small>Bulunduğun yerin tahmini</small></button>`
      + (favoriler.length ? '<h4>Favoriler</h4>' + favoriler.map((y, i) => satir({ ...y, ad: '★ ' + y.ad }, i, 'f')).join('') : '<p class="bos-kutu">Bir yerin tahmininde ☆ işaretine basarak favorilere ekleyebilirsin.</p>') : '');
}
$('#araSonuc').addEventListener('click', e => {
  const b = e.target.closest('[data-yer]');
  if (!b) return;
  if (b.dataset.yer === 'konum') return konumaGit(true);
  const [tur, i] = b.dataset.yer.split(':');
  const y = tur === 'f' ? favoriler[+i] : aramaCiz.sonuc[+i];
  $('#araKutu').value = '';
  map.setView([y.lat, y.lon], Math.max(map.getZoom(), 8));
  tahminAc({ ...y });
});

// Konum
let konumIsaret = null;
function konumaGit(tahminleAc = false) {
  if (!navigator.geolocation) return bildir('Bu cihaz konum vermiyor.');
  yukleniyor(true);
  navigator.geolocation.getCurrentPosition(p => {
    yukleniyor(false);
    const ll = [p.coords.latitude, p.coords.longitude];
    if (konumIsaret) map.removeLayer(konumIsaret);
    konumIsaret = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#3d8bff', fillOpacity: 1 }).addTo(map);
    map.setView(ll, Math.max(map.getZoom(), 8));
    if (tahminleAc) yerAdi(ll[0], ll[1]).then(y => tahminAc({ lat: ll[0], lon: ll[1], ...y }));
  }, () => { yukleniyor(false); bildir('Konum izni verilmedi. iPhone Ayarlar › Gizlilik › Konum Servisleri › Safari’den izin verebilirsin.', 6000); },
  { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}
$('#konumBtn').addEventListener('click', () => konumaGit(false));

// Favori işaretleri
let favoriKatman = L.layerGroup().addTo(map);
function favoriIsaretleri() {
  favoriKatman.clearLayers();
  for (const f of favoriler) {
    L.marker([f.lat, f.lon], { icon: L.divIcon({ className: 'favori-isaret', html: `<span>★ ${esc(f.ad)}</span>`, iconSize: [0, 0] }) })
      .on('click', () => tahminAc({ ...f })).addTo(favoriKatman);
  }
}

// Model seçimi
function modelSayfaCiz() {
  $('#modelListe').innerHTML = MODELLER.map(m => `<button class="yer-satir ${m.id === ayar.model ? 'secili' : ''}" data-model="${m.id}"><b>${m.ad}</b></button>`).join('')
    + '<p class="kaynak">Harita ve tahmin seçilen modelle gösterilir. “En iyi” seçeneği bölgene göre en uygun modeli kendisi seçer. Tüm modelleri yan yana görmek için bir noktaya dokun › Modeller.</p>';
}
$('#modelBtn').addEventListener('click', () => { modelSayfaCiz(); sayfaAc('modelSayfa'); });
$('#modelListe').addEventListener('click', e => {
  const b = e.target.closest('[data-model]');
  if (!b) return;
  ayar.model = b.dataset.model; ayarKaydet(); modelYaz(); sayfaKapat();
  alanBilgi = null; renkCiz(tuval, null); veriYukle();
});
function modelYaz() { $('#modelBtn').textContent = (MODELLER.find(m => m.id === ayar.model) || MODELLER[0]).kisa; }

// Ayarlar
function ayarSayfaCiz() {
  const sec = (tur, baslik) => `<label class="ayar-satir"><span>${baslik}</span><select data-birim="${tur}">${BIRIM_SECENEK[tur].map(([id, ad]) => `<option value="${id}" ${ayar.birim[tur] === id ? 'selected' : ''}>${ad}</option>`).join('')}</select></label>`;
  $('#ayarIcerik').innerHTML = `
    <h4>Birimler</h4>
    ${sec('hiz', 'Rüzgar')}${sec('sicaklik', 'Sıcaklık')}${sec('yagis', 'Yağış')}${sec('basinc', 'Basınç')}${sec('uzunluk', 'Dalga / yükseklik')}
    <h4>Harita</h4>
    <label class="ayar-satir"><span>Akış çizgisi yoğunluğu</span><select id="yogunlukSec">
      ${[[0.5, 'Az'], [1, 'Normal'], [1.6, 'Çok']].map(([v, a]) => `<option value="${v}" ${ayar.yogunluk == v ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    <label class="ayar-satir"><span>Renk katmanı koyuluğu</span><input type="range" id="saydamSec" min="0.3" max="1" step="0.05" value="${ayar.saydamlik}"></label>
    <label class="ayar-satir"><span>Hareketli akış çizgileri</span><input type="checkbox" id="parcacikAc" ${ayar.parcacik ? 'checked' : ''}></label>
    <label class="ayar-satir"><span>Basınç çizgileri</span><input type="checkbox" id="izobarAc" ${ayar.izobar ? 'checked' : ''}></label>
    <h4>Hakkında</h4>
    <p class="kaynak">Hava Tahmini · sürüm ${SURUM}<br>
    Veri kaynakları: Open-Meteo (tahmin, modeller, deniz, hava kalitesi — CAMS), RainViewer (radar), EUMETSAT (uydu, yıldırım), NASA GIBS (dünya uydu), Esri / OpenStreetMap (harita), BigDataCloud (yer adı).<br>
    Ücretsiz veri sınırı: günde ~10.000 istek. Çok hızlı kaydırınca sınır dolabilir.</p>
    <button class="buyuk-btn" id="yenileBtn">Verileri yenile</button>`;
}
$('#menuBtn').addEventListener('click', () => { ayarSayfaCiz(); sayfaAc('ayarSayfa'); });
$('#ayarIcerik').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.birim) { ayar.birim[t.dataset.birim] = t.value; ayarKaydet(); gostergeCiz(); ciz(true); tahmin.yenile(); }
  if (t.id === 'yogunlukSec') { ayar.yogunluk = +t.value; parcacik.yogunluk = ayar.yogunluk; ayarKaydet(); ciz(); }
});
$('#ayarIcerik').addEventListener('input', e => {
  if (e.target.id === 'saydamSec') { ayar.saydamlik = +e.target.value; tuval.renk.style.opacity = ayar.saydamlik; ayarKaydet(); }
});
$('#ayarIcerik').addEventListener('click', e => {
  if (e.target.id === 'yenileBtn') { location.reload(); }
});

// ---------------- Uyarılar (konum + favoriler) ----------------
async function uyarilariKontrolEt() {
  const yerler = [...favoriler.slice(0, 6)];
  const konum = await new Promise(r => {
    if (!navigator.geolocation) return r(null);
    navigator.geolocation.getCurrentPosition(p => r({ lat: p.coords.latitude, lon: p.coords.longitude, ad: 'Konumun' }), () => r(null), { timeout: 8000, maximumAge: 1800000 });
  });
  if (konum) yerler.unshift(konum);
  if (!yerler.length) return;
  const sonuc = [];
  for (const y of yerler) {
    try {
      const v = await noktaTahmini(y.lat, y.lon, ayar.model);
      const u = uyarilariBul(v.hourly, Date.now() / 1000);
      if (u.length) sonuc.push({ yer: y, u, of: v.utc_offset_seconds });
    } catch { /* geç */ }
  }
  const toplam = sonuc.reduce((a, s) => a + s.u.length, 0);
  const btn = $('#uyariBtn');
  btn.hidden = !toplam;
  btn.querySelector('b').textContent = toplam;
  btn.classList.toggle('kirmizi', sonuc.some(s => s.u.some(x => x.seviye === 'kirmizi')));
  $('#uyariIcerik').innerHTML = sonuc.map(s => `<h4>${esc(s.yer.ad)}</h4>` + s.u.map(u => {
    const z = yerelSaat(u.zaman, s.of);
    const deger = u.deger != null ? ' · ' + yaz(u.tur, u.deger, ayar.birim) + (u.ek || '') : '';
    return `<button class="uyari uyari-${u.seviye}" data-uyari-yer="${s.yer.lat},${s.yer.lon}">${u.simge} <b>${u.metin}</b>${deger} <small>${z.gunAdi} ${z.saatDk}</small></button>`;
  }).join('')).join('') + '<p class="kaynak">Önümüzdeki 48 saat için konumun ve favorilerin. Resmi uyarılar için Meteoroloji Genel Müdürlüğü’nü takip et.</p>';
}
$('#uyariBtn').addEventListener('click', () => sayfaAc('uyariSayfa'));
$('#uyariIcerik').addEventListener('click', e => {
  const b = e.target.closest('[data-uyari-yer]');
  if (!b) return;
  const [lat, lon] = b.dataset.uyariYer.split(',').map(Number);
  const f = favoriler.find(x => x.lat === lat && x.lon === lon);
  map.setView([lat, lon], Math.max(map.getZoom(), 8));
  if (f) tahminAc({ ...f }); else yerAdi(lat, lon).then(y => tahminAc({ lat, lon, ...y }));
});

// ---------------- Başlat ----------------
hizliCiz(); seviyeCiz(); gostergeCiz(); zamanCiz(); modelYaz(); favoriIsaretleri();
{
  const k = katmanBul(ayar.katman);
  if (k.tur === 'karo') { karoKur(k); if (ayar.izobar) veriYukle(); } else veriYukle();
}
setTimeout(uyarilariKontrolEt, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) parcacik.dur(false);
  else if (alanBilgi && alanBilgi.akis) parcacik.basla();
});
// Saat ilerledikçe "şimdi" çizgisi kaysın
setInterval(imlecCiz, 60000);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
