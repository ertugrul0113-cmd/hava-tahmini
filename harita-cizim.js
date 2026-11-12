// Harita üstüne renk katmanı, hareketli parçacıklar ve basınç çizgileri çizer.
import { aradeger, esCizgiler, incelt } from './izgara.js';

/* global L */

export class Tuval {
  constructor(map) {
    this.map = map;
    const pane = map.createPane('veriPane');
    pane.style.zIndex = 350;
    pane.style.pointerEvents = 'none';
    this.pane = pane;
    this.renk = this._yeni('renk');
    this.cizgi = this._yeni('cizgi');
    this.parca = this._yeni('parca');
    this.boyutla();
  }
  _yeni(ad) {
    const c = document.createElement('canvas');
    c.className = 'tuval tuval-' + ad;
    this.pane.appendChild(c);
    return c;
  }
  boyutla() {
    const s = this.map.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = s.x; this.h = s.y; this.dpr = dpr;
    for (const c of [this.renk, this.cizgi, this.parca]) {
      c.style.width = s.x + 'px'; c.style.height = s.y + 'px';
    }
    this.renk.width = s.x; this.renk.height = s.y;
    for (const c of [this.cizgi, this.parca]) { c.width = s.x * dpr; c.height = s.y * dpr; }
    this.konumla();
  }
  konumla() {
    const p = this.map.containerPointToLayerPoint([0, 0]);
    for (const c of [this.renk, this.cizgi, this.parca]) L.DomUtil.setPosition(c, p);
  }
  gizle(evet) { this.pane.style.visibility = evet ? 'hidden' : 'visible'; }
}

// Ekrandaki her piksel sütunu/satırı için boylam/enlem
function eksenler(map, w, h, adim) {
  const W = Math.ceil(w / adim) + 1, H = Math.ceil(h / adim) + 1;
  const lons = new Float64Array(W), lats = new Float64Array(H);
  for (let x = 0; x < W; x++) lons[x] = map.containerPointToLatLng([x * adim, 0]).lng;
  for (let y = 0; y < H; y++) lats[y] = map.containerPointToLatLng([0, y * adim]).lat;
  return { W, H, lons, lats };
}

export function renkCiz(tuval, alan, renk) {
  const ctx = tuval.renk.getContext('2d');
  ctx.clearRect(0, 0, tuval.w, tuval.h);
  if (!alan) return;
  const P = 3;
  const { W, H, lons, lats } = eksenler(tuval.map, tuval.w, tuval.h, P);
  const kucuk = tuval._kucuk || (tuval._kucuk = document.createElement('canvas'));
  kucuk.width = W; kucuk.height = H;
  const kc = kucuk.getContext('2d');
  const img = kc.createImageData(W, H);
  const d = img.data, { tablo, min, max, N } = renk;
  const olc = (N - 1) / (max - min);
  for (let y = 0; y < H; y++) {
    const lat = lats[y];
    for (let x = 0; x < W; x++) {
      const v = aradeger(alan, lat, lons[x]);
      if (Number.isNaN(v)) continue;
      let i = Math.round((v - min) * olc);
      if (i < 0) i = 0; else if (i >= N) i = N - 1;
      const o = (y * W + x) * 4, t = i * 4;
      d[o] = tablo[t]; d[o + 1] = tablo[t + 1]; d[o + 2] = tablo[t + 2]; d[o + 3] = tablo[t + 3];
    }
  }
  kc.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Her küçük piksel ekranda P×P; merkezler hizalansın diye yarım piksel kaydır
  ctx.drawImage(kucuk, 0, 0, W, H, -P / 2, -P / 2, W * P, H * P);
}

