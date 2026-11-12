import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adimSec, izgaraKur, izgaraNoktalari, aradeger, dilimKur, uvHesapla, esCizgiler, boylamDuzelt } from '../izgara.js';
import { renkBul, OLCEKLER } from '../olcek.js';
import { yaz, cevir, bofor, yonAdi, VARSAYILAN_BIRIM } from '../birim.js';
import { uyarilariBul } from '../uyari.js';
import { KATMANLAR, akisDegiskenleri, katmanBul } from '../katmanlar.js';

const B = VARSAYILAN_BIRIM;

test('ızgara adımı ve nokta sayısı sınırlı', () => {
  const a = adimSec(36, 42, 26, 45);
  const iz = izgaraKur(36, 42, 26, 45, a);
  assert.ok(iz.nLat * iz.nLon <= 300, 'çok fazla nokta: ' + iz.nLat * iz.nLon);
  const dunya = adimSec(-80, 80, -180, 180);
  const iz2 = izgaraKur(-80, 80, -180, 180, dunya);
  assert.ok(iz2.nLat * iz2.nLon <= 300);
  const yakin = adimSec(40.9, 41.1, 28.9, 29.1);
  assert.equal(yakin, 0.1);
});

test('boylam -180..180 aralığına iner', () => {
  assert.equal(boylamDuzelt(190), -170);
  assert.equal(boylamDuzelt(-190), 170);
  assert.equal(boylamDuzelt(29), 29);
});

test('çift doğrusal aradeğer', () => {
  const alan = { lat0: 0, lon0: 0, adim: 1, nLat: 2, nLon: 2, veri: Float32Array.from([0, 10, 20, 30]) };
  assert.equal(aradeger(alan, 0, 0), 0);
  assert.equal(aradeger(alan, 0.5, 0.5), 15);
  assert.equal(aradeger(alan, 0, 0.5), 5);
  assert.ok(Number.isNaN(aradeger(alan, 5, 5)));
});

test('eksik köşede en yakın dolu değer kullanılır', () => {
  const alan = { lat0: 0, lon0: 0, adim: 1, nLat: 2, nLon: 2, veri: Float32Array.from([NaN, 10, 10, 10]) };
  assert.equal(aradeger(alan, 0.9, 0.9), 10);
  const bos = { lat0: 0, lon0: 0, adim: 1, nLat: 2, nLon: 2, veri: Float32Array.from([NaN, NaN, NaN, 10]) };
  assert.ok(Number.isNaN(aradeger(bos, 0.1, 0.1)), 'karadan çok uzaksa boş kalmalı');
});

test('zaman dilimi saatler arasında karışır', () => {
  const iz = { lat0: 0, lon0: 0, adim: 1, nLat: 1, nLon: 1 };
  const noktalar = izgaraNoktalari(iz);
  const seriler = new Map([[noktalar[0].anahtar, { t0: 1000, veri: Float32Array.from([10, 20]) }]]);
  assert.equal(dilimKur(iz, noktalar, seriler, 1000 + 1800).veri[0], 15);
  assert.equal(dilimKur(iz, noktalar, seriler, 1000 + 3600).veri[0], 20);
  assert.ok(Number.isNaN(dilimKur(iz, noktalar, seriler, 0).veri[0]));
});

test('rüzgar yönü u/v: kuzeyden esen rüzgar güneye gider', () => {
  const [u, v] = uvHesapla(10, 0);
  assert.ok(Math.abs(u) < 1e-9); assert.ok(Math.abs(v + 10) < 1e-9);
  const [u2, v2] = uvHesapla(10, 270); // batıdan
  assert.ok(Math.abs(u2 - 10) < 1e-9); assert.ok(Math.abs(v2) < 1e-9);
  const [u3] = uvHesapla(10, 90, 'nereye'); // doğuya akan akıntı
  assert.ok(Math.abs(u3 - 10) < 1e-9);
});

