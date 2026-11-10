'use strict';
/* Gym Bro — single-user workout tracker. All data stays in this browser (localStorage). */
const KEY = 'gymbro.v1';
const uid = () => Math.random().toString(36).slice(2, 10);
const mk = (name, sets, repMin, repMax, rest, bw = false) => ({ id: uid(), name, sets, repMin, repMax, rest, bw });

function seed() {
  return {
    routines: [
      { id: uid(), name: 'Upper', exercises: [mk('Incline Bench Press', 3, 8, 8, 150), mk('Pull-up', 3, 8, 8, 150, true), mk('Dips', 3, 8, 8, 120, true), mk('Pendlay Row', 3, 8, 8, 120), mk('Lateral Raise', 3, 12, 12, 120)] },
      { id: uid(), name: 'Lower', exercises: [mk('Squat (hack or barbell)', 3, 6, 8, 210), mk('Leg Adductor', 3, 10, 12, 120), mk('Romanian Deadlift', 3, 8, 8, 180), mk('Leg Extension', 3, 8, 12, 120), mk('Leg Curl', 3, 8, 12, 120)] },
      { id: uid(), name: 'Full Body', exercises: [mk('Bulgarian Split Squat', 3, 6, 8, 150), mk('Leg Extension', 3, 8, 12, 120), mk('Decline Crunch', 3, 10, 12, 120, true), mk('Incline DB Bench Press', 3, 8, 8, 120), mk('Chin-up', 3, 8, 10, 120, true), mk('Lateral Raise', 3, 12, 12, 120)] }
    ],
    history: [], stats: {}, lastRoutineId: null, active: null, lastSummary: null
  };
}

let S = null;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
function normalise(d) {
  if (!d || !Array.isArray(d.routines)) return null;
  d.history = Array.isArray(d.history) ? d.history : [];
  d.stats = d.stats && typeof d.stats === 'object' ? d.stats : {};
  d.routines.forEach(r => { r.id = r.id || uid(); r.name = r.name || 'Routine'; r.exercises = Array.isArray(r.exercises) ? r.exercises : []; r.exercises.forEach(e => { e.id = e.id || uid(); e.name = e.name || 'Exercise'; e.sets = +e.sets || 3; e.repMin = +e.repMin || 8; e.repMax = Math.max(e.repMin, +e.repMax || e.repMin); e.rest = +e.rest || 120; e.bw = !!e.bw; }); });
  if (d.active && (!Array.isArray(d.active.exs) || !Array.isArray(d.active.order) || !d.active.exs[d.active.order[d.active.pos]])) d.active = null;
  if (d.lastSummary === undefined) d.lastSummary = null;
  d.settings = Object.assign({ iosTimer: false }, d.settings || {});
  return d;
}
S = normalise(S) || seed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

