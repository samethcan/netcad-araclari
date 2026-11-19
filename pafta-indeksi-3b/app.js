'use strict';
/* Pafta İndeksi 3B — tek sayfa, dış kaynak gerektirmez (MapLibre gömülü). */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const nf2 = new Intl.NumberFormat('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const nf1 = new Intl.NumberFormat('tr-TR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const nf0 = new Intl.NumberFormat('tr-TR');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const SHARE_BASE = '__SHARE__'.startsWith('__') ? '' : '__SHARE__';
const DESK = () => matchMedia('(min-width:900px)').matches;
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DARKQ = matchMedia('(prefers-color-scheme: dark)');
const trUp = s => String(s).replace(/i/g, 'İ').replace(/ı/g, 'I').toLocaleUpperCase('tr-TR');
const mahKey = s => trUp(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\b(MAHALLESI|MAH|MH)\b\.?/g, '').replace(/[^0-9A-Z]/g, '');
function toast(t, ms = 1800){ const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), ms); }
const store = {get(k, d){ try { const v = localStorage.getItem('pi3d.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
               set(k, v){ try { localStorage.setItem('pi3d.' + k, JSON.stringify(v)); } catch {} }};

/* ================= veri ================= */
let D, OY, OX;
const PG = [], PB = [];
let PL, PLL, P2G;
const SYS = {
  y: {k: 'y', ad: 'Yersel', S: [], inv: []},
  i: {k: 'i', ad: 'ITRF', S: [], inv: []},
};
const ORDER = ['y', 'i'];               // alttan üste plaka sırası
let KF = [], KL = [], KT = [], KINV = [], MH = [];
const IDX = new Map(), ADA = new Map(); let KEYS = [];
const CELL = 400; const GRID = new Map();
let KBOX = null;

function decAbs(r){ const a = new Float64Array(r.length); let y = 0, x = 0; for (let i = 0; i < r.length; i += 2){ y += r[i]; x += r[i + 1]; a[i] = OY + y / 100; a[i + 1] = OX + x / 100; } return a; }
function bboxOf(a){ let y0 = Infinity, x0 = Infinity, y1 = -Infinity, x1 = -Infinity; for (let i = 0; i < a.length; i += 2){ const y = a[i], x = a[i + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; } return [y0, x0, y1, x1]; }
function cenOf(a){ let y = 0, x = 0; const n = a.length / 2; for (let i = 0; i < a.length; i += 2){ y += a[i]; x += a[i + 1]; } return [y / n, x / n]; }
const bxU = (a, b) => a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b.slice();
function pip(a, y, x){ let c = false; for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2){ const yi = a[i], xi = a[i + 1], yj = a[j], xj = a[j + 1]; if ((xi > x) !== (xj > x) && y < (yj - yi) * (x - xi) / (xj - xi) + yi) c = !c; } return c; }
function normKey(ada, par){
  const a = String(ada).replace(/\D/g, ''); if (!a) return null;
  let p = String(par).trim().toUpperCase().replace(/\s+/g, '').replace(/\.0$/, '');
  if (!p) return null; if (/^\d+$/.test(p)) p = String(parseInt(p, 10));
  return parseInt(a, 10) + '/' + p;
}
function parseQ(q){ const m = String(q).trim().toUpperCase().match(/^(\d+)\s*[\/\-\s,;.]\s*([0-9A-Z\/]+)$/); return m ? normKey(m[1], m[2]) : null; }
const normSheet = s => String(s).toUpperCase().replace(/[^0-9A-Z]/g, '');

async function loadData(){
  const s = atob($('#pk').textContent.trim()); const bin = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
  if (typeof DecompressionStream === 'undefined') throw new Error('Tarayıcı çok eski. Güncel Chrome, Safari ya da Edge ile açın.');
  const txt = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  D = JSON.parse(txt); [OY, OX] = D.o;
  for (const r of D.pg){ const a = decAbs(r); PG.push(a); PB.push(bboxOf(a)); }
  PL = new Float64Array(D.pl.length); for (let i = 0; i < D.pl.length; i += 2){ PL[i] = OY + D.pl[i] / 100; PL[i + 1] = OX + D.pl[i + 1] / 100; }
  P2G = new Int32Array(PG.length).fill(-1);
  PB.forEach((b, i) => { KBOX = bxU(KBOX, b); for (let cx = Math.floor(b[0] / CELL); cx <= Math.floor(b[2] / CELL); cx++) for (let cy = Math.floor(b[1] / CELL); cy <= Math.floor(b[3] / CELL); cy++){ const k = cx + ',' + cy; let l = GRID.get(k); if (!l) GRID.set(k, l = []); l.push(i); } });
  const mk = s => { const a = decAbs(s.r); return {n: s.n, t: s.t, a, b: bboxOf(a), c: cenOf(a), f: s.f.map(rs => rs.map(decAbs))}; };
  SYS.y.S = D.sy.map(mk); SYS.i.S = D.si.map(mk);
  for (const k of ORDER) SYS[k].inv = SYS[k].S.map(() => []);
  KF = D.kf.map(f => { const a = decAbs(f.r); return {n: f.n, a, b: bboxOf(a), c: cenOf(a)}; }); KINV = KF.map(() => []);
  KL = D.kl.map(r => decAbs(r)); KT = D.kt.map(([t, y, x]) => [t, ...ll(OY + y / 100, OX + x / 100)]);
  MH = D.mh.map(m => { const c = [OY + m.c[0] / 100, OX + m.c[1] / 100]; return {n: m.n, rings: m.r.map(decAbs), c, cl: ll(c[0], c[1])}; });
  for (const k of ORDER) for (const sh of SYS[k].S){ sh.cl = ll(sh.c[0], sh.c[1]); sh.l0 = ll(sh.b[0], sh.c[1]); sh.l1 = ll(sh.b[2], sh.c[1]); }
  PLL = new Float64Array(PL.length).fill(NaN);
  D.g.forEach((g, gi) => {
    let l = IDX.get(g.k); if (!l) IDX.set(g.k, l = []); l.push(gi);
    for (const i of g.p) P2G[i] = gi;
    for (const k of ORDER) for (const [j] of g[k]) SYS[k].inv[j].push(gi);
    for (const [j] of g.kd) KINV[j].push(gi);
    const m = g.k.match(/^(\d+)\//); if (m){ let a = ADA.get(m[1]); if (!a) ADA.set(m[1], a = []); a.push(gi); }
  });
  KEYS = [...IDX.keys()].filter(k => /^\d+\/\d+$/.test(k)).sort((a, b) => { const [a1, a2] = a.split('/').map(Number), [b1, b2] = b.split('/').map(Number); return a1 - b1 || a2 - b2; });
}

/* ================= geometri ================= */
const ll = (y, x) => TM.inv(y, x);
function ringLL(a){ const o = []; for (let i = 0; i < a.length; i += 2) o.push(TM.inv(a[i], a[i + 1])); o.push(o[0]); return o; }
function sArea(r){ let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s; }
function polyLL(rings){ const R = rings.map(ringLL); const s0 = Math.sign(sArea(R[0])); for (let i = 1; i < R.length; i++) if (Math.sign(sArea(R[i])) === s0) R[i].reverse(); return R; }
const FC = f => ({type: 'FeatureCollection', features: f});
function boxLL(b){ const c = [ll(b[0], b[1]), ll(b[2], b[1]), ll(b[2], b[3]), ll(b[0], b[3])]; return [[Math.min(...c.map(p => p[0])), Math.min(...c.map(p => p[1]))], [Math.max(...c.map(p => p[0])), Math.max(...c.map(p => p[1]))]]; }
const FEAT = [];
function parcelFeat(i){ return FEAT[i] || (FEAT[i] = {type: 'Feature', id: i, properties: {g: P2G[i]}, geometry: {type: 'Polygon', coordinates: [ringLL(PG[i])]}}); }
const gBox = g => g.p.reduce((b, i) => bxU(b, PB[i]), null);

/* ================= tema ================= */
const PAL = {
  light: {bg: '#dfe6ec', land: '#f6f8f9', par: '#ffffff', parLn: '#b9c4cd', parHL: '#fde68a', mahLn: '#7d8b98', txt: '#0f1b26', mut: '#54616d', halo: 'rgba(255,255,255,.94)',
          y: '#0e7490', e: '#7c3aed', i: '#c2410c', k: '#15803d', sel: '#e11d48'},
  dark: {bg: '#060a0e', land: '#0e151c', par: '#121c26', parLn: '#2c3d4d', parHL: '#6b5310', mahLn: '#6a7f92', txt: '#e7eef4', mut: '#9fb0bf', halo: 'rgba(6,10,14,.92)',
         y: '#22c3dd', e: '#a78bfa', i: '#fb923c', k: '#4ade80', sel: '#fb4d75'},
};
let C = PAL[DARKQ.matches ? 'dark' : 'light'];

/* ================= durum ================= */
let map, MAT = null, MODE = store.get('mode', '3d'), GAP = 1;
const VIS = Object.assign({y: true, i: true, k: true, p: true, m: true}, store.get('vis', {}));
const HL = {y: [], i: [], k: [], parcels: [], sel: [], pin: null};
let VIEW = {t: 'home'}, CURH = '';
const S12 = 420, ZS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const Sz = z => S12 * GAP * Math.pow(2, 12 - z);
function S(z){ const zc = Math.max(8, Math.min(22, z)), z0 = Math.floor(zc), z1 = Math.min(22, z0 + 1), t = zc - z0; return Sz(z0) + (Sz(z1) - Sz(z0)) * t; }
const hx = m => ['interpolate', ['linear'], ['zoom'], ...ZS.flatMap(z => [z, Math.max(0, Sz(z) * m)])];
const visSys = () => ORDER.filter(k => VIS[k]);
const lvl = k => 1 + visSys().indexOf(k);
const topLvl = () => visSys().length;

/* ================= harita ================= */
function initMap(){
  const kb = boxLL(KBOX);
  map = new maplibregl.Map({
    container: 'map', attributionControl: false, renderWorldCopies: false, fadeDuration: 0, maxPitch: 72, minZoom: 9, maxZoom: 21,
    style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': C.bg}}]},
    bounds: kb, fitBoundsOptions: {padding: pad()}, pitch: MODE === '3d' ? 50 : 0, bearing: MODE === '3d' ? -18 : 0,
    dragRotate: true, touchPitch: true, pitchWithRotate: true,
  });
  map.touchZoomRotate.enableRotation();
  return new Promise(res => map.on('load', () => { addAll(); res(); }));
}
function src(id, data){ map.addSource(id, {type: 'geojson', data, tolerance: 0.3, buffer: 32}); }
function addAll(){
  // kaynaklar
  src('mah', FC(MH.flatMap((m, mi) => m.rings.map(r => ({type: 'Feature', properties: {mi}, geometry: {type: 'Polygon', coordinates: [ringLL(r)]}})))));
  map.addSource('par', {type: 'geojson', data: FC([]), tolerance: 0.25, buffer: 16, maxzoom: 17});
  src('parhl', FC([])); src('sel', FC([])); src('pin', FC([]));
  src('kadl', FC(KL.map(a => { const c = []; for (let i = 0; i < a.length; i += 2) c.push(ll(a[i], a[i + 1])); return {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: c}}; })));
  src('kadf', FC(KF.map((f, j) => ({type: 'Feature', id: j, properties: {j}, geometry: {type: 'Polygon', coordinates: [ringLL(f.a)]}}))));
  for (const k of ORDER){
    src('sh-' + k, FC(SYS[k].S.map((s, j) => ({type: 'Feature', id: j, properties: {j}, geometry: {type: 'Polygon', coordinates: [ringLL(s.a)]}}))));
    src('fr-' + k, FC(SYS[k].S.flatMap((s, j) => s.f.map((rs, w) => ({type: 'Feature', properties: {j, w}, geometry: {type: 'Polygon', coordinates: polyLL(rs)}})))));
  }
  // zemin katmanları
  const L = o => map.addLayer(o);
  L({id: 'mah-f', type: 'fill', source: 'mah', paint: {'fill-color': C.land}});
  L({id: 'par-f', type: 'fill', source: 'par', minzoom: 13.6, paint: {'fill-color': C.par, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13.6, 0, 14.4, 1]}});
  L({id: 'par-l', type: 'line', source: 'par', minzoom: 13.6, paint: {'line-color': C.parLn, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, .4, 18, 1.1], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.6, 0, 14.4, 1]}});
  L({id: 'parhl-f', type: 'fill', source: 'parhl', paint: {'fill-color': C.parHL, 'fill-opacity': .55}});
  L({id: 'parhl-l', type: 'line', source: 'parhl', paint: {'line-color': C.parLn, 'line-width': .8}});
  L({id: 'mah-l', type: 'line', source: 'mah', paint: {'line-color': C.mahLn, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, .8, 16, 2], 'line-dasharray': [3, 2], 'line-opacity': .8}});
  L({id: 'kadf-h', type: 'fill', source: 'kadf', filter: ['in', ['get', 'j'], ['literal', []]], paint: {'fill-color': C.k, 'fill-opacity': .14}});
  L({id: 'kad-l', type: 'line', source: 'kadl', paint: {'line-color': C.k, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, .8, 17, 2], 'line-dasharray': [2, 1.5]}});
  const dash = {y: null, e: [1.2, 1.2], i: [4, 2]};
  for (const k of ORDER){
    L({id: 'f2-' + k, type: 'fill', source: 'sh-' + k, filter: ['in', ['get', 'j'], ['literal', []]], paint: {'fill-color': C[k], 'fill-opacity': .1}});
    const p = {'line-color': C[k], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 17, 1.8], 'line-opacity': .8};
    if (dash[k]) p['line-dasharray'] = dash[k];
    L({id: 'l2-' + k, type: 'line', source: 'sh-' + k, paint: p});
    L({id: 'h2-' + k, type: 'line', source: 'sh-' + k, filter: ['in', ['get', 'j'], ['literal', []]], paint: {'line-color': C[k], 'line-width': 3.4}});
  }
  L({id: 'sel-f', type: 'fill', source: 'sel', paint: {'fill-color': C.sel, 'fill-opacity': .35}});
  L({id: 'sel-l', type: 'line', source: 'sel', paint: {'line-color': C.sel, 'line-width': 2.6}});
  L({id: 'pin-h', type: 'circle', source: 'pin', paint: {'circle-radius': 13, 'circle-color': C.sel, 'circle-opacity': .2}});
  L({id: 'pin', type: 'circle', source: 'pin', paint: {'circle-radius': 6, 'circle-color': C.sel, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5}});
  // 3B katmanlar
  L({id: 'col', type: 'fill-extrusion', source: 'sel', paint: {'fill-extrusion-color': C.sel, 'fill-extrusion-opacity': .88, 'fill-extrusion-base': 0, 'fill-extrusion-height': hx(3.4), 'fill-extrusion-vertical-gradient': true}});
  for (const k of ORDER){
    L({id: 'pl-' + k, type: 'fill-extrusion', source: 'sh-' + k, paint: {'fill-extrusion-color': C[k], 'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 12, .17, 15, .09, 17, .035], 'fill-extrusion-vertical-gradient': false}});
    L({id: 'ph-' + k, type: 'fill-extrusion', source: 'sh-' + k, filter: ['in', ['get', 'j'], ['literal', []]], paint: {'fill-extrusion-color': C[k], 'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 12, .5, 15, .26, 17, .07], 'fill-extrusion-vertical-gradient': false}});
    [[0, 13.4], [13.4, 15.4], [15.4, 17.4], [17.4, 24]].forEach(([z0, z1], w) =>
      L({id: `fr-${k}-${w}`, type: 'fill-extrusion', source: 'fr-' + k, minzoom: z0, maxzoom: z1, filter: ['==', ['get', 'w'], w], paint: {'fill-extrusion-color': C[k], 'fill-extrusion-opacity': .95, 'fill-extrusion-vertical-gradient': false}}));
  }
  map.addLayer({id: 'cap', type: 'custom', renderingMode: '2d', onAdd(){}, render(gl, m){ MAT = m; }});
  setHeights(); applyVis(); applyMode(false);
  map.on('render', drawOv); map.on('resize', sizeOv); sizeOv();
  map.on('moveend', updParcels);
  map.on('rotate', needle); map.on('pitch', needle); needle();
  map.on('click', e => { const [y, x] = TM.fwd(e.lngLat.lng, e.lngLat.lat); route('c-' + Math.round(y * 100) + '-' + Math.round(x * 100)); });
}
function setHeights(){
  if (!map) return;
  const n = topLvl();
  map.setPaintProperty('col', 'fill-extrusion-height', hx(Math.max(1, n) + .45));
  for (const k of ORDER){
    const L = lvl(k);
    map.setPaintProperty('pl-' + k, 'fill-extrusion-base', hx(L)); map.setPaintProperty('pl-' + k, 'fill-extrusion-height', hx(L + .03));
    map.setPaintProperty('ph-' + k, 'fill-extrusion-base', hx(L)); map.setPaintProperty('ph-' + k, 'fill-extrusion-height', hx(L + .045));
    for (let w = 0; w < 4; w++){ map.setPaintProperty(`fr-${k}-${w}`, 'fill-extrusion-base', hx(L - .012)); map.setPaintProperty(`fr-${k}-${w}`, 'fill-extrusion-height', hx(L + .055)); }
  }
}
const vis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
function applyVis(){
  const d3 = MODE === '3d';
  for (const k of ORDER){
    for (const p of ['f2-', 'l2-', 'h2-']) vis(p + k, VIS[k] && !d3);
    for (const p of ['pl-', 'ph-']) vis(p + k, VIS[k] && d3);
    for (let w = 0; w < 4; w++) vis(`fr-${k}-${w}`, VIS[k] && d3);
  }
  vis('col', d3); vis('kad-l', VIS.k); vis('kadf-h', VIS.k);
  vis('par-f', VIS.p); vis('par-l', VIS.p); vis('mah-l', VIS.m);
  setHeights(); updParcels(); map.triggerRepaint();
}
function applyMode(anim = true){
  const d3 = MODE === '3d';
  $('#bMode').classList.toggle('on', d3); $('#bModeT').textContent = d3 ? '3B' : '2B';
  applyVis();
  if (anim) map.easeTo({pitch: d3 ? 55 : 0, bearing: d3 ? (map.getBearing() || -18) : map.getBearing(), duration: REDUCE ? 0 : 750});
}
function applyTheme(){
  C = PAL[DARKQ.matches ? 'dark' : 'light']; if (!map) return;
  const P = (id, p, v) => map.getLayer(id) && map.setPaintProperty(id, p, v);
  P('bg', 'background-color', C.bg); P('mah-f', 'fill-color', C.land); P('par-f', 'fill-color', C.par); P('par-l', 'line-color', C.parLn);
  P('parhl-f', 'fill-color', C.parHL); P('parhl-l', 'line-color', C.parLn); P('mah-l', 'line-color', C.mahLn);
  P('kadf-h', 'fill-color', C.k); P('kad-l', 'line-color', C.k);
  for (const k of ORDER){ for (const p of ['f2-', 'h2-']) P(p + k, p === 'f2-' ? 'fill-color' : 'line-color', C[k]); P('l2-' + k, 'line-color', C[k]);
    P('pl-' + k, 'fill-extrusion-color', C[k]); P('ph-' + k, 'fill-extrusion-color', C[k]); for (let w = 0; w < 4; w++) P(`fr-${k}-${w}`, 'fill-extrusion-color', C[k]); }
  for (const id of ['sel-f']) P(id, 'fill-color', C.sel); P('sel-l', 'line-color', C.sel); P('col', 'fill-extrusion-color', C.sel); P('pin', 'circle-color', C.sel); P('pin-h', 'circle-color', C.sel);
  map.triggerRepaint();
}
DARKQ.addEventListener?.('change', applyTheme);

/* parseller: yalnızca görünen bölge yüklenir */
let LOADED = [], LKEY = '';
function updParcels(){
  if (!map || !map.getSource('par')) return;
  const z = map.getZoom();
  if (!VIS.p || z < 13.6){ if (LKEY){ LKEY = ''; LOADED = []; map.getSource('par').setData(FC([])); } return; }
  const c = map.getCenter(); const [cy, cx] = TM.fwd(c.lng, c.lat);
  const R = Math.min(3200, Math.max(700, 1700 * Math.pow(2, 15 - z)));
  const bb = map.getBounds(); const corners = [bb.getSouthWest(), bb.getNorthEast(), bb.getNorthWest(), bb.getSouthEast()].map(p => TM.fwd(p.lng, p.lat));
  const vb = [Math.max(cy - R, Math.min(...corners.map(p => p[0]))), Math.max(cx - R, Math.min(...corners.map(p => p[1]))), Math.min(cy + R, Math.max(...corners.map(p => p[0]))), Math.min(cx + R, Math.max(...corners.map(p => p[1])))];
  const cells = []; for (let gx = Math.floor(vb[0] / CELL); gx <= Math.floor(vb[2] / CELL); gx++) for (let gy = Math.floor(vb[1] / CELL); gy <= Math.floor(vb[3] / CELL); gy++) if (GRID.has(gx + ',' + gy)) cells.push(gx + ',' + gy);
  const key = cells.join(';'); if (key === LKEY) return; LKEY = key;
  const seen = new Set(); LOADED = [];
  for (const k of cells) for (const i of GRID.get(k)) if (!seen.has(i)){ seen.add(i); LOADED.push(i); }
  map.getSource('par').setData(FC(LOADED.map(parcelFeat)));
}

/* vurgular */
function applyHL(){
  if (!map) return;
  for (const k of ORDER){ const f = ['in', ['get', 'j'], ['literal', HL[k]]]; map.setFilter('f2-' + k, f); map.setFilter('h2-' + k, f); map.setFilter('ph-' + k, f); }
  map.setFilter('kadf-h', ['in', ['get', 'j'], ['literal', HL.k]]);
  map.getSource('sel').setData(FC(HL.sel.map(parcelFeat)));
  map.getSource('parhl').setData(FC(HL.parcels.map(parcelFeat)));
  map.getSource('pin').setData(FC(HL.pin ? [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: ll(HL.pin[0], HL.pin[1])}}] : []));
  map.triggerRepaint();
}
function clearHL(){ for (const k of ['y', 'i', 'k']) HL[k] = []; HL.parcels = []; HL.sel = []; HL.pin = null; }

/* kamera */
function sheetVisH(){ if (DESK()) return 0; const r = $('#sheet').getBoundingClientRect(); return Math.max(0, innerHeight - r.top); }
function pad(extra){
  const W = innerWidth, H = innerHeight;
  if (DESK()) return {top: 90, bottom: 40, left: 450, right: 80};
  const top = 84 + (parseFloat(getComputedStyle($('#top')).top) || 10);
  let bottom = (extra ?? sheetVisH()) + 20; if (top + bottom > H - 120) bottom = Math.max(30, H - 120 - top);
  return {top, bottom, left: Math.min(30, W * .08), right: Math.min(70, W * .18)};
}
function fitBox(tmBox, o = {}){
  const b = boxLL(tmBox); const cam = map.cameraForBounds(b, {padding: pad(o.sheetH), bearing: map.getBearing(), maxZoom: o.maxZoom ?? 18.4});
  if (!cam) return;
  const d3 = MODE === '3d';
  const zoom = cam.zoom - (d3 ? .45 : 0);
  const opt = {center: cam.center, zoom, bearing: map.getBearing(), pitch: d3 ? (o.pitch ?? Math.max(48, Math.min(60, map.getPitch() || 55))) : map.getPitch(), duration: REDUCE ? 0 : 1100, essential: true};
  if (o.jump) map.jumpTo(opt); else map.flyTo(opt);
}
function needle(){ if (!map) return; $('#needle').style.transform = `rotateX(${map.getPitch() * .6}deg) rotate(${-map.getBearing()}deg)`; }

/* ================= etiket katmanı (2B tuval) ================= */
const ov = $('#ov'), ox = ov.getContext('2d'); let OW = 0, OH = 0, DPR = 1;
function sizeOv(){ DPR = Math.min(devicePixelRatio || 1, 2.5); OW = innerWidth; OH = innerHeight; ov.width = OW * DPR; ov.height = OH * DPR; drawOv(); }
function pll(i){ if (PLL[i * 2] !== PLL[i * 2]){ const q = ll(PL[i * 2], PL[i * 2 + 1]); PLL[i * 2] = q[0]; PLL[i * 2 + 1] = q[1]; } return [PLL[i * 2], PLL[i * 2 + 1]]; }
const P3 = (y, x, alt) => P3L(ll(y, x), alt);
let EXP = false;
function P3L([lo, la], alt){
  if (!MAT) return null; const mc = maplibregl.MercatorCoordinate.fromLngLat([lo, la], alt || 0); const m = MAT;
  const X = m[0] * mc.x + m[4] * mc.y + m[8] * mc.z + m[12], Y = m[1] * mc.x + m[5] * mc.y + m[9] * mc.z + m[13], W = m[3] * mc.x + m[7] * mc.y + m[11] * mc.z + m[15];
  if (W <= 1e-9) return null; return [(X / W + 1) / 2 * OW, (1 - Y / W) / 2 * OH];
}
const MONO = getComputedStyle(document.documentElement).getPropertyValue('--mono') || 'monospace';
const SANS = getComputedStyle(document.documentElement).getPropertyValue('--f') || 'sans-serif';
let OCC;
function occOk(r){ const c0 = Math.floor(r[0] / 40), c1 = Math.floor(r[2] / 40), r0 = Math.floor(r[1] / 40), r1 = Math.floor(r[3] / 40);
  for (let a = c0; a <= c1; a++) for (let b = r0; b <= r1; b++){ const l = OCC.get(a * 4096 + b); if (l) for (const q of l) if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) return false; } return true; }
function occAdd(r){ const c0 = Math.floor(r[0] / 40), c1 = Math.floor(r[2] / 40), r0 = Math.floor(r[1] / 40), r1 = Math.floor(r[3] / 40);
  for (let a = c0; a <= c1; a++) for (let b = r0; b <= r1; b++){ const k = a * 4096 + b; let l = OCC.get(k); if (!l) OCC.set(k, l = []); l.push(r); } }
function label(p, t, o){
  // o: {font, color, halo, pill, force, dx, dy, align}
  ox.font = o.font; const tw = ox.measureText(t).width, fs = o.fs || 12;
  let x = p[0] + (o.dx || 0), y = p[1] + (o.dy || 0);
  const al = o.align || 'center'; const x0 = al === 'left' ? x : x - tw / 2;
  const r = [x0 - (o.pill ? 7 : 3), y - fs * .75 - (o.pill ? 5 : 2), x0 + tw + (o.pill ? 7 : 3), y + fs * .3 + (o.pill ? 5 : 2)];
  if (r[2] < -20 || r[0] > OW + 20 || r[3] < -20 || r[1] > OH + 20) return false;
  if (!o.force && !occOk(r)) return false;
  occAdd(r);
  if (o.pill){ ox.fillStyle = o.pill; const rr = (r[3] - r[1]) / 2; ox.beginPath(); ox.roundRect ? ox.roundRect(r[0], r[1], r[2] - r[0], r[3] - r[1], rr) : ox.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); ox.fill(); }
  else { ox.lineWidth = 3.2; ox.strokeStyle = o.halo || C.halo; ox.lineJoin = 'round'; ox.strokeText(t, x0, y); }
  ox.fillStyle = o.color; ox.fillText(t, x0, y); return true;
}
function drawOv(){
  ox.setTransform(DPR, 0, 0, DPR, 0, 0); ox.clearRect(0, 0, OW, OH);
  if (!map || !MAT || !D) return;
  OCC = new Map(); ox.textBaseline = 'alphabetic';
  const z = map.getZoom(), d3 = MODE === '3d', s = S(z);
  const alt = k => d3 ? (lvl(k) + .05) * s : 0;
  // UI'nin kapladığı alanlar
  if (!EXP){
    const tr = $('#top').getBoundingClientRect(); occAdd([tr.left, tr.top, tr.right, tr.bottom + 4]);
    const fr = $('#fab').getBoundingClientRect(); occAdd([fr.left - 4, fr.top, fr.right, fr.bottom]);
    if (DESK()){ const sr = $('#sheet').getBoundingClientRect(); occAdd([sr.left, sr.top, sr.right + 4, sr.bottom]); }
    else { const sh = sheetVisH(); occAdd([0, OH - sh, OW, OH]); }
  }
  // seçili parsel + sütun merdiveni
  if (HL.sel.length && VIEW.g != null){
    const g = D.g[VIEW.g], i0 = g.p[0];
    const top = d3 ? (topLvl() + .45) * s : 0;
    const L0 = pll(i0), pb = P3L(L0, top), p0 = P3L(L0, 0);
    if (p0){
      const bb = gBox(g); const a = P3(bb[0], bb[1], 0), b = P3(bb[2], bb[3], 0);
      if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) < 16){ ox.strokeStyle = C.sel; ox.lineWidth = 2.5; ox.beginPath(); ox.arc(p0[0], p0[1], 15, 0, 7); ox.stroke(); }
    }
    if (d3 && p0 && VIEW.t === 'parcel'){
      const steps = [['k', 0, g.kd.length ? 'Kadastro ' + g.kd.map(([j]) => kadTxt(KF[j])).join(' + ') : null]];
      for (const k of visSys()) steps.push([k, lvl(k) * s, g[k].length ? SYS[k].ad + ' ' + g[k].map(([j]) => SYS[k].S[j].n).join(' + ') : SYS[k].ad + ' —']);
      for (const [k, h, t] of steps){ if (!t || (k === 'k' && !VIS.k)) continue; const p = P3L(L0, h); if (!p) continue;
        label(p, t, {font: `700 12.5px ${MONO}`, fs: 12.5, color: '#fff', pill: C[k], dx: 14, align: 'left', force: true}); }
    }
    if (pb) label(pb, g.k, {font: `800 14px ${SANS}`, fs: 14, color: '#fff', pill: C.sel, dy: d3 ? -12 : -18, force: true});
  }
  // nokta merdiveni
  if (HL.pin && VIEW.t === 'pt' && VIEW.hit){
    const [py, px] = HL.pin, h = VIEW.hit;
    if (d3){ const a = P3(py, px, 0), b = P3(py, px, (topLvl() + .3) * s); if (a && b){ ox.strokeStyle = C.sel; ox.lineWidth = 2; ox.setLineDash([5, 4]); ox.beginPath(); ox.moveTo(a[0], a[1]); ox.lineTo(b[0], b[1]); ox.stroke(); ox.setLineDash([]); }
      for (const k of visSys()){ const p = P3(py, px, lvl(k) * s); if (p) label(p, SYS[k].ad + ' ' + (h[k].map(j => SYS[k].S[j].n).join(' + ') || '—'), {font: `700 12.5px ${MONO}`, fs: 12.5, color: '#fff', pill: C[k], dx: 12, align: 'left', force: true}); } }
  }
  // vurgulu pafta adları
  for (const k of [...ORDER].reverse()){ if (!VIS[k]) continue;
    for (const j of HL[k]){ const sh = SYS[k].S[j]; const p = P3L(sh.cl, alt(k)); if (p) label(p, sh.n + (sh.t === 1 ? ' *' : ''), {font: `800 15px ${MONO}`, fs: 15, color: '#fff', pill: C[k]}); } }
  // tüm pafta adları
  for (const k of [...ORDER].reverse()){ if (!VIS[k]) continue; const hs = new Set(HL[k]);
    SYS[k].S.forEach((sh, j) => { if (hs.has(j)) return; const p = P3L(sh.cl, alt(k)); if (!p || p[0] < -50 || p[0] > OW + 50 || p[1] < -30 || p[1] > OH + 30) return;
      const q = P3L(sh.l0, alt(k)), r = P3L(sh.l1, alt(k)); if (!q || !r) return; const wpx = Math.hypot(q[0] - r[0], q[1] - r[1]);
      if (wpx < sh.n.length * 7.5 + 12) return;
      label(p, sh.n + (sh.t === 1 ? ' *' : ''), {font: `700 ${wpx > 260 ? 14 : 12}px ${MONO}`, fs: 13, color: C[k]}); }); }
  // mahalle adları
  if (VIS.m && z < 15.8) for (const m of MH){ if (!m.n) continue; const p = P3L(m.cl, 0); if (p) label(p, trUp(m.n), {font: `650 ${z < 12.5 ? 10 : 11.5}px ${SANS}`, fs: 11, color: C.mut}); }
  // kadastro pafta numaraları
  if (VIS.k && z >= 14.2) for (const [t, lo, la] of KT){ const p = P3L([lo, la], 0); if (p) label(p, t, {font: `700 12px ${MONO}`, fs: 12, color: C.k}); }
  // parsel numaraları
  if (VIS.p && z >= 17){ const full = z >= 18.6; let n = 0;
    for (const i of LOADED){ const p = P3L(pll(i), 0); if (!p || p[0] < 0 || p[0] > OW || p[1] < 0 || p[1] > OH) continue;
      const g = D.g[P2G[i]]; if (!g) continue; const t = full ? g.k : g.k.slice(g.k.indexOf('/') + 1);
      if (label(p, t, {font: `600 11px ${MONO}`, fs: 11, color: C.mut}) && ++n > 700) break; } }
}

