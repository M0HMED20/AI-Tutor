/* ===========================================================
   AI Tutor – main.js
   -----------------------------------------------------------
   UI + chat history (saved in localStorage).
   The DEMO TUTOR (KB, detectTopic, shuffle, buildQuiz, mockTutor)
   lives in js/mock.js – loaded before this file, unchanged.

   To connect a real backend: CONFIG.USE_MOCK = false and set
   CONFIG.API_URL. Request body: { message, mode, course,
   quiz: { count, difficulty }, history }. Response shapes are
   documented in your original file ("answer" / "quiz").
   =========================================================== */
'use strict';

const CONFIG = {
  USE_MOCK: true,
  API_URL: '/api/tutor/chat',
};

const STORE_KEY = 'tutor.convs.v1';
const MAX_CONVS = 50;

const MODES = [
  { id: 'simple',   icon: '🌱', name: 'Simple',       desc: 'Plain words, short & friendly' },
  { id: 'detailed', icon: '📚', name: 'Detailed',     desc: 'Full explanation with depth' },
  { id: 'steps',    icon: '🪜', name: 'Step by step', desc: 'Numbered walkthrough' },
  { id: 'analogy',  icon: '💡', name: 'Analogy',      desc: 'Real-life comparisons' },
  { id: 'exam',     icon: '🎯', name: 'Exam focus',   desc: 'Key points & common mistakes' },
  { id: 'socratic', icon: '🧭', name: 'Guide me',     desc: 'Questions that make me think' },
];

const COURSES = ['Database Systems', 'Data Structures', 'Operating Systems'];

const SUGGESTIONS = [
  'Explain normalization',
  'How do indexes work?',
  'Make a quiz on normalization',
  'Make a quiz on indexes',
];

/* ---------- State ----------
   lastTopic is a proxy to the active conversation so the
   unchanged mock.js keeps working with per-chat topics. */
const state = {
  mode: load('tutor.mode', 'simple'),
  course: COURSES[0],
  busy: false,
  convs: loadConvs(),
  conv: null,
  search: '',
  get lastTopic() { return this.conv ? this.conv.lastTopic : null; },
  set lastTopic(v) { if (this.conv) this.conv.lastTopic = v; },
};
let uid = 0;

/* ---------- Tiny helpers ---------- */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const modeById = (id) => MODES.find((m) => m.id === id);

function load(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

/* Mini markdown: **bold**, *italic*, lists, paragraphs, [n] citations */
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(\d+)\]/g, (_, n) =>
      `<button type="button" class="cite" data-cite="${n}" title="View source ${n}">${n}</button>`);
}
function md(text) {
  const lines = esc(text).split('\n');
  let html = '';
  let list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const line = inline(raw);
    let m;
    if ((m = line.match(/^\s*[-•]\s+(.*)/))) {
      if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; }
      html += `<li>${m[1]}</li>`;
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) {
      if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; }
      html += `<li>${m[1]}</li>`;
    } else if (!line.trim()) {
      close();
    } else {
      close();
      html += `<p>${line}</p>`;
    }
  }
  close();
  return html;
}

/* ---------- DOM refs ---------- */
const messagesEl = $('messages');
const inputEl = $('input');
const sendBtn = $('sendBtn');

/* ===========================================================
   CONVERSATIONS (history storage)
   conv = { id, title, course, created, updated, items[], history[], lastTopic }
   item = { kind: 'user'|'answer'|'quiz'|'note', ... }
   =========================================================== */
function loadConvs() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function saveConvs() {
  state.convs = state.convs.slice(0, MAX_CONVS);
  save(STORE_KEY, JSON.stringify(state.convs));
}
function makeConv() {
  return {
    id: `c${Date.now().toString(36)}${++uid}`,
    title: 'New chat', course: state.course,
    created: Date.now(), updated: Date.now(),
    items: [], history: [], lastTopic: null,
  };
}

/* Add an item to a conversation. A chat only appears in the
   history list once the user has sent a message. */