let view = { name: S.active ? 'workout' : 'home' };
const app = document.getElementById('app');

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = sec => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); };
const clock = ms => { const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
const fdate = ts => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const dayKey = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const routine = id => S.routines.find(r => r.id === id);
const lastDone = rid => { const h = S.history.find(e => e.rid === rid); return h ? h.end : null; };
const repTxt = (r, min, max) => r < min ? '<' + min : r > max ? '>' + max : String(r);
const rng = e => e.repMin === e.repMax ? String(e.repMin) : e.repMin + '–' + e.repMax;
const wTxt = (w, bw) => bw ? (w ? 'BW+' + w : 'BW') : String(w);
const flagOf = (sets, min, max) => sets.some(s => s.r < min) ? 'down' : sets.some(s => s.r > max) ? 'up' : null;
const TAG = { up: '<span class="tag up">↑ Try more weight</span>', down: '<span class="tag down">↓ Try less weight</span>' };
const TAGS = { up: '<span class="tag up">↑ More weight</span>', down: '<span class="tag down">↓ Less weight</span>' };
const ICON = {
  clock: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  dots: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>',
  up: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  x: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};

function nextRoutine() {
  if (!S.routines.length) return null;
  const i = S.routines.findIndex(r => r.id === S.lastRoutineId);
  return S.routines[(i + 1) % S.routines.length];
}

/* ---------- layout pieces ---------- */
const head = (label, title, right = '') => `<div class="head"><div class="label"><span>${label}</span>${right}</div><h1 class="title">${title}</h1></div>`;
const tiles = items => `<div class="tiles" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">${items.map(([a, b]) => `<div class="tile"><span class="big">${a}</span><span class="small">${b}</span></div>`).join('')}</div>`;
const pill = (text, action, sec = false, extra = '') => `<button class="pill${sec ? ' sec' : ''}" data-a="${action}" ${extra}><span class="fill"></span><span>${text}</span></button>`;
const backTop = (to, label, right = '') => `<div class="top"><button class="back" data-a="go" data-to="${to}">‹ ${label}</button>${right}</div>`;

function totals(A) {
  const total = A.order.reduce((n, i) => n + A.exs[i].sets, 0) + Object.keys(A.logs).filter(i => !A.order.includes(+i)).reduce((n, i) => n + A.logs[i].length, 0);
  const done = Object.values(A.logs).reduce((n, l) => n + l.length, 0);
  return { total: Math.max(total, done), done };
}
function progress(A, full) {
  const { total, done } = totals(A);
  const pct = full ? 100 : total ? Math.round(done / total * 100) : 0;
  return `<div class="prog"><div class="row"><b>${esc(A.name)} · <span data-elapsed style="color:inherit">${clock(Date.now() - A.start)}</span></b><span>${full ? total + ' / ' + total : done + ' / ' + total} sets</span></div><div class="bar"><div style="width:${pct}%"></div></div></div>`;
}

/* ---------- screens ---------- */
function vHome() {
  const n = nextRoutine();
  const top = `<div class="top"><span class="brand">Gym Bro</span><div class="icons"><button class="icon" aria-label="History" data-a="go" data-to="history">${ICON.clock}</button><button class="icon" aria-label="Menu" data-a="go" data-to="menu">${ICON.dots}</button></div></div>`;
  if (!n) return top + head('Next up', 'No routines') + `<div class="content"><p class="empty">Add a routine to get started.</p></div>` + pill('+ New routine', 'newRoutine');
  const ld = lastDone(n.id);
  const days = ld == null ? null : Math.round((dayKey(Date.now()) - dayKey(ld)) / 864e5);
  const since = days == null ? '–' : days + 'd';
  const sets = n.exercises.reduce((a, e) => a + e.sets, 0);
  const i = S.routines.indexOf(n);
  let rows = '';
  for (let k = 1; k < S.routines.length; k++) {
    const r = S.routines[(i + k) % S.routines.length], d = lastDone(r.id);
    rows += `<div class="row64"><span class="nm">${esc(r.name)}</span><span class="meta">${d ? fdate(d) : 'Not yet'}</span></div>`;
  }
  return top + head('Next up', esc(n.name)) +
    `<div class="content">${tiles([[n.exercises.length, 'exercises'], [sets, 'sets'], [since, 'since last']])}${rows ? '<span class="sect">Then</span>' + rows : ''}</div>` +
    (n.exercises.length ? pill('Hold to start', 'start', false, `data-hold data-id="${n.id}"`) : pill('Add exercises', 'edit', false, `data-id="${n.id}"`));
}

function vWorkout() {
  const A = S.active, e = A.exs[A.order[A.pos]];
  if (A.phase === 'start') {
    const st = S.stats[e.name] || {}, w = st.w != null ? st.w : (e.bw ? 0 : 20);
    return progress(A) + head(`Exercise ${A.pos + 1} of ${A.order.length}`, esc(e.name), `<button class="mini" data-a="skip">Skip exercise</button>`) +
      `<div class="content">${tiles([[e.sets, 'sets'], [rng(e), 'reps'], [e.bw ? (w ? '+' + w : 'BW') : w, e.bw ? 'bodyweight' : 'kg']])}${st.flag ? TAG[st.flag] : ''}</div>` +
      pill('Start', 'beginEx');
  }
  if (A.phase === 'log') {
    const lo = e.bw ? 0 : Math.max(0, A.w - 40), hi = e.bw ? Math.max(60, A.w + 20) : A.w + 40;
    const stops = []; for (let r = e.repMin - 1; r <= e.repMax + 1; r++) stops.push(r);
    return progress(A) + head(`Set ${A.set + 1} of ${e.sets}`, esc(e.name), `<button class="mini" data-a="finish">Finish</button>`) +
      `<div class="content">
      <div class="card"><div class="lr"><label for="w">${e.bw ? 'Bodyweight +' : 'Weight'}</label><div class="adj"><button class="sq" aria-label="Less weight" data-a="w" data-d="-1">−</button><span class="val" data-wv>${A.w}<small> kg</small></span><button class="sq" aria-label="More weight" data-a="w" data-d="1">+</button></div></div>
      <input id="w" type="range" data-in="w" min="${lo}" max="${hi}" step="1" value="${A.w}"></div>
      <div class="card"><div class="lr"><label for="r">Reps · ${rng(e)}</label><span class="val" data-rv>${repTxt(A.r, e.repMin, e.repMax)}</span></div>
      <input id="r" type="range" data-in="r" min="${e.repMin - 1}" max="${e.repMax + 1}" step="1" value="${A.r}" aria-valuetext="${repTxt(A.r, e.repMin, e.repMax)} reps">
      <div class="stops" style="grid-template-columns:repeat(${stops.length},minmax(0,1fr))">${stops.map(r => `<span data-stop="${r}"${r === A.r ? ' class="on"' : ''}>${repTxt(r, e.repMin, e.repMax)}</span>`).join('')}</div>
      <div class="note" data-note></div></div></div>` +
      pill('Log set', 'logSet');
  }
  // rest
  const left = Math.max(0, (A.restEnd - Date.now()) / 1000);
  const nextTxt = A.set === 0 ? esc(e.name) : `Set ${A.set + 1} · ${e.bw ? wTxt(A.w, true) : A.w + ' kg'} × ${rng(e)}`;
  const prevName = A.restLabel || e.name;
  return progress(A) + head(esc(prevName), 'Rest', A.undo ? `<button class="mini" data-a="undo">Undo set</button>` : '') +
    `<div class="content"><div class="ringwrap"><div class="ring"><svg role="img" aria-label="Rest timer" width="260" height="260" viewBox="0 0 260 260"><circle cx="130" cy="130" r="116" fill="none" stroke="var(--card)" stroke-width="24"/><circle data-arc cx="130" cy="130" r="116" fill="none" stroke="var(--lime)" stroke-width="24" stroke-linecap="round" stroke-dasharray="728.85" stroke-dashoffset="${728.85 * (1 - left / A.restDur)}" transform="rotate(-90 130 130)"/></svg><span class="t" data-rest>${mmss(left)}</span></div>
    <div class="next"><span class="small" style="font-size:15px">Next</span><b>${nextTxt}</b></div></div></div>` +
    pill('Skip rest', 'endRest', true);
}

function vSummary() {
  const E = S.lastSummary;
  if (!E) { view = { name: 'home' }; return vHome(); }
  const sets = E.exs.reduce((n, x) => n + x.sets.length, 0);
  const mins = Math.max(1, Math.round((E.end - E.start) / 60000));
  const flagged = E.exs.map(x => [x, flagOf(x.sets, x.repMin, x.repMax)]).filter(([, f]) => f);
  return `<div class="prog"><div class="row"><b>${esc(E.name)} · ${clock(E.end - E.start)}</b><span>${sets} / ${sets} sets</span></div><div class="bar"><div style="width:100%"></div></div></div>` +
    head(fdate(E.end), 'Workout done') +
    `<div class="content">${tiles([[mins, 'minutes'], [sets, 'sets']])}<span class="sect">Next time</span>${flagged.length ? flagged.map(([x, f]) => `<div class="row64" style="padding-top:12px;padding-bottom:12px"><span class="nm" style="white-space:normal">${esc(x.name)}</span>${TAGS[f].replace('class="tag', 'style="align-self:center" class="tag')}</div>`).join('') : '<p class="empty">Every set was in range. Keep the same weights.</p>'}</div>` +
    pill('Done', 'go', false, 'data-to="home"');
}

function setsLine(x) {
  const sameW = x.sets.every(s => s.w === x.sets[0].w);
  if (sameW) return wTxt(x.sets[0].w, x.bw) + ' × ' + x.sets.map(s => repTxt(s.r, x.repMin, x.repMax)).join(' · ');
  return x.sets.map(s => wTxt(s.w, x.bw) + '×' + repTxt(s.r, x.repMin, x.repMax)).join(' · ');
}
function vHistory() {
  const list = S.history.map(E => {
    const mins = Math.max(1, Math.round((E.end - E.start) / 60000));
    const meta = `${fdate(E.end)} · ${mins} min`;
    if (view.open === E.id) {
      return `<div class="card"><button data-a="toggle" data-id="${E.id}" style="all:unset;display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer"><span style="font-size:20px;font-weight:700">${esc(E.name)}</span><span class="meta">${meta}</span></button>
      <div class="sets">${E.exs.map(x => `<div>${esc(x.name)}<span>${setsLine(x)}</span></div>`).join('')}</div>
      <button class="mini" style="align-self:flex-start" data-a="delHist" data-id="${E.id}">Delete workout</button></div>`;
    }
    return `<button class="row64" data-a="toggle" data-id="${E.id}"><span class="nm">${esc(E.name)}</span><span class="meta">${meta}</span></button>`;
  }).join('');
  return backTop('home', 'Gym Bro') + head('All workouts', 'History') + `<div class="content">${list || '<p class="empty">No workouts yet.</p>'}</div>`;
}

function vMenu() {
  const rows = S.routines.map((r, i) => `<div class="rowx"><button class="row64" data-a="edit" data-id="${r.id}"><span class="nm">${esc(r.name)}</span><span class="meta">${r.exercises.length} exercises</span></button>${i ? `<button class="icon" style="height:64px;width:56px;border-radius:24px" aria-label="Move ${esc(r.name)} up" data-a="rUp" data-i="${i}">${ICON.up}</button>` : ''}</div>`).join('');
  return backTop('home', 'Gym Bro') + head('Rotation order', 'Routines') +
    `<div class="content">${rows || '<p class="empty">No routines yet.</p>'}
    <span class="sect">Rest timer</span>
    <button class="row64" data-a="iosTimer" aria-pressed="${S.settings.iosTimer}"><span class="nm">Use iPhone timer</span><span class="meta"${S.settings.iosTimer ? ' style="color:var(--limeTx);font-weight:700"' : ''}>${S.settings.iosTimer ? 'On' : 'Off'}</span></button>
    <button class="row64" data-a="testTimer"><span class="nm">Test iPhone timer</span><span class="meta">10 seconds</span></button>
    <span class="sect">Your data</span>
    <button class="row64" data-a="export"><span class="nm">Back up data</span><span class="meta">Download</span></button>
    <button class="row64" data-a="import"><span class="nm">Restore backup</span><span class="meta">Choose file</span></button>
    <input type="file" accept="application/json,.json" class="sr" id="importFile" data-in="import"></div>` +
    pill('+ New routine', 'newRoutine');
}

function vEdit() {
  const R = routine(view.id);
  if (!R) { view = { name: 'menu' }; return vMenu(); }
  const step = (f, i, v, lab) => `<div class="ctl"><span class="small">${lab}</span><div class="stepper"><button aria-label="Decrease ${lab}" data-a="step" data-f="${f}" data-i="${i}" data-d="-1">−</button><b>${v}</b><button aria-label="Increase ${lab}" data-a="step" data-f="${f}" data-i="${i}" data-d="1">+</button></div></div>`;
  const cards = R.exercises.map((e, i) => `<div class="card">
    <div class="lr"><label class="sr" for="n${i}">Exercise name</label><input type="text" id="n${i}" class="exname" data-in="exname" data-i="${i}" value="${esc(e.name)}" placeholder="Exercise name">
    <div class="icons">${i ? `<button class="icon" style="width:40px;height:40px;background:var(--ctl)" aria-label="Move up" data-a="exUp" data-i="${i}">${ICON.up}</button>` : ''}<button class="icon" style="width:40px;height:40px;background:var(--ctl)" aria-label="Remove exercise" data-a="exDel" data-i="${i}">${ICON.x}</button></div></div>
    <div class="grid2">${step('sets', i, e.sets, 'Sets')}<div class="ctl"><span class="small">Type</span><button class="toggle${e.bw ? ' on' : ''}" data-a="bw" data-i="${i}" aria-pressed="${e.bw}">${e.bw ? 'Bodyweight' : 'Weighted'}</button></div></div>
    <div class="grid2">${step('repMin', i, e.repMin, 'Min reps')}${step('repMax', i, e.repMax, 'Max reps')}</div>
    <div class="lr"><label for="rest${i}">Rest</label><b style="font-size:20px" data-restv="${i}">${mmss(e.rest)}</b></div>
    <input type="range" id="rest${i}" data-in="rest" data-i="${i}" min="30" max="300" step="30" value="${e.rest}"></div>`).join('');
  return backTop('menu', 'Routines', `<button class="back" data-a="go" data-to="menu">Done</button>`) +
    `<div class="head"><div class="label"><span>Edit routine</span><button class="mini" data-a="delRoutine">Delete</button></div><label class="sr" for="rn">Routine name</label><input type="text" id="rn" class="title" data-in="rname" value="${esc(R.name)}"></div>` +
    `<div class="content">${cards || '<p class="empty">No exercises yet.</p>'}</div>` + pill('+ Add exercise', 'addEx', true);
}

/* ---------- render ---------- */
let updateReady = false;
function tryReload() { if (updateReady && view.name === 'home') { updateReady = false; location.reload(); } }
let screenKey = '', screenAt = 0;
function render() {
  const V = { home: vHome, workout: vWorkout, summary: vSummary, history: vHistory, menu: vMenu, edit: vEdit };
  if (view.name === 'workout' && !S.active) view = { name: 'home' };
  app.innerHTML = (V[view.name] || vHome)();
  fitTitles();
  const A0 = S.active, key = view.name + (view.name === 'workout' && A0 ? '/' + A0.phase + '/' + A0.pos + '/' + A0.set : '');
  if (key !== screenKey) { screenKey = key; screenAt = Date.now(); }
  tryReload();
  if (view.name === 'workout' && S.active.phase === 'log') updateLog();
  wake(view.name === 'workout');
}

// shrink long titles so they fit on one line (52px down to 30px)
function fitTitles() { app.querySelectorAll('h1.title').forEach(t => { const rg = document.createRange(); rg.selectNodeContents(t); const too = () => rg.getBoundingClientRect().width > t.clientWidth - 2; let s = 52; t.style.fontSize = ''; while (too() && s > 30) { s -= 2; t.style.fontSize = s + 'px'; } }); }
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitles);
if (document.fonts) document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', fitTitles);
window.addEventListener('resize', fitTitles);