/* ================= panel ================= */
const sheet = $('#sheet'); let SS = 'peek';
let SB = 0; { const pr = document.createElement('div'); pr.style.cssText = 'position:fixed;padding-bottom:env(safe-area-inset-bottom,0px)'; document.body.appendChild(pr); SB = parseFloat(getComputedStyle(pr).paddingBottom) || 0; pr.remove(); }
function sheetY(st){ const h = sheet.offsetHeight; const v = {peek: 150 + SB, half: Math.round(innerHeight * .52), full: h}[st]; return Math.max(0, h - v); }
function setSheet(st){ SS = st; if (DESK()) return; sheet.style.transform = `translateY(${sheetY(st)}px)`; setTimeout(drawOv, 300); }
(() => {
  const g = $('#grab'); let y0 = null, t0 = 0, moved = false;
  g.addEventListener('pointerdown', e => { if (DESK()) return; y0 = e.clientY; t0 = sheetY(SS); moved = false; sheet.classList.add('drag'); g.setPointerCapture(e.pointerId); });
  g.addEventListener('pointermove', e => { if (y0 == null) return; const dy = e.clientY - y0; if (Math.abs(dy) > 4) moved = true; sheet.style.transform = `translateY(${Math.max(0, t0 + dy)}px)`; });
  const end = e => { if (y0 == null) return; sheet.classList.remove('drag'); const dy = e.clientY - y0; y0 = null;
    if (!moved){ setSheet(SS === 'peek' ? 'half' : SS === 'half' ? 'full' : 'peek'); return; }
    const cur = t0 + dy, opts = ['full', 'half', 'peek'].map(s => [s, Math.abs(sheetY(s) - cur)]).sort((a, b) => a[1] - b[1]);
    let st = opts[0][0]; if (Math.abs(dy) > 60 && st === SS) st = dy < 0 ? (SS === 'peek' ? 'half' : 'full') : (SS === 'full' ? 'half' : 'peek');
    setSheet(st); };
  g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
})();
addEventListener('resize', () => setSheet(SS));
function show(html, st){ sheet.classList.toggle('wide', VIEW.t === 'bulk'); $('#sbody').innerHTML = html; $('#sbody').scrollTop = 0; if (st) setSheet(st); drawOv(); }
function setHash(h){ CURH = h; if (location.hash.slice(1) !== h){ IGN = h; location.hash = h; } }
let IGN = null;
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h === IGN){ IGN = null; return; } route(h, {fromHash: true}); });

