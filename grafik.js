// Basit çizgi + sütun grafiği (meteogram, model karşılaştırma)

// zamanlar: unix sn; seriler: [{ad, renk, deger:[], tip:'cizgi'|'sutun', eksen:'sol'|'sag', kalin}]
// secenek: { yerel: (t)=>Date benzeri {gun, saat}, solBirim, sagBirim, yukseklik }
export function grafikCiz(canvas, zamanlar, seriler, secenek = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.clientWidth || 340, H = secenek.yukseklik || 180;
  canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const sol = 34, sag = seriler.some(s => s.eksen === 'sag') ? 30 : 8, ust = 10, alt = 22;
  const gw = W - sol - sag, gh = H - ust - alt;
  const n = zamanlar.length;
  if (!n) return;
  const X = i => sol + (i / Math.max(1, n - 1)) * gw;

  const aralik = eksen => {
    let mn = Infinity, mx = -Infinity;
    for (const s of seriler) if ((s.eksen || 'sol') === eksen) for (const v of s.deger) if (v != null && !Number.isNaN(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    if (!Number.isFinite(mn)) return null;
    if (seriler.some(s => (s.eksen || 'sol') === eksen && s.tip === 'sutun')) mn = 0;
    if (mx - mn < 1) { mx += 0.5; mn -= mn === 0 ? 0 : 0.5; }
    const pay = (mx - mn) * 0.08;
    let a = mn >= 0 ? Math.max(0, mn - pay) : mn - pay, b = mx + pay;
    if (eksen === 'sol' && secenek.solUst != null) b = Math.min(b, secenek.solUst);
    return [a, b];
  };
  const A = { sol: aralik('sol'), sag: aralik('sag') };
  const Y = (v, e) => { const [a, b] = A[e]; return ust + gh - ((v - a) / (b - a)) * gh; };

  // gün ayraçları
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  let oncekiGun = null;
  for (let i = 0; i < n; i++) {
    const y = secenek.yerel(zamanlar[i]);
    if (y.gun !== oncekiGun) {
      oncekiGun = y.gun;
      const x = X(i);
      ctx.beginPath(); ctx.moveTo(x, ust); ctx.lineTo(x, ust + gh); ctx.stroke();
      if (x < W - 30) ctx.fillText(y.gunKisa, x + 18, H - 6);
    }
  }
  // eksen etiketleri
  ctx.textAlign = 'right';
  for (const e of ['sol', 'sag']) {
    if (!A[e]) continue;
    const [a, b] = A[e];
    for (let k = 0; k <= 3; k++) {
      const v = a + (b - a) * k / 3, y = Y(v, e);
      if (e === 'sol') {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.moveTo(sol, y); ctx.lineTo(sol + gw, y); ctx.stroke();
        ctx.textAlign = 'right'; ctx.fillText(Math.round(v) + (secenek.solBirim || ''), sol - 4, y + 3);
      } else {
        ctx.textAlign = 'left'; ctx.fillText((b - a < 6 ? v.toFixed(1) : Math.round(v)) + (secenek.sagBirim || ''), sol + gw + 3, y + 3);
      }
    }
  }
  // seriler
  for (const s of seriler) {
    const e = s.eksen || 'sol';
    if (!A[e]) continue;
    if (s.tip === 'sutun') {
      ctx.fillStyle = s.renk;
      const bw = Math.max(1, gw / n - 0.5);
      s.deger.forEach((v, i) => { if (v > 0) { const y = Y(v, e); ctx.fillRect(X(i) - bw / 2, y, bw, ust + gh - y); } });
    } else {
      ctx.strokeStyle = s.renk; ctx.lineWidth = s.kalin || 2; ctx.lineJoin = 'round';
      ctx.setLineDash(s.kesik ? [4, 3] : []);
      ctx.beginPath();
      let basla = true;
      s.deger.forEach((v, i) => {
        if (v == null || Number.isNaN(v)) { basla = true; return; }
        const x = X(i), y = Y(v, e);
        if (basla) { ctx.moveTo(x, y); basla = false; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // şimdi çizgisi
  const simdi = Date.now() / 1000;
  const si = zamanlar.findIndex(t => t >= simdi);
  if (si > 0) {
    ctx.strokeStyle = 'rgba(255,210,80,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(si), ust); ctx.lineTo(X(si), ust + gh); ctx.stroke();
  }
}