function record(conv, item) {
  if (conv.deleted) return;
  conv.items.push(item);
  conv.updated = Date.now();
  if (!state.convs.includes(conv) && conv.items.some((i) => i.kind === 'user')) state.convs.unshift(conv);
  saveConvs();
  renderHistory();
}

function openConv(conv) {
  state.conv = conv;
  state.course = conv.course;
  $('course').value = conv.course;
  $('subtitle').textContent = `Course: ${conv.course}`;
  renderConversation();
  renderHistory();
}

function startChat() {
  openConv(makeConv());
  inputEl.focus();
}

/* ---------- History sidebar ---------- */
function groupOf(t) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = 864e5;
  if (t >= d) return 'Today';
  if (t >= d - day) return 'Yesterday';
  if (t >= d - 7 * day) return 'Previous 7 days';
  return 'Older';
}
function fmtTime(t) {
  const d = new Date(t);
  return groupOf(t) === 'Today'
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function renderHistory() {
  const q = state.search.trim().toLowerCase();
  const list = state.convs
    .filter((c) => !q || c.title.toLowerCase().includes(q))
    .sort((a, b) => b.updated - a.updated);
  const box = $('historyList');

  $('clearHistory').hidden = !state.convs.length;
  if (!list.length) {
    box.innerHTML = `<p class="empty">${q ? 'No chats match your search.' : 'Your conversations will appear here.'}</p>`;
    return;
  }

  let html = '';
  let last = '';
  list.forEach((c) => {
    const g = groupOf(c.updated);
    if (g !== last) { html += `<h3 class="hist-group">${g}</h3>`; last = g; }
    html += `<div class="hist-item${c === state.conv ? ' active' : ''}" data-id="${esc(c.id)}">
      <button type="button" class="hist-main" data-hact="open" title="${esc(c.title)}">
        <span class="hist-title">${esc(c.title)}</span>
        <small>${esc(c.course)} · ${fmtTime(c.updated)}</small>
      </button>
      <span class="hist-actions">
        <button type="button" data-hact="rename" title="Rename" aria-label="Rename chat">✏️</button>
        <button type="button" data-hact="delete" title="Delete" aria-label="Delete chat">🗑️</button>
      </span>
    </div>`;
  });
  box.innerHTML = html;
}

$('historyList').addEventListener('click', (e) => {
  const item = e.target.closest('.hist-item');
  if (!item) return;
  const conv = state.convs.find((c) => c.id === item.dataset.id);
  if (!conv) return;
  const act = e.target.closest('[data-hact]');

  if (act && act.dataset.hact === 'rename') {
    const t = prompt('Rename chat', conv.title);
    if (t && t.trim()) { conv.title = t.trim().slice(0, 80); saveConvs(); renderHistory(); }
  } else if (act && act.dataset.hact === 'delete') {
    if (!confirm('Delete this chat?')) return;
    conv.deleted = true;
    state.convs = state.convs.filter((c) => c !== conv);
    saveConvs();
    if (conv === state.conv) startChat(); else renderHistory();
  } else {
    if (conv !== state.conv) openConv(conv);
    closeSidebar();
  }
});

$('historySearch').addEventListener('input', (e) => { state.search = e.target.value; renderHistory(); });

$('clearHistory').addEventListener('click', () => {
  if (!state.convs.length || !confirm('Delete all chat history?')) return;
  state.convs.forEach((c) => { c.deleted = true; });
  state.convs = [];
  saveConvs();
  startChat();
});

/* ---------- Sidebar tabs ---------- */
function setTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  save('tutor.tab', name);
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));

/* ---------- Sidebar: modes, courses, chips ---------- */
function renderModes() {
  const list = $('modeList');
  list.innerHTML = '';
  MODES.forEach((m) => {
    const b = el('button', 'mode', `<span class="ic">${m.icon}</span><b>${m.name}</b>`);
    b.type = 'button';
    b.title = m.desc;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(m.id === state.mode));
    b.addEventListener('click', () => setMode(m.id));
    list.appendChild(b);
  });
  const cur = modeById(state.mode);
  $('modeDesc').textContent = cur.desc;
  $('modeBadge').textContent = `${cur.icon} ${cur.name} mode`;
}