/* ---------- metin parçaları ---------- */
const kadTxt = f => f.n.length ? f.n.join(' / ') : 'numarasız';
const pct = (a, A) => '%' + nf1.format(a / A * 100);
function sysBlock(g, k){
  const list = g[k], Sx = SYS[k].S, head = `<div class="st"><i style="background:var(--${k})"></i>${SYS[k].ad} pafta${list.length > 1 ? ' · ' + list.length + ' paftaya giriyor' : ''}</div>`;
  if (!list.length) return `<div class="sec">${head}<div class="note b">Bu parsel ${SYS[k].ad} pafta indeksinin dışında kalıyor.</div></div>`;
  return `<div class="sec">${head}<div class="chips">${list.map(([j, a]) => { const s = Sx[j];
    const tag = s.t === 1 ? '<span class="tag">çerçeve tamamlandı</span>' : s.t === 2 ? '<span class="tag">ad kayıttan</span>' : '';
    return `<button class="chip ${k}" data-s="${k}" data-j="${j}"><div class="n">${esc(s.n)}${tag}</div><div class="p">${list.length > 1 ? pct(a, g.a) + ' · ' : ''}${nf2.format(a)} m²</div></button>`; }).join('')}</div></div>`;
}
function kadBlock(g){
  const head = `<div class="st"><i style="background:var(--k)"></i>Kadastro pafta${g.kd.length > 1 ? ' · ' + g.kd.length + ' paftaya giriyor' : ''}</div>`;
  if (!g.kd.length) return `<div class="sec">${head}<div class="note b">Bu bölgede kadastro pafta çizgisi yok.</div></div>`;
  let h = `<div class="sec">${head}<div class="chips">${g.kd.map(([j, a]) => { const f = KF[j], amb = f.n.length !== 1;
    return `<button class="chip k${amb ? ' amb' : ''}" data-kf="${j}"><div class="n">${esc(kadTxt(f))}${amb ? '<span class="tag">belirsiz</span>' : ''}</div><div class="p">${g.kd.length > 1 ? pct(a, g.a) + ' · ' : ''}${nf2.format(a)} m²</div></button>`; }).join('')}</div>`;
  if (g.kd.some(([j]) => KF[j].n.length > 1)) h += `<div class="note w">Bu paftalar arasındaki sınır çizgisi NCZ'de eksik. Parselin hangisinde olduğu çizgiden çıkarılamıyor.</div>`;
  if (g.kd.some(([j]) => !KF[j].n.length)) h += `<div class="note w">Parselin düştüğü kadastro pafta alanında numara yazısı yok.</div>`;
  if (g.kc < 99) h += `<div class="note w">Parselin yalnızca ${pct(g.kc, 100)}'i kadastro pafta çizgilerinin kapattığı alanda.</div>`;
  return h + '</div>';
}
const spl = k => { const i = k.indexOf('/'); return i < 0 ? ['', k] : [k.slice(0, i), k.slice(i + 1)]; };
const adaOf = k => { const a = spl(k)[0]; return /^\d+$/.test(a) ? a : ''; };
function titleOf(k){ const [a, p] = spl(k); return /^\d+$/.test(a) ? `<span class="m">${esc(a)}</span><small>ada</small><span class="m">${esc(p)}</span><small>parsel</small>` : esc(k); }
function textOf(g){ return `${g.k}${g.m ? ' (' + g.m + ')' : ''} · ` + ORDER.map(k => `${SYS[k].ad}: ${g[k].map(([j]) => SYS[k].S[j].n).join(', ') || 'yok'}`).join(' · ') + ` · Kadastro: ${g.kd.map(([j]) => kadTxt(KF[j])).join(', ') || 'yok'} · Alan ${nf2.format(g.a)} m²`; }
const ICON = {
  share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  img: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  csv: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>',
};
const backBtn = () => VIEW.prev ? `<button class="back" data-act="back">${ICON.back}Geri</button>` : '';