/* ---------- optional: hand the rest time to the iPhone's own timer via a Shortcut named "Gym Rest" ---------- */
const SHORTCUT = 'Gym Rest';
let launch = u => { window.location.href = u; };
function iosTimer(seconds) { if (S.settings.iosTimer) launch('shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT) + '&input=text&text=' + seconds); }

/* ---------- workout logic ---------- */
function startWorkout(id) {
  const R = routine(id); if (!R || !R.exercises.length) return;
  S.active = { rid: R.id, name: R.name, start: Date.now(), exs: JSON.parse(JSON.stringify(R.exercises)), order: R.exercises.map((_, i) => i), pos: 0, set: 0, phase: 'start', logs: {}, skips: {}, w: 0, r: 0 };
  save(); view = { name: 'workout' }; render();
}
function curEx() { const A = S.active; return A.exs[A.order[A.pos]]; }
function beginEx() {
  const A = S.active, e = curEx(), st = S.stats[e.name] || {};
  A.w = st.w != null ? st.w : (e.bw ? 0 : 20);
  A.r = e.repMax; A.phase = 'log'; save(); render();
}
function logSet() {
  const A = S.active, e = curEx(), idx = A.order[A.pos];
  A.undo = { idx, pos: A.pos, set: A.set, w: A.w, r: A.r, prevW: (S.stats[e.name] || {}).w, prevFlag: (S.stats[e.name] || {}).flag };
  (A.logs[idx] = A.logs[idx] || []).push({ w: A.w, r: A.r });
  S.stats[e.name] = Object.assign(S.stats[e.name] || {}, { w: A.w });
  A.set++;
  A.restLabel = e.name;
  if (A.set >= e.sets) {
    S.stats[e.name].flag = flagOf(A.logs[idx], e.repMin, e.repMax);
    A.pos++; A.set = 0;
    if (A.pos >= A.order.length) return finish();
  }
  A.restDur = e.rest; A.restEnd = Date.now() + e.rest * 1000; A.phase = 'rest';
  save(); render(); iosTimer(e.rest);
}
function undoSet() {
  const A = S.active, u = A && A.undo; if (!u || A.phase !== 'rest') return;
  const l = A.logs[u.idx]; if (l) { l.pop(); if (!l.length) delete A.logs[u.idx]; }
  const st = S.stats[A.exs[u.idx].name]; if (st) { if (u.prevW == null) delete st.w; else st.w = u.prevW; st.flag = u.prevFlag || null; }
  A.pos = u.pos; A.set = u.set; A.w = u.w; A.r = u.r; A.phase = 'log'; A.restEnd = null; A.undo = null;
  save(); render();
}
function endRest() {
  const A = S.active; if (!A) return;
  A.phase = A.set === 0 ? 'start' : 'log'; A.restEnd = null; A.undo = null; save(); render();
}
function skipEx() {
  const A = S.active, idx = A.order[A.pos];
  A.skips[idx] = (A.skips[idx] || 0) + 1;
  A.order.splice(A.pos, 1);
  if (A.skips[idx] < 2 && A.order.length > A.pos) A.order.push(idx); // come back to it once at the end
  if (A.pos >= A.order.length) return finish();
  save(); render();
}
function finish() {
  const A = S.active; if (!A) return;
  const exs = Object.keys(A.logs).map(Number).sort((a, b) => a - b).map(i => { const e = A.exs[i]; return { name: e.name, bw: e.bw, repMin: e.repMin, repMax: e.repMax, sets: A.logs[i] }; });
  exs.forEach(x => { if (S.stats[x.name]) S.stats[x.name].flag = flagOf(x.sets, x.repMin, x.repMax); });
  S.active = null;
  if (!exs.length) { save(); view = { name: 'home' }; render(); return; }
  const E = { id: uid(), rid: A.rid, name: A.name, start: A.start, end: Date.now(), exs };
  S.history.unshift(E); S.lastRoutineId = A.rid; S.lastSummary = E;
  save(); view = { name: 'summary' }; render();
}

function updateLog() {
  const A = S.active, e = curEx();
  const wv = app.querySelector('[data-wv]'); if (wv) wv.innerHTML = A.w + '<small> kg</small>';
  const rv = app.querySelector('[data-rv]'); if (rv) rv.textContent = repTxt(A.r, e.repMin, e.repMax);
  app.querySelectorAll('[data-stop]').forEach(s => s.classList.toggle('on', +s.dataset.stop === A.r));
  const rs = app.querySelector('#r'); if (rs) rs.setAttribute('aria-valuetext', repTxt(A.r, e.repMin, e.repMax) + ' reps');
  const n = app.querySelector('[data-note]');
  if (n) { n.className = 'note' + (A.r < e.repMin ? ' down' : A.r > e.repMax ? ' up' : ''); n.textContent = A.r < e.repMin ? 'Below range: too heavy' : A.r > e.repMax ? 'Above range: too light' : ''; }
}

/* ---------- timers, sound, wake lock ---------- */
let actx = null;
function unlockAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
function beep() {
  if (!actx) return;
  [0, 0.25].forEach(t => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); const s = actx.currentTime + t; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.4, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.18); o.start(s); o.stop(s + 0.2); });
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
setInterval(() => {
  const A = S.active; if (!A || view.name !== 'workout') return;
  const el = app.querySelector('[data-elapsed]'); if (el) el.textContent = clock(Date.now() - A.start);
  if (A.phase === 'rest') {
    const left = (A.restEnd - Date.now()) / 1000;
    if (left <= 0) { beep(); endRest(); return; }
    const t = app.querySelector('[data-rest]'); if (t) t.textContent = mmss(left);
    const arc = app.querySelector('[data-arc]'); if (arc) arc.setAttribute('stroke-dashoffset', 728.85 * (1 - left / A.restDur));
  }
}, 250);
let lock = null;
async function wake(on) {
  try {
    if (on && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch (e) { lock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (S.active && S.active.phase === 'rest' && S.active.restEnd <= Date.now() && view.name === 'workout') endRest(); else wake(view.name === 'workout'); } });

/* ---------- editing ---------- */
function editR(fn) { const R = routine(view.id); if (R) { fn(R); save(); } }
function clampEx(e) { e.sets = Math.min(10, Math.max(1, e.sets)); e.repMin = Math.min(50, Math.max(1, e.repMin)); e.repMax = Math.min(50, Math.max(e.repMin, e.repMax)); }

/* ---------- in-app confirm sheet (replaces browser pop-ups) ---------- */
function ask(msg, okText, danger = false, infoOnly = false) {
  return new Promise(res => {
    const wrap = document.createElement('div');
    wrap.className = 'sheetwrap';
    wrap.innerHTML = `<div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="sheetMsg"><p id="sheetMsg">${esc(msg)}</p>
      <button class="pill${danger ? ' danger' : ''}" data-r="1"><span>${esc(okText)}</span></button>${infoOnly ? '' : '<button class="pill sec" data-r="0"><span>Cancel</span></button>'}</div>`;
    const done = v => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 200); res(v); };
    wrap.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) done(b.dataset.r === '1'); else if (e.target === wrap) done(false); });
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    const first = wrap.querySelector('[data-r]'); if (first) first.focus();
  });
}