function setMode(id) {
  if (id === state.mode) return;
  state.mode = id;
  save('tutor.mode', id);
  renderModes();
  const text = `Explanation mode changed to ${modeById(id).name}`;
  addNote(text);
  record(state.conv, { kind: 'note', text });
  closeSidebar();
}

function renderCourses() {
  const sel = $('course');
  sel.innerHTML = COURSES.map((c) => `<option>${esc(c)}</option>`).join('');
  sel.addEventListener('change', () => {
    state.course = sel.value;
    state.conv.course = sel.value;
    $('subtitle').textContent = `Course: ${state.course}`;
    if (state.convs.includes(state.conv)) { saveConvs(); renderHistory(); }
  });
}

function renderChips() {
  const box = $('chips');
  box.innerHTML = '';
  SUGGESTIONS.forEach((s) => {
    const c = el('button', 'chip', esc(s));
    c.type = 'button';
    c.addEventListener('click', () => handleSend(s));
    box.appendChild(c);
  });
}

/* Sidebar open/close: drawer on mobile, collapse on desktop */
const isMobile = () => window.matchMedia('(max-width: 860px)').matches;
const openSidebar = () => { $('sidebar').classList.add('open'); $('scrim').classList.add('show'); };
const closeSidebar = () => { $('sidebar').classList.remove('open'); $('scrim').classList.remove('show'); };
function toggleSidebar() {
  if (isMobile()) {
    if ($('sidebar').classList.contains('open')) closeSidebar(); else openSidebar();
  } else {
    save('tutor.collapsed', $('app').classList.toggle('collapsed') ? '1' : '');
  }
}

/* ---------- Message rendering ---------- */
function scrollDown() { messagesEl.scrollTop = messagesEl.scrollHeight; }

function addNote(text) {
  messagesEl.appendChild(el('div', 'note', esc(text)));
  scrollDown();
}

function addUser(text, tag) {
  const wrap = el('article', 'msg user');
  wrap.innerHTML = `<div class="bubble"><div>${esc(text)}</div>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}</div>`;
  messagesEl.appendChild(wrap);
  scrollDown();
}

function addTyping() {
  const wrap = el('article', 'msg tutor',
    '<div class="avatar">AI</div><div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div>');
  messagesEl.appendChild(wrap);
  scrollDown();
  return wrap;
}

function sourcesHtml(cits) {
  if (!cits || !cits.length) return '';
  return `<div class="sources"><h4>Sources</h4>${cits.map((c) => `
    <div class="src" data-id="${esc(c.id)}">
      <span class="num">${esc(c.id)}</span>
      <div>
        <strong>${esc(c.title)}</strong>
        <small>${esc(c.doc)} · p. ${esc(c.page)}</small>
        <p>“${esc(c.snippet)}”</p>
      </div>
    </div>`).join('')}</div>`;
}