/* ---------- görünümler ---------- */
function viewHome(){
  VIEW = {t: 'home'}; clearHL(); applyHL(); setHash('');
  const M = D.meta, rec = store.get('recent', []);
  const ex1 = KEYS.find(k => { const g = D.g[IDX.get(k)[0]]; return g.y.length > 1 && g.i.length > 1 && IDX.get(k).length === 1; }) || KEYS[0];
  show(`<div class="intro">
    <div class="ttl">Pafta İndeksi</div>
    <div class="sub2">${nf0.format(M.parsel)} parsel · ${M.yersel} Yersel · ${M.itrf} ITRF · kadastro pafta</div>
    <p>Ada/parsel, ada, pafta adı ya da koordinat yazın. Haritaya dokunduğunuz noktanın parselini ve paftalarını da gösterir.</p>
    <div class="ex"><button data-q="${ex1}">${ex1}</button><button data-q="${SYS.y.S[0].n}">${SYS.y.S[0].n}</button><button data-q="${SYS.i.S[0].n}">${SYS.i.S[0].n}</button><button data-q="${ex1.split('/')[0]}">${ex1.split('/')[0]} (ada)</button></div>
    ${rec.length ? `<div class="sec recent"><div class="st">Son sorgular</div><div class="ex">${rec.map(r => `<button data-q="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>` : ''}
    <div class="sec"><div class="st">Sahada konum</div><div class="note n">Google Haritalar'da bulunduğunuz yere basılı tutun, üstte çıkan koordinatı kopyalayıp buraya yapıştırın (ör. <b>39.9255, 32.8662</b>). ITRF koordinatı da yazabilirsiniz (ör. <b>${Math.round((KBOX[0] + KBOX[2]) / 2)} ${Math.round((KBOX[1] + KBOX[3]) / 2)}</b>).</div></div>
    <div class="acts"><button class="btn pri" data-act="bulk">${ICON.csv}Toplu sorgu</button><button class="btn" data-act="about">Veri ve notlar</button></div></div>`, 'peek');
}
function addRecent(q){ let r = store.get('recent', []); r = [q, ...r.filter(x => x !== q)].slice(0, 8); store.set('recent', r); }

function viewParcel(k, o = {}){
  const L = IDX.get(k);
  if (!L){ show(`${backBtn()}<div class="note b">“${esc(k)}” bulunamadı. Ada/parsel numarasını kontrol edin.</div>`, 'peek'); return; }
  const gi = o.gi != null && L.includes(o.gi) ? o.gi : L[0];
  const g = D.g[gi];
  VIEW = {t: 'parcel', k, g: gi, prev: o.prev}; clearHL();
  HL.sel = g.p.slice(); for (const s of ORDER) HL[s] = g[s].map(([j]) => j); HL.k = g.kd.map(([j]) => j);
  applyHL(); if (!o.noFit) fitBox(gBox(g), {maxZoom: 18.6, sheetH: DESK() ? 0 : Math.round(innerHeight * .52)});
  const mi = L.length > 1 ? '-m' + L.indexOf(gi) : '';
  if (/^\d+\/[0-9A-Za-z]+$/.test(k)) setHash('p' + k.replace('/', '-') + mi); else setHash('');
  addRecent(k);
  let h = backBtn();
  if (L.length > 1) h += `<div class="note w" style="margin-top:4px">Bu ada/parsel numarası ${L.length} mahallede geçiyor. Doğru olanı seçin:</div><div class="seg">${L.map(x => `<button class="${x === gi ? 'on' : ''}" data-gi="${x}">${esc(D.g[x].m || 'mahalle ?')}</button>`).join('')}</div>`;
  h += `<div class="hd"><div><div class="ttl">${titleOf(g.k)}</div><div class="facts"><span>Mahalle <b>${esc(g.m || '—')}</b></span><span>Alan <b>${nf2.format(g.a)} m²</b></span>${g.p.length > 1 ? `<span>Parça <b>${g.p.length}</b></span>` : ''}</div></div></div>`;
  h += sysBlock(g, 'y') + sysBlock(g, 'i') + kadBlock(g);
  if (g.y.some(([j]) => SYS.y.S[j].t === 1)) h += `<div class="note w">Yersel paftalardan biri NCZ'de çerçevesi olmayan paftalardan. Adı haritadaki yazıdan, çerçevesi düzenli pafta ızgarasından alındı.</div>`;
  h += `<div class="acts"><button class="btn pri" data-act="share">${ICON.share}Paylaş</button><button class="btn" data-act="png">${ICON.img}Görüntü</button><button class="btn" data-act="copy">${ICON.copy}Kopyala</button><button class="btn" data-act="ada" data-ada="${esc(adaOf(g.k))}" ${adaOf(g.k) ? '' : 'hidden'}>Adanın tümü</button></div>`;
  h += `<div class="foot">Bir paftaya düşen pay 1 m²'nin ya da parsel alanının %1'inin altındaysa listelenmez. Pafta adına dokununca o paftadaki tüm parseller listelenir.</div>`;
  show(h, 'half');
}

function groupByAda(gis, partOf){
  const by = new Map();
  for (const gi of gis){ const g = D.g[gi], a = adaOf(g.k), key = a + '|' + (g.m || ''); let l = by.get(key); if (!l) by.set(key, l = {a, m: g.m, L: []}); l.L.push(gi); }
  const arr = [...by.values()].sort((x, y) => (x.a === '') - (y.a === '') || (parseInt(x.a) || 0) - (parseInt(y.a) || 0) || String(x.m).localeCompare(y.m));
  for (const r of arr) r.L.sort((x, y) => { const p = spl(D.g[x].k)[1], q = spl(D.g[y].k)[1]; return (parseInt(p) || 0) - (parseInt(q) || 0) || p.localeCompare(q); });
  return arr.map(r => `<div class="adar">${r.a ? `<div class="an" data-act="ada" data-ada="${esc(r.a)}">${esc(r.a)}<small>${esc(r.m || '')}</small></div>` : `<div class="an" style="cursor:default">—<small>numarasız</small></div>`}<div class="ps">${r.L.map(gi => { const pp = r.a ? spl(D.g[gi].k)[1] : D.g[gi].k; const pt = partOf ? partOf(gi) : false;
    return `<button data-g="${gi}" class="${pt ? 'part' : ''}" title="${pt ? 'Kısmen bu paftada' : ''}">${esc(pp)}</button>`; }).join('')}</div></div>`).join('');
}
function listStats(gis){ const ad = new Set(), mh = new Set(); for (const gi of gis){ const g = D.g[gi]; if (adaOf(g.k)) ad.add(adaOf(g.k) + '|' + g.m); for (const m of (g.m || '').split(' / ')) if (m) mh.add(m); } return {ada: ad.size, mah: [...mh].sort((a, b) => a.localeCompare(b, 'tr'))}; }

function viewSheet(k, j, o = {}){
  const sh = SYS[k].S[j], gis = SYS[k].inv[j];
  VIEW = {t: 'sheet', s: k, j, prev: o.prev}; clearHL(); HL[k] = [j];
  HL.parcels = gis.flatMap(gi => D.g[gi].p); applyHL();
  if (!o.noFit) fitBox(sh.b, {maxZoom: 17.2, sheetH: DESK() ? 0 : Math.round(innerHeight * .52)});
  setHash('s-' + k + '-' + normSheet(sh.n));
  const twins = ORDER.filter(x => x !== k).map(x => [x, SYS[x].S.findIndex(s => normSheet(s.n) === normSheet(sh.n))]).filter(([, jj]) => jj >= 0);
  const part = gi => { const r = D.g[gi][k].find(([jj]) => jj === j); return r && r[1] < D.g[gi].a * .99; };
  const st = listStats(gis), np = gis.filter(part).length;
  let h = backBtn();
  if (twins.length) h += `<div class="seg">${[[k, j], ...twins].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0])).map(([x, jj]) => `<button class="${x === k ? 'on' : ''}" data-s="${x}" data-j="${jj}">${SYS[x].ad}</button>`).join('')}</div>`;
  h += `<div class="ttl"><span class="m" style="color:var(--${k})">${esc(sh.n)}</span><small>${SYS[k].ad} pafta</small></div>`;
  if (sh.t === 1) h += `<div class="note w">Bu paftanın çerçevesi NCZ'de yok; adı haritadaki yazıdan, çerçevesi düzenli pafta ızgarasından tamamlandı.</div>`;
  if (twins.length) h += `<div class="note n">Aynı ad ${twins.map(([x]) => SYS[x].ad).join(' ve ')} indeksinde de var; datum farkı yüzünden paftalar farklı yerdedir.</div>`;
  h += `<div class="stats"><div class="stat"><b>${nf0.format(gis.length)}</b>parsel</div><div class="stat"><b>${nf0.format(st.ada)}</b>ada</div><div class="stat"><b>${nf0.format(np)}</b>kısmen içinde</div></div>`;
  if (st.mah.length) h += `<div class="sub2">Mahalle: ${st.mah.map(esc).join(', ')}</div>`;
  h += `<div class="acts"><button class="btn pri" data-act="share">${ICON.share}Paylaş</button><button class="btn" data-act="fit">${ICON.map}Haritada</button><button class="btn" data-act="listcsv">${ICON.csv}Liste (CSV)</button><button class="btn" data-act="png">${ICON.img}Görüntü</button></div>`;
  h += `<div class="adal">${gis.length ? groupByAda(gis, part) : '<div class="note n">Bu paftaya düşen parsel yok.</div>'}</div>`;
  if (np) h += `<div class="foot">Kesik çerçeveli numaralar paftaya kısmen giren parsellerdir.</div>`;
  show(h, 'half');
}
function viewKad(j, o = {}){
  const f = KF[j], gis = KINV[j];
  VIEW = {t: 'kad', j, prev: o.prev}; clearHL(); HL.k = [j]; HL.parcels = gis.flatMap(gi => D.g[gi].p); applyHL();
  if (!o.noFit) fitBox(f.b, {maxZoom: 17.2, sheetH: DESK() ? 0 : Math.round(innerHeight * .52)});
  setHash('k-' + j);
  const part = gi => { const r = D.g[gi].kd.find(([jj]) => jj === j); return r && r[1] < D.g[gi].a * .99; };
  const st = listStats(gis);
  let h = backBtn() + `<div class="ttl"><span class="m" style="color:var(--k)">${esc(kadTxt(f))}</span><small>kadastro pafta</small></div>`;
  if (f.n.length > 1) h += `<div class="note w">Bu alanda birden çok pafta numarası var; aradaki sınır çizgisi NCZ'de eksik.</div>`;
  if (!f.n.length) h += `<div class="note w">Bu kadastro pafta alanında numara yazısı yok.</div>`;
  h += `<div class="note n">Kadastro pafta numaraları mahalleye göre tekrar eder.</div>`;
  h += `<div class="stats"><div class="stat"><b>${nf0.format(gis.length)}</b>parsel</div><div class="stat"><b>${nf0.format(st.ada)}</b>ada</div></div>`;
  if (st.mah.length) h += `<div class="sub2">Mahalle: ${st.mah.map(esc).join(', ')}</div>`;
  h += `<div class="acts"><button class="btn pri" data-act="share">${ICON.share}Paylaş</button><button class="btn" data-act="fit">${ICON.map}Haritada</button><button class="btn" data-act="listcsv">${ICON.csv}Liste (CSV)</button></div>`;
  h += `<div class="adal">${groupByAda(gis, part)}</div>`;
  show(h, 'half');
}
function viewAda(a, o = {}){
  const gis = ADA.get(String(parseInt(a, 10)));
  if (!gis){ show(`${backBtn()}<div class="note b">${esc(a)} numaralı ada bulunamadı.</div>`, 'peek'); return; }
  VIEW = {t: 'ada', a, prev: o.prev}; clearHL(); HL.parcels = gis.flatMap(gi => D.g[gi].p);
  const u = {y: new Set(), e: new Set(), i: new Set(), k: new Set()}; for (const gi of gis){ const g = D.g[gi]; for (const s of ORDER) g[s].forEach(([j]) => u[s].add(j)); g.kd.forEach(([j]) => u.k.add(j)); }
  for (const s of ORDER) HL[s] = [...u[s]]; HL.k = [...u.k]; applyHL();
  if (!o.noFit) fitBox(gis.reduce((b, gi) => bxU(b, gBox(D.g[gi])), null), {maxZoom: 18, sheetH: DESK() ? 0 : Math.round(innerHeight * .52)});
  setHash('a' + parseInt(a, 10)); addRecent(String(parseInt(a, 10)));
  const st = listStats(gis);
  let h = backBtn() + `<div class="ttl"><span class="m">${esc(parseInt(a, 10))}</span><small>ada</small></div>`;
  h += `<div class="stats"><div class="stat"><b>${nf0.format(gis.length)}</b>parsel</div>${st.mah.length > 1 ? `<div class="stat"><b>${st.mah.length}</b>mahalle</div>` : ''}</div>`;
  if (st.mah.length > 1) h += `<div class="note w">Bu ada numarası birden çok mahallede geçiyor: ${st.mah.map(esc).join(', ')}.</div>`;
  else if (st.mah.length) h += `<div class="sub2">Mahalle: ${esc(st.mah[0])}</div>`;
  for (const s of ORDER) h += `<div class="sec"><div class="st"><i style="background:var(--${s})"></i>${SYS[s].ad} pafta</div><div class="chips">${[...u[s]].map(j => `<button class="chip ${s}" data-s="${s}" data-j="${j}"><div class="n">${esc(SYS[s].S[j].n)}</div></button>`).join('') || '<div class="note b" style="margin:0">İndeks dışında</div>'}</div></div>`;
  h += `<div class="sec"><div class="st"><i style="background:var(--k)"></i>Kadastro pafta</div><div class="chips">${[...u.k].map(j => `<button class="chip k${KF[j].n.length !== 1 ? ' amb' : ''}" data-kf="${j}"><div class="n">${esc(kadTxt(KF[j]))}</div></button>`).join('') || '<div class="note b" style="margin:0">Çizgi yok</div>'}</div></div>`;
  h += `<div class="acts"><button class="btn pri" data-act="share">${ICON.share}Paylaş</button><button class="btn" data-act="listcsv">${ICON.csv}Liste (CSV)</button></div>`;
  h += `<div class="sec"><div class="st">Parseller</div>${groupByAda(gis)}</div>`;
  show(h, 'half');
}
function hitAt(y, x){
  const h = {y: [], e: [], i: [], k: [], par: [], mah: ''};
  for (const k of ORDER) SYS[k].S.forEach((s, j) => { if (y >= s.b[0] && y <= s.b[2] && x >= s.b[1] && x <= s.b[3] && pip(s.a, y, x)) h[k].push(j); });
  KF.forEach((f, j) => { if (y >= f.b[0] && y <= f.b[2] && x >= f.b[1] && x <= f.b[3] && pip(f.a, y, x)) h.k.push(j); });
  const l = GRID.get(Math.floor(y / CELL) + ',' + Math.floor(x / CELL)) || [];
  for (const i of l){ const b = PB[i]; if (y >= b[0] && y <= b[2] && x >= b[1] && x <= b[3] && pip(PG[i], y, x)) h.par.push(i); }
  for (const m of MH) if (m.n && m.rings.some(r => pip(r, y, x))){ h.mah = m.n; break; }
  return h;
}
function viewPoint(y, x, o = {}){
  const h = hitAt(y, x); const [lo, la] = ll(y, x);
  VIEW = {t: 'pt', y, x, hit: h, prev: o.prev}; clearHL(); HL.pin = [y, x];
  for (const k of ORDER) HL[k] = h[k]; HL.k = h.k;
  const gis = [...new Set(h.par.map(i => P2G[i]))].filter(gi => gi >= 0);
  if (gis.length) HL.sel = D.g[gis[0]].p.slice();
  VIEW.g = gis.length ? gis[0] : null;
  applyHL();
  if (o.fly) fitBox([y - 60, x - 60, y + 60, x + 60], {maxZoom: 18.2, sheetH: DESK() ? 0 : Math.round(innerHeight * .52)});
  setHash('c-' + Math.round(y * 100) + '-' + Math.round(x * 100));
  const inside = y >= KBOX[0] - 200 && y <= KBOX[2] + 200 && x >= KBOX[1] - 200 && x <= KBOX[3] + 200;
  let s = backBtn() + `<div class="st" style="margin-top:2px">${o.src === 'gps' ? 'Yapıştırılan konum' : o.src === 'tm' ? 'Girilen ITRF koordinatı' : 'Seçilen nokta'}</div>`;
  s += `<div class="kv"><span>Y (sağa)</span><b class="coord">${nf2.format(y)}</b><span>X (yukarı)</span><b class="coord">${nf2.format(x)}</b><span>Enlem, boylam</span><b class="coord" style="font-size:13px">${la.toFixed(6)}, ${lo.toFixed(6)}</b></div>`;
  s += `<div class="sub2" style="margin-top:4px">TUREF / TM27 (3°, DOM 27) · EPSG:5253${h.mah ? ' · ' + esc(h.mah) : ''}</div>`;
  if (!inside) s += `<div class="note b">Nokta verinin kapsamı dışında.</div>`;
  if (gis.length) s += `<div class="sec"><div class="st">Parsel</div><div class="chips">${gis.map(gi => `<button class="chip" style="border-color:var(--sel);color:var(--sel)" data-g="${gi}"><div class="n">${esc(D.g[gi].k)}</div><div class="p">${esc(D.g[gi].m || '')} · ${nf2.format(D.g[gi].a)} m²</div></button>`).join('')}</div></div>`;
  else if (inside) s += `<div class="note n">Bu noktada parsel yok (yol, meydan ya da boşluk).</div>`;
  for (const k of ORDER) s += `<div class="sec"><div class="st"><i style="background:var(--${k})"></i>${SYS[k].ad} pafta</div><div class="chips">${h[k].map(j => `<button class="chip ${k}" data-s="${k}" data-j="${j}"><div class="n">${esc(SYS[k].S[j].n)}</div></button>`).join('') || '<div class="sub2">İndeks dışında</div>'}</div></div>`;
  s += `<div class="sec"><div class="st"><i style="background:var(--k)"></i>Kadastro pafta</div><div class="chips">${h.k.map(j => `<button class="chip k${KF[j].n.length !== 1 ? ' amb' : ''}" data-kf="${j}"><div class="n">${esc(kadTxt(KF[j]))}</div></button>`).join('') || '<div class="sub2">Çizgi yok</div>'}</div></div>`;
  if (o.src === 'gps') s += `<div class="note w">Telefon konumu 5–10 m sapabilir. Sınıra yakınsanız parseli haritadan doğrulayın.</div>`;
  s += `<div class="acts"><button class="btn pri" data-act="share">${ICON.share}Paylaş</button><button class="btn" data-act="copyxy">${ICON.copy}Koordinatı kopyala</button></div>`;
  show(s, o.src ? 'half' : (SS === 'full' ? 'half' : SS === 'peek' ? 'half' : SS));
}
function viewMah(mi){
  const m = MH[mi]; let b = null; for (const r of m.rings) b = bxU(b, bboxOf(r));
  VIEW = {t: 'mah', mi}; clearHL(); applyHL(); fitBox(b, {maxZoom: 16});
  const gis = D.g.map((g, gi) => (g.m || '').split(' / ').includes(m.n) ? gi : -1).filter(x => x >= 0);
  const ad = new Set(gis.map(gi => adaOf(D.g[gi].k)).filter(Boolean));
  show(`<div class="ttl">${esc(trUp(m.n))}<small>mahalle</small></div><div class="stats"><div class="stat"><b>${nf0.format(gis.length)}</b>parsel</div><div class="stat"><b>${nf0.format(ad.size)}</b>ada</div></div><div class="note n">Bir ada/parsel numarası yazın ya da haritada dokunun.</div>`, 'peek');
}

/* ---------- toplu sorgu ---------- */
let BR = [], BHEAD = null;
function resolve(k, mah){
  const L = IDX.get(k); if (!L) return {st: 'b', durum: 'Bulunamadı', g: null};
  if (L.length === 1) return {st: 'ok', durum: 'Tamam', g: L[0]};
  const mk = mahKey(mah);
  if (mk){ const s = L.filter(gi => (D.g[gi].m || '').split(' / ').some(x => { const y = mahKey(x); return y && (y.includes(mk) || mk.includes(y)); })); if (s.length === 1) return {st: 'ok', durum: 'Tamam (mahalleye göre seçildi)', g: s[0]}; }
  return {st: 'w', durum: 'Belirsiz: ' + L.map(gi => (D.g[gi].m || 'mahalle ?') + ' → ' + (D.g[gi].y.map(([j]) => SYS.y.S[j].n).join(',') || '-')).join(' | '), g: null};
}
function bulkRun(txt){
  const lines = txt.replace(/\r/g, '').split('\n').filter(l => l.trim());
  BR = []; BHEAD = null; if (!lines.length) return;
  let ca = -1, cp = -1, cm = -1, start = 0;
  if (lines[0].includes('\t')){ const h = lines[0].split('\t').map(c => mahKey(c));
    ca = h.findIndex(c => c === 'ADA' || c.startsWith('ADANO') || c === 'ADANUMARASI'); cp = h.findIndex(c => c.startsWith('PARSEL')); cm = h.findIndex(c => c.startsWith('MAH'));
    if (ca >= 0 && cp >= 0){ BHEAD = lines[0].split('\t'); start = 1; } }
  for (let li = start; li < lines.length; li++){
    const raw = lines[li], cells = raw.split('\t'); let k = null, mah = '';
    if (BHEAD){ k = normKey(cells[ca] ?? '', cells[cp] ?? ''); if (cm >= 0) mah = cells[cm] ?? ''; }
    if (!k){ const m = raw.match(/(\d+)\s*\/\s*(\d+[A-Za-z]?)/); if (m) k = normKey(m[1], m[2]); }
    if (!k && cells.length > 1){ const nums = cells.map(c => c.trim()).filter(c => /^\d+$/.test(c)); if (nums.length >= 2) k = normKey(nums[nums.length - 2], nums[nums.length - 1]); }
    if (!k){ const m = raw.trim().match(/^(\d+)[\s,;\-]+(\d+)(\s+(.*))?$/); if (m){ k = normKey(m[1], m[2]); mah = mah || m[4] || ''; } }
    if (!mah && !BHEAD){ const m = raw.replace(/(\d+)\s*\/\s*(\d+[A-Za-z]?)/, '').replace(/^\s*\d+[\s,;\-]+\d+/, '').trim(); if (/[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(m)) mah = m; }
    BR.push({raw, cells, k, mah, ...(k ? resolve(k, mah) : {st: 'b', durum: 'Ada/parsel okunamadı', g: null})});
  }
}
const sysVal = (g, k) => g[k].map(([j, a]) => SYS[k].S[j].n + (g[k].length > 1 ? ` (${pct(a, g.a)})` : '')).join('; ');
const kadVal = g => g.kd.length ? g.kd.map(([j, a]) => kadTxt(KF[j]) + (KF[j].n.length > 1 ? ' (belirsiz)' : '') + (g.kd.length > 1 ? ` (${pct(a, g.a)})` : '')).join('; ') : 'çizgi yok';
function bulkRows(){
  const head = [...(BHEAD || ['Girdi']), 'Ada', 'Parsel', 'Mahalle (veri)', 'Alan m2', 'Yersel pafta', 'ITRF pafta', 'Kadastro pafta', 'Durum'];
  return [head, ...BR.map(r => { const g = r.g != null ? D.g[r.g] : null;
    return [...(BHEAD ? BHEAD.map((_, j) => r.cells[j] ?? '') : [r.raw]), r.k ? r.k.split('/')[0] : '', r.k ? r.k.slice(r.k.indexOf('/') + 1) : '', g ? g.m : '', g ? nf2.format(g.a) : '',
      g ? (sysVal(g, 'y') || 'İndeks dışı') : '', g ? sysVal(g, 'i') : '', g ? kadVal(g) : '', r.durum]; })];
}
function viewBulk(){
  VIEW = {t: 'bulk', prev: {t: 'home'}}; clearHL(); applyHL(); setHash('toplu');
  const prevTxt = store.get('bulk', '');
  let h = backBtn() + `<div class="ttl">Toplu sorgu</div><div class="sub2">Her satıra bir parsel. Excel'den sütunlarıyla yapıştırabilirsiniz; başlıkta ADA, PARSEL, MAHALLE varsa onlar kullanılır.</div>
    <textarea id="bq" spellcheck="false" placeholder="100/1&#10;101/2  ÖRNEK MAH.">${esc(prevTxt)}</textarea>
    <div class="acts"><button class="btn pri" data-act="brun">Sorgula</button><button class="btn" data-act="bcsv" ${BR.length ? '' : 'disabled'}>${ICON.csv}CSV indir</button><button class="btn" data-act="bcopy" ${BR.length ? '' : 'disabled'}>${ICON.copy}Tabloyu kopyala</button></div><div id="bres"></div>`;
  show(h, 'full'); if (BR.length) bulkRender();
}
function bulkRender(){
  const c = {ok: 0, w: 0, b: 0, multi: 0}; BR.forEach(r => { c[r.st]++; if (r.g != null && (D.g[r.g].y.length > 1 || D.g[r.g].i.length > 1)) c.multi++; });
  let h = `<div class="stats"><div class="stat"><b>${BR.length}</b>satır</div><div class="stat"><b style="color:var(--ok)">${c.ok}</b>bulundu</div><div class="stat"><b style="color:var(--warn)">${c.w}</b>belirsiz</div><div class="stat"><b style="color:var(--bad)">${c.b}</b>bulunamadı</div><div class="stat"><b>${c.multi}</b>çok paftalı</div></div>`;
  h += `<div class="tw"><table><tr><th>#</th><th>Ada/Parsel</th><th>Mahalle</th><th>Yersel</th><th>ITRF</th><th>Kadastro</th><th>Durum</th></tr>`;
  BR.forEach((r, i) => { const g = r.g != null ? D.g[r.g] : null;
    h += `<tr class="cl" data-bi="${i}"><td>${i + 1}</td><td class="m">${esc(r.k || r.raw)}</td><td>${esc(g ? g.m : r.mah)}</td><td class="m"><b>${g ? esc(sysVal(g, 'y') || 'İndeks dışı').replace(/; /g, '<br>') : ''}</b></td><td class="m">${g ? esc(sysVal(g, 'i')).replace(/; /g, '<br>') : ''}</td><td class="m">${g ? esc(kadVal(g)).replace(/; /g, '<br>') : ''}</td><td><span class="bdg ${r.st}">${r.st === 'ok' ? 'Tamam' : r.st === 'w' ? 'Belirsiz' : 'Yok'}</span>${r.st !== 'ok' || r.durum !== 'Tamam' ? `<div class="sub2" style="font-size:11px">${esc(r.durum)}</div>` : ''}</td></tr>`; });
  $('#bres').innerHTML = h + '</table></div>';
  $$('[data-act=bcsv],[data-act=bcopy]').forEach(b => b.disabled = !BR.length);
}

/* ---------- dışa aktarma ---------- */
const DL = { async save({ filename, data }){
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
} };
async function saveFile(name, data, fallbackText){
  if (DL){ try { await DL.save({filename: name, data}); return true; } catch (e){ if (e && e.code === 'declined') return false; } }
  if (fallbackText != null){ try { await navigator.clipboard.writeText(fallbackText); toast('İndirme bu görünümde yok; panoya kopyalandı'); return true; } catch {} }
  toast('İndirme bu görünümde kullanılamıyor'); return false;
}
const csvOf = rows => '﻿' + rows.map(r => r.map(s => /[;"\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : s).join(';')).join('\r\n');
function listRows(gis, k, j){
  const rows = [['Ada', 'Parsel', 'Mahalle', 'Alan m2', 'Yersel pafta', 'ITRF pafta', 'Kadastro pafta', 'Bu paftadaki pay m2']];
  for (const gi of gis){ const g = D.g[gi], [ka, kp] = spl(g.k); let pay = '';
    if (k){ const r = (k === 'k' ? g.kd : g[k]).find(([jj]) => jj === j); pay = r ? nf2.format(r[1]) : ''; }
    rows.push([ka, kp, g.m, nf2.format(g.a), sysVal(g, 'y'), sysVal(g, 'i'), kadVal(g), pay]); }
  return rows;
}
function curTitle(){
  const V = VIEW;
  if (V.t === 'parcel'){ const g = D.g[V.g]; return {name: g.k.replace('/', '-'), title: `${g.k} ${g.m ? '(' + g.m + ')' : ''}`, lines: [...ORDER.map(k => `${SYS[k].ad}: ${g[k].map(([j]) => SYS[k].S[j].n).join(' + ') || 'yok'}`), `Kadastro: ${g.kd.map(([j]) => kadTxt(KF[j])).join(' + ') || 'yok'}`, `Alan: ${nf2.format(g.a)} m²`]}; }
  if (V.t === 'sheet'){ const s = SYS[V.s].S[V.j]; return {name: s.n, title: `${s.n} · ${SYS[V.s].ad} pafta`, lines: [`${nf0.format(SYS[V.s].inv[V.j].length)} parsel`]}; }
  if (V.t === 'kad') return {name: 'kadastro-' + kadTxt(KF[V.j]), title: `Kadastro pafta ${kadTxt(KF[V.j])}`, lines: [`${KINV[V.j].length} parsel`]};
  if (V.t === 'ada') return {name: 'ada-' + V.a, title: `${V.a} ada`, lines: []};
  if (V.t === 'pt') return {name: 'nokta', title: `Y ${nf2.format(V.y)}  X ${nf2.format(V.x)}`, lines: ORDER.map(k => `${SYS[k].ad}: ${V.hit[k].map(j => SYS[k].S[j].n).join(' + ') || 'yok'}`)};
  return {name: 'indeks', title: 'Pafta indeksi', lines: []};
}
async function exportPng(){
  toast('Görüntü hazırlanıyor…', 4000);
  const cam = {center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch()};
  let box = null; const V = VIEW;
  if (V.t === 'parcel') box = gBox(D.g[V.g]); else if (V.t === 'sheet') box = SYS[V.s].S[V.j].b; else if (V.t === 'kad') box = KF[V.j].b;
  else if (V.t === 'ada') box = ADA.get(String(parseInt(V.a, 10))).reduce((b, gi) => bxU(b, gBox(D.g[gi])), null); else if (V.t === 'pt') box = [V.y - 60, V.x - 60, V.y + 60, V.x + 60];
  const sheetWas = sheet.style.visibility; sheet.style.visibility = 'hidden'; EXP = true;
  if (box){ const b = boxLL(box); const c = map.cameraForBounds(b, {padding: {top: 60, bottom: 60, left: 40, right: 40}, bearing: cam.bearing, maxZoom: 18.6}); if (c) map.jumpTo({center: c.center, zoom: c.zoom - (MODE === '3d' ? .45 : 0), bearing: cam.bearing, pitch: cam.pitch}); }
  updParcels();
  await new Promise(r => { let done = false; const fin = () => { if (!done){ done = true; r(); } }; map.once('idle', fin); setTimeout(fin, 2500); });
  const W = map.getCanvas().width, H = map.getCanvas().height;
  const snap = document.createElement('canvas'); snap.width = W; snap.height = H;
  await new Promise(r => { map.once('render', () => { snap.getContext('2d').drawImage(map.getCanvas(), 0, 0); drawOv(); snap.getContext('2d').drawImage(ov, 0, 0, ov.width, ov.height, 0, 0, W, H); r(); }); map.triggerRepaint(); });
  EXP = false; sheet.style.visibility = sheetWas; map.jumpTo(cam); updParcels();
  const t = curTitle(), sc = W / innerWidth, head = Math.round((64 + t.lines.length * 18) * sc), foot = Math.round(30 * sc);
  const out = document.createElement('canvas'); out.width = W; out.height = H + head + foot; const c = out.getContext('2d');
  c.fillStyle = C.halo.replace(/[\d.]+\)$/, '1)'); c.fillRect(0, 0, W, out.height); c.drawImage(snap, 0, head);
  c.fillStyle = C.txt; c.font = `800 ${22 * sc}px ${SANS}`; c.fillText(t.title, 16 * sc, 32 * sc);
  c.font = `600 ${13.5 * sc}px ${MONO}`; t.lines.forEach((l, i) => { c.fillStyle = [C.y, C.i, C.k, C.mut][i] || C.mut; c.fillText(l, 16 * sc, (54 + i * 18) * sc); });
  c.fillStyle = C.mut; c.font = `500 ${11 * sc}px ${SANS}`;
  c.fillText(`Pafta İndeksi 3B · ${new Date().toLocaleDateString('tr-TR')} · Ölçeksiz, bilgi amaçlıdır`, 16 * sc, H + head + 20 * sc);
  const blob = await new Promise(r => out.toBlob(r, 'image/png'));
  if (DL){ try { await DL.save({filename: `pafta_${t.name}.png`, data: blob}); toast('Görüntü kaydedildi'); return; } catch (e){ if (e && e.code === 'declined') return; } }
  const url = URL.createObjectURL(blob);
  modal(`<h3>Görüntü</h3><div class="sub2">Görüntüye basılı tutup kaydedin.</div><img src="${url}" alt="Pafta görüntüsü"><div class="acts"><button class="btn" data-act="close">Kapat</button></div>`);
}

/* ---------- paylaşım ---------- */
function modal(html){ $('#mbody').innerHTML = html; $('#modal').hidden = false; }
function closeModal(){ $('#modal').hidden = true; $('#mbody').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-act=close]')) closeModal(); });
function shareText(){ const V = VIEW; if (V.t === 'parcel') return textOf(D.g[V.g]); const t = curTitle(); return t.title + (t.lines.length ? ' · ' + t.lines.join(' · ') : ''); }
function shareUrl(){ return (SHARE_BASE || location.href.split('#')[0]) + (CURH ? '#' + CURH : ''); }
function openShare(){
  const url = shareUrl(), txt = shareText();
  modal(`<h3>Paylaş</h3><div class="sub2">${esc(txt)}</div><div class="lnk" id="lnk">${esc(url)}</div>
    <div class="acts"><button class="btn pri" data-act="cplink">${ICON.copy}Bağlantıyı kopyala</button><a class="btn" href="https://wa.me/?text=${encodeURIComponent(txt + '\n' + url)}" target="_blank" rel="noopener">WhatsApp</a>
    <button class="btn" data-act="cptxt">${ICON.copy}Metni kopyala</button><button class="btn" data-act="png">${ICON.img}Görüntü</button><button class="btn" data-act="close">Kapat</button></div>
    <div class="foot">Bağlantıyı açan kişinin bu sayfaya erişimi olmalı (sayfa sahibinin paylaşım ayarı).</div>`);
}
async function copyText(t, ok){ try { await navigator.clipboard.writeText(t); toast(ok); } catch { toast('Kopyalanamadı; metni seçip kopyalayın'); } }

/* ---------- yönlendirme ---------- */
function route(h, o = {}){
  h = String(h || '').replace(/^#/, '');
  const prev = VIEW.t !== 'home' && !o.fromHash ? Object.assign({}, VIEW) : (o.fromHash ? null : {t: 'home'});
  let m;
  if (!h) return viewHome();
  if (h === 'toplu') return viewBulk();
  if ((m = h.match(/^p(\d+)-([0-9A-Za-z]+)(?:-m(\d+))?$/))){ const k = normKey(m[1], m[2]); const L = IDX.get(k); return viewParcel(k, {gi: L && m[3] != null ? L[+m[3]] : undefined, prev}); }
  if ((m = h.match(/^a(\d+)$/))) return viewAda(m[1], {prev});
  if ((m = h.match(/^s-([yei])-([0-9A-Z]+)$/))){ const j = SYS[m[1]].S.findIndex(s => normSheet(s.n) === m[2]); if (j >= 0) return viewSheet(m[1], j, {prev}); }
  if ((m = h.match(/^k-(\d+)$/)) && KF[+m[1]]) return viewKad(+m[1], {prev});
  if ((m = h.match(/^c-(\d+)-(\d+)$/))) return viewPoint(+m[1] / 100, +m[2] / 100, {prev: o.fromHash ? null : prev, fly: !!o.fromHash});
  viewHome();
}
function goBack(){ const p = VIEW.prev; if (!p || p.t === 'home') return viewHome();
  if (p.t === 'parcel') return viewParcel(p.k, {gi: p.g, prev: null}); if (p.t === 'sheet') return viewSheet(p.s, p.j, {prev: null}); if (p.t === 'kad') return viewKad(p.j, {prev: null});
  if (p.t === 'ada') return viewAda(p.a, {prev: null}); if (p.t === 'pt') return viewPoint(p.y, p.x, {prev: null}); viewHome(); }

/* ---------- arama ---------- */
function parseLL(s){
  const dms = [...s.matchAll(/(\d{1,3})\s*°\s*(\d{1,2})\s*['’′]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["”″]|'')?\s*([NSEWKGDB])?/gi)];
  let v = null;
  if (dms.length >= 2) v = dms.slice(0, 2).map(m => +m[1] + +m[2] / 60 + parseFloat(m[3].replace(',', '.')) / 3600);
  else { const n = [...s.replace(/(\d),(\d{3,})/g, '$1.$2').matchAll(/-?\d{1,3}\.\d{3,}/g)].map(m => parseFloat(m[0])); if (n.length >= 2) v = n.slice(0, 2); }
  if (!v) return null;
  const isLat = a => a > 35 && a < 43, isLon = a => a > 25 && a < 46;
  if (isLat(v[0]) && isLon(v[1]) && !(isLat(v[1]) && !isLat(v[0]))) return {lat: v[0], lon: v[1]};
  if (isLat(v[1]) && isLon(v[0])) return {lat: v[1], lon: v[0]};
  return null;
}
function parseTM(s){
  const n = [...s.replace(/(\d),(\d{1,3})(?!\d)/g, '$1.$2').matchAll(/\d{6,7}(?:\.\d+)?/g)].map(m => parseFloat(m[0]));
  if (n.length < 2) return null; const [a, b] = n;
  if (a > 300000 && a < 700000 && b > 4000000 && b < 4700000) return [a, b];
  if (b > 300000 && b < 700000 && a > 4000000 && a < 4700000) return [b, a];
  return null;
}
function findSheets(q){ const n = normSheet(q); if (n.length < 3) return []; const out = []; for (const k of ORDER) SYS[k].S.forEach((s, j) => { if (normSheet(s.n) === n) out.push([k, j]); }); return out; }
function search(q){
  q = String(q || '').trim(); $('#sugg').style.display = 'none'; if (!q) return viewHome();
  $('#q').blur();
  const prev = VIEW.t !== 'home' ? Object.assign({}, VIEW) : {t: 'home'};
  const k = parseQ(q); if (k && IDX.has(k)) return viewParcel(k, {prev});
  const ll_ = parseLL(q); if (ll_){ const [y, x] = TM.fwd(ll_.lon, ll_.lat); return viewPoint(y, x, {src: 'gps', fly: true, prev}); }
  const tm = parseTM(q); if (tm) return viewPoint(tm[0], tm[1], {src: 'tm', fly: true, prev});
  const sh = findSheets(q); if (sh.length){ addRecent(normSheet(q)); const pick = sh.find(([s]) => s === 'i') || sh[0]; return viewSheet(pick[0], pick[1], {prev}); }
  if (/^\d+\s*\/?$/.test(q)) return viewAda(q.replace(/\D/g, ''), {prev});
  const raw = trUp(q).replace(/\s+/g, ''); if (IDX.has(raw)) return viewParcel(raw, {prev});
  const mk = mahKey(q); if (mk.length >= 3){ const mi = MH.findIndex(m => m.n && mahKey(m.n).includes(mk)); if (mi >= 0) return viewMah(mi); }
  if (k) return viewParcel(k, {prev});
  show(`<div class="note b">“${esc(q)}” anlaşılamadı. Ör. 100/1 · 100 · 01A1A · L18A01A1A · 39.9255, 32.8662</div>`, 'peek');
}
let sIdx = -1;
function sugg(){
  const v = $('#q').value.trim(); $('#qx').hidden = !v; const box = $('#sugg'); sIdx = -1; const out = [];
  const m = v.replace(/\s*[\/\-\s,;.]\s*/, '/').match(/^(\d+)\/(\d*)$/);
  if (m){ const pre = parseInt(m[1], 10) + '/' + m[2]; for (const k of KEYS){ if (k.startsWith(pre)){ const L = IDX.get(k); out.push([k, (D.g[L[0]].m || '') + (L.length > 1 ? ' +' + (L.length - 1) : '')]); if (out.length >= 40) break; } } }
  else if (/^[A-Za-z0-9]{2,}$/.test(v.replace(/[\s\-]/g, '')) && /[A-Za-z]/.test(v)){ const n = normSheet(v);
    for (const k of ORDER) for (const s of SYS[k].S) if (normSheet(s.n).startsWith(n)) out.push([s.n, SYS[k].ad]);
    out.sort((a, b) => a[0].localeCompare(b[0])); out.splice(30); }
  if (!out.length){ box.style.display = 'none'; return; }
  box.innerHTML = out.map(([k, t]) => `<div class="si" data-k="${esc(k)}"><b>${esc(k)}</b><span>${esc(t)}</span></div>`).join(''); box.style.display = 'block';
}
$('#q').addEventListener('input', sugg);
$('#q').addEventListener('keydown', e => {
  const items = $$('#sugg .si'), on = $('#sugg').style.display === 'block';
  if (on && (e.key === 'ArrowDown' || e.key === 'ArrowUp')){ e.preventDefault(); sIdx = Math.max(0, Math.min(items.length - 1, sIdx + (e.key === 'ArrowDown' ? 1 : -1))); items.forEach((d, i) => d.classList.toggle('act', i === sIdx)); items[sIdx]?.scrollIntoView({block: 'nearest'}); return; }
  if (e.key === 'Enter'){ e.preventDefault(); if (on && sIdx >= 0) $('#q').value = items[sIdx].dataset.k; search($('#q').value); }
  if (e.key === 'Escape') $('#sugg').style.display = 'none';
});
$('#q').addEventListener('blur', () => setTimeout(() => $('#sugg').style.display = 'none', 150));
$('#sugg').addEventListener('pointerdown', e => { const d = e.target.closest('.si'); if (!d) return; e.preventDefault(); $('#q').value = d.dataset.k; search(d.dataset.k); });
$('#go').onclick = () => search($('#q').value);
$('#qx').onclick = () => { $('#q').value = ''; $('#qx').hidden = true; $('#sugg').style.display = 'none'; viewHome(); $('#q').focus(); };

/* ---------- panel tıklamaları ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-s],[data-kf],[data-g],[data-gi],[data-q],[data-act],[data-bi]'); if (!t) return;
  const V = Object.assign({}, VIEW);
  if (t.dataset.s && t.dataset.j != null) return viewSheet(t.dataset.s, +t.dataset.j, {prev: V.t === 'sheet' ? V.prev : V});
  if (t.dataset.kf != null) return viewKad(+t.dataset.kf, {prev: V});
  if (t.dataset.gi != null) return viewParcel(VIEW.k, {gi: +t.dataset.gi, prev: VIEW.prev});
  if (t.dataset.g != null){ const g = D.g[+t.dataset.g]; return viewParcel(g.k, {gi: +t.dataset.g, prev: V}); }
  if (t.dataset.q != null){ $('#q').value = t.dataset.q; return search(t.dataset.q); }
  if (t.dataset.bi != null){ const r = BR[+t.dataset.bi]; if (r.k && IDX.has(r.k)) return viewParcel(r.k, {gi: r.g ?? undefined, prev: {t: 'bulk'}}); return; }
  const a = t.dataset.act;
  if (a === 'back'){ if (VIEW.prev && VIEW.prev.t === 'bulk') return viewBulk(); return goBack(); }
  if (a === 'share') return openShare();
  if (a === 'png'){ closeModal(); return exportPng(); }
  if (a === 'copy') return copyText(textOf(D.g[VIEW.g]), 'Panoya kopyalandı');
  if (a === 'copyxy') return copyText(`${VIEW.y.toFixed(2)} ${VIEW.x.toFixed(2)}`, 'Koordinat kopyalandı');
  if (a === 'cplink') return copyText(shareUrl(), 'Bağlantı kopyalandı');
  if (a === 'cptxt') return copyText(shareText() + '\n' + shareUrl(), 'Metin kopyalandı');
  if (a === 'ada') return viewAda(t.dataset.ada, {prev: V});
  if (a === 'fit'){ if (VIEW.t === 'sheet') fitBox(SYS[VIEW.s].S[VIEW.j].b, {maxZoom: 17.2}); else if (VIEW.t === 'kad') fitBox(KF[VIEW.j].b, {maxZoom: 17.2}); setSheet('peek'); return; }
  if (a === 'listcsv'){ const gis = VIEW.t === 'sheet' ? SYS[VIEW.s].inv[VIEW.j] : VIEW.t === 'kad' ? KINV[VIEW.j] : ADA.get(String(parseInt(VIEW.a, 10)));
    const rows = listRows(gis, VIEW.t === 'sheet' ? VIEW.s : VIEW.t === 'kad' ? 'k' : null, VIEW.j); const n = curTitle().name;
    return saveFile(`parseller_${n}.csv`, csvOf(rows), rows.map(r => r.join('\t')).join('\n')); }
  if (a === 'bulk') return viewBulk();
  if (a === 'brun'){ const v = $('#bq').value; store.set('bulk', v.slice(0, 200000)); bulkRun(v); bulkRender(); return; }
  if (a === 'bcsv'){ const rows = bulkRows(); return saveFile('pafta_toplu.csv', csvOf(rows), rows.map(r => r.join('\t')).join('\n')); }
  if (a === 'bcopy') return copyText(bulkRows().map(r => r.join('\t')).join('\n'), 'Tablo kopyalandı; Excel\'e yapıştırabilirsiniz');
  if (a === 'about') return modal(`<h3>Veri ve notlar</h3><div class="kv"><span>Kaynak</span><b>${esc(D.meta.kaynak)}</b><span>Tarih</span><b>${esc(D.meta.tarih)}</b><span>Koordinat</span><b>${esc(D.meta.crs)}</b><span>Parsel</span><b>${nf0.format(D.meta.parsel)}</b><span>Pafta</span><b>${D.meta.yersel} Yersel · ${D.meta.itrf} ITRF</b></div>
    <div class="note n">Parselin bir paftaya düşen payı 1 m²'nin ya da parsel alanının %1'inin altındaysa listelenmez (çizim kaynaklı kıymıklar).</div>
    <div class="note w">Bazı bölgelerde kadastro pafta çizgisi bulunmayabilir. Yıldızlı (*) Yersel paftaların çerçevesi NCZ'de olmadığından ızgaradan tamamlanmıştır.</div>
    <div class="note n">Telefon konumu (WGS84) TUREF'e doğrudan çevrilir; aradaki fark 1 m'nin altındadır, telefon hatası ise 5–10 m olabilir.</div>
    <div class="acts"><button class="btn" data-act="close">Kapat</button></div>`);
  if (a === 'close') return closeModal();
});

/* ---------- düğmeler ---------- */
$('#bMode').onclick = () => { MODE = MODE === '3d' ? '2d' : '3d'; store.set('mode', MODE); applyMode(true); };
$('#bNorth').onclick = () => map.easeTo({bearing: 0, pitch: MODE === '3d' ? map.getPitch() : 0, duration: REDUCE ? 0 : 500});
$('#bHome').onclick = () => { const cam = map.cameraForBounds(boxLL(KBOX), {padding: pad(), bearing: map.getBearing()}); if (cam) map.flyTo({...cam, zoom: cam.zoom - (MODE === '3d' ? .3 : 0), pitch: MODE === '3d' ? 50 : 0, duration: REDUCE ? 0 : 1000}); setSheet('peek'); };
$('#bLay').onclick = e => { e.stopPropagation(); const p = $('#layers'); p.hidden = !p.hidden; $('#bLay').classList.toggle('on', !p.hidden); };
document.addEventListener('pointerdown', e => { const p = $('#layers'); if (!p.hidden && !e.target.closest('#layers,#bLay')){ p.hidden = true; $('#bLay').classList.remove('on'); } });
$$('#layers input[data-l]').forEach(cb => { cb.checked = VIS[cb.dataset.l]; cb.onchange = () => { VIS[cb.dataset.l] = cb.checked; store.set('vis', VIS); applyVis(); drawOv(); }; });
$('#gap').oninput = () => { GAP = +$('#gap').value; $('#gapv').textContent = '×' + nf1.format(GAP); setHeights(); };
$('#gapv').textContent = '×1,0';

/* ---------- başlat ---------- */
(async () => {
  try {
    await loadData();
    $('#ldt').textContent = 'Harita hazırlanıyor…';
    if (!window.maplibregl) throw new Error('Harita kütüphanesi yüklenemedi.');
    await initMap();
    if (MODE === '3d') map.jumpTo({zoom: map.getZoom() + .1});
    route(location.hash.slice(1), {fromHash: true});
    if (!location.hash) setSheet('peek');
    $('#loading').remove();
  } catch (e){ console.error(e); $('#ldt').textContent = 'Açılamadı: ' + e.message; }
})();