/* ---------- events ---------- */
const actions = {
  go: el => { view = { name: el.dataset.to }; render(); app.scrollTop = 0; },
  edit: el => { view = { name: 'edit', id: el.dataset.id }; render(); },
  newRoutine: () => { const R = { id: uid(), name: 'New routine', exercises: [mk('New exercise', 3, 8, 10, 90)] }; S.routines.push(R); save(); view = { name: 'edit', id: R.id }; render(); const t = app.querySelector('#rn'); if (t) { t.focus(); t.select(); } },
  rUp: el => { const i = +el.dataset.i; const r = S.routines; [r[i - 1], r[i]] = [r[i], r[i - 1]]; save(); render(); },
  delRoutine: async () => { const R = routine(view.id); if (R && await ask(`Delete ${R.name}?`, 'Delete', true)) { S.routines = S.routines.filter(x => x !== R); save(); view = { name: 'menu' }; render(); } },
  addEx: () => { editR(R => R.exercises.push(mk('New exercise', 3, 8, 10, 90))); render(); const c = app.querySelector('.content'); if (c) c.scrollTop = c.scrollHeight; const ins = app.querySelectorAll('.exname'); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } },
  exDel: async el => { const R = routine(view.id), e = R && R.exercises[+el.dataset.i]; if (e && await ask(`Remove ${e.name}?`, 'Remove', true)) { editR(R => R.exercises.splice(+el.dataset.i, 1)); render(); } },
  exUp: el => { const i = +el.dataset.i; editR(R => { const x = R.exercises; [x[i - 1], x[i]] = [x[i], x[i - 1]]; }); render(); },
  step: el => { editR(R => { const e = R.exercises[+el.dataset.i]; e[el.dataset.f] += +el.dataset.d; if (el.dataset.f === 'repMin' && e.repMax < e.repMin) e.repMax = e.repMin; clampEx(e); }); render(); },
  bw: el => { editR(R => { const e = R.exercises[+el.dataset.i]; e.bw = !e.bw; }); render(); },
  toggle: el => { view.open = view.open === el.dataset.id ? null : el.dataset.id; render(); },
  delHist: async el => { if (await ask('Delete this workout from history?', 'Delete', true)) { S.history = S.history.filter(h => h.id !== el.dataset.id); save(); render(); } },
  export: () => { const b = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'gym-bro-backup-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); },
  import: () => { const f = app.querySelector('#importFile'); if (f) f.click(); },
  iosTimer: () => { S.settings.iosTimer = !S.settings.iosTimer; save(); render(); },
  testTimer: () => launch('shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT) + '&input=text&text=10'),
  beginEx, logSet, endRest, skip: skipEx, undo: undoSet,
  finish: async () => { const none = !Object.keys(S.active.logs).length; if (await ask(none ? 'Discard this workout?' : 'Finish workout now?', none ? 'Discard' : 'Finish', none)) finish(); },
  w: el => { const A = S.active, e = curEx(); A.w = Math.max(0, A.w + +el.dataset.d); if (!e.bw) A.w = Math.min(500, A.w); save(); render(); }
};
app.addEventListener('click', ev => {
  unlockAudio();
  const el = ev.target.closest('[data-a]'); if (!el || el.hasAttribute('data-hold')) return;
  if (el.classList.contains('pill') && Date.now() - screenAt < 450) return;
  const f = actions[el.dataset.a]; if (f) f(el);
});
app.addEventListener('input', ev => {
  const el = ev.target, k = el.dataset.in; if (!k) return;
  const A = S.active;
  if (k === 'w' && A) { A.w = +el.value; updateLog(); save(); }
  else if (k === 'r' && A) { A.r = +el.value; updateLog(); save(); }
  else if (k === 'rest') { editR(R => { R.exercises[+el.dataset.i].rest = +el.value; }); const v = app.querySelector(`[data-restv="${el.dataset.i}"]`); if (v) v.textContent = mmss(+el.value); }
  else if (k === 'exname') editR(R => { R.exercises[+el.dataset.i].name = el.value.trim() || 'Exercise'; });
  else if (k === 'rname') editR(R => { R.name = el.value.trim() || 'Routine'; });
});
app.addEventListener('change', ev => {
  const el = ev.target; if (el.dataset.in === 'w') render();
  if (el.dataset.in !== 'import' || !el.files[0]) return;
  const rd = new FileReader();
  rd.onload = async () => { let d = null; try { d = normalise(JSON.parse(rd.result)); if (d) d.active = null; } catch (e) { d = null; } if (!d) { await ask('That file is not a Gym Bro backup.', 'OK', false, true); return; } if (await ask('Replace everything on this phone with this backup?', 'Restore', true)) { S = d; save(); view = { name: 'home' }; render(); } };
  el.value = '';
  rd.readAsText(el.files[0]);
});
/* press-and-hold to start */
let holdT = null, holdEl = null;
function holdEnd() { clearTimeout(holdT); holdT = null; if (holdEl) holdEl.classList.remove('holding'); holdEl = null; }
app.addEventListener('pointerdown', ev => {
  unlockAudio();
  const el = ev.target.closest('[data-hold]'); if (!el) return;
  holdEl = el; el.classList.add('holding');
  holdT = setTimeout(() => { const id = el.dataset.id; holdEnd(); if (navigator.vibrate) navigator.vibrate(30); startWorkout(id); }, 900);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => app.addEventListener(t, holdEnd));
app.addEventListener('pointermove', ev => { if (holdEl) { const r = holdEl.getBoundingClientRect(); if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top - 20 || ev.clientY > r.bottom + 20) holdEnd(); } });
app.addEventListener('keydown', ev => { const el = ev.target.closest && ev.target.closest('[data-hold]'); if (el && (ev.key === 'Enter' || ev.key === ' ') && !ev.repeat) { ev.preventDefault(); startWorkout(el.dataset.id); } });
app.addEventListener('contextmenu', ev => { if (ev.target.closest('[data-hold]')) ev.preventDefault(); });

/* ---------- boot ---------- */
if (S.active && S.active.phase === 'rest' && S.active.restEnd <= Date.now()) { S.active.phase = S.active.set === 0 ? 'start' : 'log'; save(); }
render();
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) { updateReady = true; tryReload(); } });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {}));
}