function actionsHtml(question) {
  const opts = MODES.map((m) => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('');
  return `<div class="actions" data-q="${esc(question)}">
    <select class="select restyle" aria-label="Explain differently">
      <option value="">🔁 Explain differently…</option>${opts}
    </select>
    <button type="button" class="small-btn" data-act="quiz">📝 Quiz me on this</button>
  </div>`;
}

function addAnswer(resp, question) {
  const wrap = el('article', 'msg tutor');
  wrap.innerHTML = `<div class="avatar">AI</div>
    <div class="bubble">
      ${md(resp.text)}
      ${sourcesHtml(resp.citations)}
      ${question && resp.citations && resp.citations.length ? actionsHtml(question) : ''}
    </div>`;
  messagesEl.appendChild(wrap);
  scrollDown();
}

/* ---------- Quiz card (answers are saved on the item) ---------- */
function addQuiz(resp, item) {
  item.answers = item.answers || {};
  const qs = resp.questions;
  const n = qs.length;
  let answered = 0;
  let score = 0;

  const body = qs.map((q, i) => `
    <fieldset class="q" data-i="${i}">
      <legend><span class="qn">Q${i + 1}.</span><span>${esc(q.q)}</span></legend>
      <div class="opts">
        ${q.o.map((o, j) => `<button type="button" class="opt" data-j="${j}">
          <span class="letter">${'ABCD'[j] || j + 1}</span><span>${esc(o)}</span></button>`).join('')}
      </div>
      <div class="why" hidden></div>
    </fieldset>`).join('');

  const wrap = el('article', 'msg tutor');
  wrap.innerHTML = `<div class="avatar">AI</div>
    <div class="bubble quiz">
      <div class="quiz-head">
        <div><h3>📝 ${esc(resp.title)}</h3><small>${n} questions · ${esc(resp.difficulty || 'Medium')}</small></div>
        <div class="progress"><span class="ptext">0/${n} answered</span><div class="bar"><span></span></div></div>
      </div>
      ${body}
      <div class="result-slot"></div>
      ${sourcesHtml(resp.citations)}
    </div>`;

  function finish(silent) {
    const pct = score / n;
    const msg = pct === 1 ? 'Perfect score! 🎉' : pct >= 0.6 ? 'Good job — review the ones you missed.' : 'Keep going — try the topic again in a different mode.';
    const slot = wrap.querySelector('.result-slot');
    slot.innerHTML = `<div class="result">
      <div class="score">${score}/${n}</div><p>${msg}</p>
      <div class="row">
        <button type="button" class="btn primary" data-act="retry">New quiz</button>
        <button type="button" class="btn ghost" data-act="review">Review the topic</button>
      </div></div>`;
    slot.querySelector('[data-act="retry"]').addEventListener('click', () =>
      handleSend(`Make a ${n}-question quiz on ${resp.topicTitle}`));
    slot.querySelector('[data-act="review"]').addEventListener('click', () =>
      handleSend(`Explain ${resp.topicTitle}`));
    if (!silent) slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function answer(i, chosen, silent) {
    const fs = wrap.querySelector(`.q[data-i="${i}"]`);
    if (!fs || fs.dataset.done) return;
    fs.dataset.done = '1';

    const q = qs[i];
    const ok = chosen === q.a;
    const opts = fs.querySelectorAll('.opt');
    opts[q.a].classList.add('correct');
    if (!ok && opts[chosen]) opts[chosen].classList.add('wrong');
    if (ok) score++;

    const why = fs.querySelector('.why');
    const cites = (q.c || []).map((c) => `[${c}]`).join('');
    why.innerHTML = `<strong class="${ok ? 'ok' : 'no'}">${ok ? '✅ Correct!' : '❌ Not quite.'}</strong> ${inline(esc(`${q.why} ${cites}`))}`;
    why.hidden = false;

    answered++;
    wrap.querySelector('.ptext').textContent = `${answered}/${n} answered`;
    wrap.querySelector('.bar span').style.width = `${(answered / n) * 100}%`;
    if (answered === n) finish(silent);
  }

  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.opt');
    if (!btn) return;
    const i = Number(btn.closest('.q').dataset.i);
    if (item.answers[i] !== undefined) return;
    const j = Number(btn.dataset.j);
    item.answers[i] = j;
    answer(i, j, false);
    saveConvs();
  });

  messagesEl.appendChild(wrap);
  // restore saved answers when re-opening a chat
  Object.entries(item.answers).forEach(([i, j]) => answer(Number(i), Number(j), true));
  scrollDown();
}

/* ---------- Render a saved conversation ---------- */
function renderItem(it) {
  if (it.kind === 'user') addUser(it.text, it.tag);
  else if (it.kind === 'answer') addAnswer(it.resp, it.question);
  else if (it.kind === 'quiz') addQuiz(it.resp, it);
  else if (it.kind === 'note') addNote(it.text);
}