export class Parcacik {
  constructor(tuval) {
    this.t = tuval;
    this.ctx = tuval.parca.getContext('2d');
    this.u = null; this.v = null;
    this.calisiyor = false;
    this.yogunluk = 1;
    this._kare = this._kare.bind(this);
  }
  ayarla(u, v) { this.u = u; this.v = v; }
  sifirla() {
    const { w, h, map, dpr } = this.t;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    const sol = map.containerPointToLatLng([0, 0]).lng, sag = map.containerPointToLatLng([w, 0]).lng;
    this.lonA = sol; this.lonK = (sag - sol) / w;
    this.lats = new Float64Array(h + 2);
    for (let y = 0; y <= h + 1; y++) this.lats[y] = map.containerPointToLatLng([0, y]).lat;
    const adet = Math.min(4500, Math.round(w * h / 230 * this.yogunluk));
    this.p = [];
    for (let i = 0; i < adet; i++) this.p.push(this._dogur({}, true));
  }
  _dogur(p, ilk) {
    p.x = Math.random() * this.t.w; p.y = Math.random() * this.t.h;
    p.yas = ilk ? Math.floor(Math.random() * 90) : 0;
    p.omur = 50 + Math.floor(Math.random() * 60);
    return p;
  }
  basla() {
    if (!this.u) return;
    this.sifirla();
    if (!this.calisiyor) { this.calisiyor = true; requestAnimationFrame(this._kare); }
  }
  dur(temizle = true) {
    this.calisiyor = false;
    if (temizle) { const { w, h } = this.t; this.ctx.clearRect(0, 0, w, h); }
  }
  _kare() {
    if (!this.calisiyor) return;
    const ctx = this.ctx, { w, h } = this.t, U = this.u, V = this.v;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    const K = 0.2;
    for (const p of this.p) {
      if (++p.yas > p.omur) { this._dogur(p); continue; }
      const yi = p.y | 0;
      if (yi < 0 || yi > h) { this._dogur(p); continue; }
      const lat = this.lats[yi], lon = this.lonA + p.x * this.lonK;
      const u = aradeger(U, lat, lon), v = aradeger(V, lat, lon);
      if (Number.isNaN(u) || Number.isNaN(v)) { this._dogur(p); continue; }
      const nx = p.x + u * K, ny = p.y - v * K;
      ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny);
      p.x = nx; p.y = ny;
      if (nx < 0 || nx > w || ny < 0 || ny > h) this._dogur(p);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.15;
    ctx.stroke();
    requestAnimationFrame(this._kare);
  }
}

// Basınç çizgileri ve Y/A (yüksek/alçak) merkezleri
export function izobarCiz(tuval, alan, birimYaz) {
  const { map, dpr, w, h } = tuval;
  const ctx = tuval.cizgi.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!alan) return;
  const ince = incelt(alan, 3);
  const seviyeler = esCizgiler(ince, 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const yazilar = [];
  for (const { seviye, parcalar } of seviyeler) {
    ctx.beginPath();
    parcalar.forEach(([a, b], i) => {
      const p = map.latLngToContainerPoint(a), q = map.latLngToContainerPoint(b);
      ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
      if (i % 90 === 45 && p.x > 20 && p.x < w - 20 && p.y > 60 && p.y < h - 140) yazilar.push([p.x, p.y, birimYaz(seviye)]);
    });
    ctx.stroke();
  }
  for (const [x, y, s] of yazilar) {
    ctx.fillStyle = 'rgba(20,24,32,0.75)';
    const gen = ctx.measureText(s).width + 6;
    ctx.fillRect(x - gen / 2, y - 7, gen, 14);
    ctx.fillStyle = '#fff';
    ctx.fillText(s, x, y);
  }
  // Yüksek / alçak basınç merkezleri (kaba ızgarada yerel en büyük/en küçük)
  const { nLat, nLon, veri } = alan, R = 2;
  ctx.font = '800 18px system-ui, sans-serif';
  for (let y = R; y < nLat - R; y++)
    for (let x = R; x < nLon - R; x++) {
      const v = veri[y * nLon + x];
      if (Number.isNaN(v)) continue;
      let enB = true, enK = true, top = 0, say = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (!dy && !dx) continue;
        const k = veri[(y + dy) * nLon + x + dx];
        if (Number.isNaN(k)) { enB = enK = false; continue; }
        if (k >= v) enB = false;
        if (k <= v) enK = false;
        top += k; say++;
      }
      if (!enB && !enK) continue;
      // Çevresinden belirgin farklı değilse merkez sayma
      if (Math.abs(v - top / say) < 1.5) continue;
      const p = map.latLngToContainerPoint([alan.lat0 + y * alan.adim, alan.lon0 + x * alan.adim]);
      ctx.fillStyle = enB ? '#7fb3ff' : '#ff8a7a';
      ctx.fillText(enB ? 'Y' : 'A', p.x, p.y);
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(birimYaz(v), p.x, p.y + 14);
      ctx.font = '800 18px system-ui, sans-serif';
    }
}