test('izobar çizgileri bulunur', () => {
  const alan = { lat0: 0, lon0: 0, adim: 1, nLat: 3, nLon: 3, veri: Float32Array.from([1000, 1004, 1008, 1000, 1004, 1008, 1000, 1004, 1008]) };
  const c = esCizgiler(alan, 4);
  const orta = c.find(x => x.seviye === 1004);
  assert.ok(orta && orta.parcalar.length >= 2);
  // 1004 çizgisi tam ortadaki boylamdan (1) geçmeli
  for (const [a, b] of orta.parcalar) { assert.ok(Math.abs(a[1] - 1) < 1e-9 && Math.abs(b[1] - 1) < 1e-9); }
});

test('renk ölçeği', () => {
  assert.deepEqual(renkBul(OLCEKLER.yagis, 0), [0, 0, 0, 0]);
  assert.equal(renkBul(OLCEKLER.hiz, 1000)[3], 255);
  assert.deepEqual(renkBul(OLCEKLER.hiz, NaN), [0, 0, 0, 0]);
  const orta = renkBul(OLCEKLER.sicaklik, 22.5);
  assert.ok(orta[0] >= 240 && orta[0] <= 245);
});

test('birimler', () => {
  assert.equal(yaz('hiz', 10, B), '36 km/s');
  assert.equal(yaz('hiz', 10, { ...B, hiz: 'kt' }), '19 kt');
  assert.equal(bofor(10), 5);
  assert.equal(yaz('sicaklik', 21.6, B), '22°');
  assert.equal(yaz('sicaklik', 0, { ...B, sicaklik: 'f' }), '32°');
  assert.equal(yaz('yagis', 1.25, B), '1,3 mm');
  assert.equal(yaz('gorus', 2500, B), '2,5 km');
  assert.equal(yaz('karDerinlik', 0.25, B), '25 cm');
  assert.equal(yaz('akinti', 0.5, B), '1,8 km/s');
  assert.equal(yaz('hiz', NaN, B), '–');
  assert.equal(Math.round(cevir('basinc', 1013, { ...B, basinc: 'inhg' }) * 100) / 100, 29.91);
  assert.equal(yonAdi(0), 'K'); assert.equal(yonAdi(225), 'GB'); assert.equal(yonAdi(359), 'K');
});

test('uyarılar', () => {
  const simdi = 1_000_000;
  const n = 48;
  const t = Array.from({ length: n }, (_, i) => simdi + i * 3600);
  const sakin = { time: t, wind_gusts_10m: Array(n).fill(5), precipitation: Array(n).fill(0), weather_code: Array(n).fill(1), temperature_2m: Array(n).fill(15), snowfall: Array(n).fill(0), visibility: Array(n).fill(20000) };
  assert.equal(uyarilariBul(sakin, simdi).length, 0);
  const firtina = { ...sakin, wind_gusts_10m: sakin.wind_gusts_10m.map((v, i) => i === 10 ? 27 : v), weather_code: sakin.weather_code.map((v, i) => i === 5 ? 95 : v) };
  const u = uyarilariBul(firtina, simdi);
  assert.equal(u[0].seviye, 'kirmizi');
  assert.equal(u[0].zaman, t[10]);
  assert.ok(u.some(x => x.metin.includes('fırtına')));
  const don = { ...sakin, temperature_2m: sakin.temperature_2m.map((v, i) => i === 30 ? -4 : v) };
  assert.ok(uyarilariBul(don, simdi).some(x => x.metin.includes('Don')));
  const yagmur = { ...sakin, precipitation: Array(n).fill(2) };
  assert.ok(uyarilariBul(yagmur, simdi).some(x => x.metin.includes('24 saatte')));
});

test('katman tanımları tutarlı', () => {
  for (const k of KATMANLAR) {
    if (k.tur === 'izgara') {
      assert.ok(k.degisken('yuzey'), k.id + ' yüzey değişkeni yok');
      assert.ok(OLCEKLER[k.olcek], k.id + ' ölçeği yok');
    }
  }
  assert.equal(katmanBul('ruzgar').degisken('850'), 'wind_speed_850hPa');
  assert.equal(katmanBul('sicaklik').degisken('100m'), null);
  assert.equal(akisDegiskenleri('ruzgar', 'yuzey').yon, 'wind_direction_10m');
  assert.equal(akisDegiskenleri('ruzgar', '500').hiz, 'wind_speed_500hPa');
  assert.equal(katmanBul('yok').id, 'ruzgar');
});