function renderConversation() {
  messagesEl.innerHTML = '';
  addAnswer({
    text: `Hi! I'm your AI tutor. 👋

- Ask me anything about **${state.course}** and I'll answer with **numbered sources** [1].
- Say **"make a quiz on …"** and I'll create an interactive quiz.
- Pick how I explain things (simple, step by step, analogy…) in **Settings → Explanation mode**.`,
    citations: [{ id: 1, title: 'Click a number to jump to its source', doc: 'Example', page: '—', snippet: 'Every answer shows where its information came from.' }],
  });
  state.conv.items.forEach(renderItem);
  scrollDown();
}

/* ---------- Global click / change handlers inside messages ---------- */
messagesEl.addEventListener('click', (e) => {
  const cite = e.target.closest('.cite');
  if (cite) {
    const bubble = cite.closest('.bubble');
    const src = bubble && bubble.querySelector(`.src[data-id="${cite.dataset.cite}"]`);
    if (src) {
      src.classList.remove('flash');
      void src.offsetWidth; // restart animation
      src.classList.add('flash');
      src.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }
  const act = e.target.closest('[data-act="quiz"]');
  if (act) {
    const q = act.closest('.actions').dataset.q;
    handleSend(`Make a quiz on ${q.replace(/^(explain|what is|how do|how does)\s+/i, '')}`);
  }
});

messagesEl.addEventListener('change', (e) => {
  if (!e.target.classList.contains('restyle') || !e.target.value) return;
  const q = e.target.closest('.actions').dataset.q;
  const mode = e.target.value;
  e.target.value = '';
  handleSend(q, { mode, tag: `${modeById(mode).icon} ${modeById(mode).name} mode` });
});

/* ---------- Sending ---------- */
async function handleSend(text, opts = {}) {
  text = text.trim();
  if (!text || state.busy) return;

  const conv = state.conv;
  const mode = opts.mode || state.mode;
  state.busy = true;
  sendBtn.disabled = true;

  if (conv.title === 'New chat') conv.title = text.length > 48 ? `${text.slice(0, 48)}…` : text;
  addUser(text, opts.tag);
  record(conv, { kind: 'user', text, tag: opts.tag });
  const typing = addTyping();

  try {
    const resp = await askTutor({
      message: text,
      mode,
      course: conv.course,
      quiz: { count: Number($('quizCount').value), difficulty: $('quizLevel').value },
      history: conv.history.slice(-6),
    });
    typing.remove();
    if (conv.deleted) return;

    const item = resp.type === 'quiz'
      ? { kind: 'quiz', resp }
      : { kind: 'answer', resp, question: text };
    record(conv, item);
    if (conv === state.conv) renderItem(item);

    conv.history.push({ role: 'user', content: text }, { role: 'assistant', content: resp.text || resp.title });
    saveConvs();
  } catch (err) {
    typing.remove();
    if (conv === state.conv) addAnswer({ text: '⚠️ Something went wrong while contacting the tutor. Please try again.' });
    console.error(err);
  } finally {
    state.busy = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

async function askTutor(payload) {
  if (!CONFIG.USE_MOCK) {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }
  await sleep(700 + Math.random() * 500);
  return mockTutor(payload); // from js/mock.js
}

/* ---------- Composer ---------- */
function autosize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 160)}px`;
}

$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = inputEl.value;
  inputEl.value = '';
  autosize();
  handleSend(text);
});

inputEl.addEventListener('input', autosize);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('composer').requestSubmit();
  }
});

$('quizBtn').addEventListener('click', () => {
  inputEl.value = `Make a ${$('quizCount').value}-question quiz on `;
  autosize();
  inputEl.focus();
});

$('newChat').addEventListener('click', () => {
  // don't pile up empty chats: reuse the current one if nothing was sent yet
  if (!state.conv.items.some((i) => i.kind === 'user')) { inputEl.focus(); closeSidebar(); return; }
  startChat();
  closeSidebar();
});
$('menuBtn').addEventListener('click', toggleSidebar);
$('scrim').addEventListener('click', closeSidebar);

/* ---------- Start ---------- */
if (load('tutor.collapsed', '') && !isMobile()) $('app').classList.add('collapsed');
renderCourses();
renderModes();
renderChips();
setTab(load('tutor.tab', 'history'));
startChat();
