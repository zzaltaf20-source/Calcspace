'use strict';
/* ============================================================
   CalcSpace — All-in-One Calculator Hub
   Vanilla JS · no eval() · custom expression engine
   ============================================================ */

/* ---------- tiny DOM helpers ---------- */
const $ = s => document.querySelector(s);
function el(tag, cls, html){ const d = document.createElement(tag); if(cls) d.className = cls; if(html != null) d.innerHTML = html; return d; }
let __uid = 0; const uid = () => 'cs' + (++__uid);

/* ---------- storage ---------- */
function loadJSON(key, fallback){ try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch(e){ return fallback; } }
function saveJSON(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }

/* ---------- toast ---------- */
let toastTimer;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800); }
function copyText(txt){
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(() => toast('Copied to clipboard'), () => legacyCopy(txt)); }
  else legacyCopy(txt);
}
function legacyCopy(txt){ const ta = el('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied to clipboard'); } catch(e){ toast('Copy failed'); } ta.remove(); }

/* ---------- math utilities ---------- */
function fmt(x, maxD = 2){ if(!isFinite(x)) return '∞'; if(Object.is(x, -0)) x = 0; return x.toLocaleString('en-US', { maximumFractionDigits: maxD }); }
function fmtMoney(x){ if(!isFinite(x)) return '∞'; return '₹' + x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(x){ return fmt(x, 2) + '%'; }
function fmtNum(n){
  if(!isFinite(n)) return '∞';
  if(Object.is(n, -0)) n = 0;
  if(Number.isInteger(n) && Math.abs(n) < 1e15) return n.toLocaleString('en-US');
  const a = Math.abs(n);
  if(a !== 0 && (a >= 1e12 || a < 1e-9)) return n.toExponential(6).replace(/\.?0+e/, 'e');
  return parseFloat(n.toPrecision(12)).toLocaleString('en-US', { maximumFractionDigits: 10 });
}
const rawNum = n => Number.isInteger(n) && Math.abs(n) < 1e15 ? String(n) : parseFloat(n.toPrecision(12)).toString();
function gcd(a, b){ a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while(b){ [a, b] = [b, a % b]; } return a; }
function lcm(a, b){ return Math.abs(a * b) / gcd(a, b); }
function fact(n){ if(n < 0 || !Number.isInteger(n)) throw new Error('Factorial needs a whole number ≥ 0.'); if(n > 170) throw new Error('Factorial above 170 exceeds number limits.'); let r = 1; for(let i = 2; i <= n; i++) r *= i; return r; }
function isPrime(n){ if(!Number.isInteger(n) || n < 2) return false; if(n < 4) return true; if(n % 2 === 0) return false; for(let i = 3; i * i <= n; i += 2) if(n % i === 0) return false; return true; }
function factorize(n){ const f = []; let p = 2; while(p * p <= n){ while(n % p === 0){ f.push(p); n /= p; } p += (p === 2 ? 1 : 2); } if(n > 1) f.push(n); return f; }
function superscript(n){ const m = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻' }; return String(n).split('').map(c => m[c] || c).join(''); }

/* ---------- safe expression engine (recursive descent, NO eval) ---------- */
const Engine = (() => {
  function tokenize(src){
    const toks = []; let i = 0;
    while(i < src.length){
      const ch = src[i];
      if(ch === ' ' || ch === '\t'){ i++; continue; }
      if(/[0-9.]/.test(ch)){
        let j = i;
        while(j < src.length && /[0-9.]/.test(src[j])) j++;
        if(j < src.length && (src[j] === 'e' || src[j] === 'E')){
          let k = j + 1; if(src[k] === '+' || src[k] === '-') k++;
          if(k < src.length && /[0-9]/.test(src[k])){ while(k < src.length && /[0-9]/.test(src[k])) k++; j = k; }
        }
        const s = src.slice(i, j);
        if((s.match(/\./g) || []).length > 1) throw new Error('Malformed number “' + s + '”.');
        toks.push({ t:'num', v: parseFloat(s) }); i = j; continue;
      }
      if(/[a-zA-Zπ]/.test(ch)){ let j = i; while(j < src.length && /[a-zA-Zπ]/.test(src[j])) j++; toks.push({ t:'id', v: src.slice(i, j).toLowerCase() }); i = j; continue; }
      if('+-*/^%!'.includes(ch)){ toks.push({ t:'op', v: ch }); i++; continue; }
      if(ch === '('){ toks.push({ t:'lp' }); i++; continue; }
      if(ch === ')'){ toks.push({ t:'rp' }); i++; continue; }
      throw new Error('Unexpected character “' + ch + '”.');
    }
    return toks;
  }

  function evaluate(src, deg){
    if(!src || !src.trim()) throw new Error('Enter an expression.');
    const toks = tokenize(src); let p = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const D = Math.PI / 180;
    const FN = {
      sin: x => Math.abs(Math.sin(deg ? x * D : x)) < 1e-12 ? 0 : Math.sin(deg ? x * D : x),
      cos: x => Math.abs(Math.cos(deg ? x * D : x)) < 1e-12 ? 0 : Math.cos(deg ? x * D : x),
      tan: x => { const r = Math.tan(deg ? x * D : x); if(!isFinite(r) || Math.abs(r) > 1e15) throw new Error('tan is undefined here.'); return Math.abs(r) < 1e-12 ? 0 : r; },
      asin: x => { if(x < -1 || x > 1) throw new Error('asin needs a value between −1 and 1.'); return deg ? Math.asin(x) / D : Math.asin(x); },
      acos: x => { if(x < -1 || x > 1) throw new Error('acos needs a value between −1 and 1.'); return deg ? Math.acos(x) / D : Math.acos(x); },
      atan: x => deg ? Math.atan(x) / D : Math.atan(x),
      log: x => { if(x <= 0) throw new Error('log needs a positive number.'); return Math.log10(x); },
      ln:  x => { if(x <= 0) throw new Error('ln needs a positive number.'); return Math.log(x); },
      sqrt: x => { if(x < 0) throw new Error('√ of a negative number is not real.'); return Math.sqrt(x); },
      cbrt: x => Math.cbrt(x),
      abs: x => Math.abs(x),
      exp: x => Math.exp(x)
    };

    function expr(){ let v = term(); while(peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')){ const o = next().v, r = term(); v = o === '+' ? v + r : v - r; } return v; }
    function term(){
      let v = unary();
      for(;;){
        const tk = peek();
        if(tk && tk.t === 'op' && (tk.v === '*' || tk.v === '/')){
          next(); const r = unary();
          if(tk.v === '/'){ if(r === 0) throw new Error('Division by zero.'); v /= r; } else v *= r;
        } else if(tk && (tk.t === 'num' || tk.t === 'id' || tk.t === 'lp')){
          v *= unary(); // implicit multiplication: 2π, 2(3+4)
        } else break;
      }
      return v;
    }
    function unary(){ const tk = peek(); if(tk && tk.t === 'op' && (tk.v === '+' || tk.v === '-')){ next(); const v = unary(); return tk.v === '-' ? -v : v; } return power(); }
    function power(){ const base = postfix(); const tk = peek(); if(tk && tk.t === 'op' && tk.v === '^'){ next(); return Math.pow(base, unary()); } return base; }
    function postfix(){ let v = primary(); for(;;){ const tk = peek(); if(tk && tk.t === 'op' && tk.v === '!'){ next(); v = fact(v); } else if(tk && tk.t === 'op' && tk.v === '%'){ next(); v = v / 100; } else break; } return v; }
    function primary(){
      const tk = next();
      if(!tk) throw new Error('Unexpected end of expression.');
      if(tk.t === 'num') return tk.v;
      if(tk.t === 'lp'){ const v = expr(); const cl = next(); if(!cl || cl.t !== 'rp') throw new Error('Missing closing parenthesis.'); return v; }
      if(tk.t === 'id'){
        const name = tk.v;
        if(name === 'pi' || name === 'π') return Math.PI;
        if(name === 'e') return Math.E;
        const fn = FN[name];
        if(!fn) throw new Error('Unknown name “' + name + '”.');
        const op = next(); if(!op || op.t !== 'lp') throw new Error(name + ' needs parentheses, e.g. ' + name + '(30).');
        const arg = expr(); const cl = next(); if(!cl || cl.t !== 'rp') throw new Error('Missing ) after ' + name + '(….');
        return fn(arg);
      }
      if(tk.t === 'rp') throw new Error('Unexpected “)”.');
      throw new Error('Unexpected “' + (tk.v || '') + '”.');
    }

    const out = expr();
    if(p < toks.length) throw new Error('Unexpected input near the end.');
    if(!isFinite(out)) throw new Error('Result is not a finite number.');
    return out;
  }
  return { eval: evaluate };
})();

const prettyExpr = s => s
  .replace(/sqrt\(/g, '√(').replace(/\*/g, '×').replace(/\//g, '÷')
  .replace(/-/g, '−').replace(/pi/g, 'π');

function smartBack(s){
  const fns = ['sqrt(','cbrt(','asin(','acos(','atan(','sin(','cos(','tan(','log(','ln(','abs(','exp('];
  for(const f of fns) if(s.endsWith(f)) return s.slice(0, -f.length);
  return s.slice(0, -1);
}

/* ---------- date/time helpers ---------- */
function parseDate(str, name){
  if(!str) throw new Error(name + ' is required.');
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if(dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) throw new Error(name + ' is not a valid date.');
  return dt;
}
const fmtDate = d => d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
const DAY = 864e5;
function daysInMonth(y, m){ return new Date(y, m + 1, 0).getDate(); }
function diffYMD(a, b){ // a <= b
  let y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth(), d = b.getDate() - a.getDate();
  if(d < 0){ m--; d += daysInMonth(b.getFullYear(), b.getMonth() - 1 < 0 ? 11 : b.getMonth() - 1); if(b.getMonth() - 1 < 0) d = daysInMonth(b.getFullYear() - 1, 11); }
  if(d < 0){ m--; d += daysInMonth(a.getFullYear(), a.getMonth()); }
  if(m < 0){ m += 12; y--; }
  return { y, m, d };
}
function addMonths(d, n){ const day = d.getDate(); const t = new Date(d.getFullYear(), d.getMonth() + n, 1); t.setDate(Math.min(day, daysInMonth(t.getFullYear(), t.getMonth()))); return t; }
function parseTimeSec(s, name){ if(!s) throw new Error(name + ' is required.'); const p = s.split(':').map(Number); return p[0] * 3600 + (p[1] || 0) * 60 + (p[2] || 0); }
function hms(sec){ const neg = sec < 0; sec = Math.round(Math.abs(sec)); return { neg, h: Math.floor(sec / 3600), m: Math.floor(sec % 3600 / 60), s: sec % 60 }; }

/* ============================================================
   UI KIT
   ============================================================ */
function field(label, opts = {}){
  const id = uid(), w = el('div', 'field');
  const lab = el('label'); lab.htmlFor = id; lab.textContent = label;
  const wrap = el('div', 'inwrap');
  const inp = document.createElement('input');
  inp.type = opts.type || 'number'; inp.id = id;
  if(inp.type === 'number'){ inp.step = 'any'; inp.inputMode = 'decimal'; }
  if(opts.value != null) inp.value = opts.value;
  if(opts.ph) inp.placeholder = opts.ph;
  if(opts.min != null) inp.min = opts.min; if(opts.max != null) inp.max = opts.max;
  wrap.appendChild(inp);
  if(opts.suffix){ const sfx = el('span', 'insuffix'); sfx.textContent = opts.suffix; wrap.appendChild(sfx); }
  w.append(lab, wrap);
  return { root: w, input: inp };
}
function selectField(label, options, opts = {}){
  const id = uid(), w = el('div', 'field');
  const lab = el('label'); lab.htmlFor = id; lab.textContent = label;
  const wrap = el('div', 'inwrap');
  const sel = document.createElement('select'); sel.id = id;
  options.forEach(o => {
    if(o.g){ const og = document.createElement('optgroup'); og.label = o.g; o.items.forEach(([v, t]) => { const op = document.createElement('option'); op.value = v; op.textContent = t; og.appendChild(op); }); sel.appendChild(og); }
    else { const op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op); }
  });
  if(opts.value != null) sel.value = opts.value;
  wrap.appendChild(sel); w.append(lab, wrap);
  return { root: w, select: sel };
}
function checkLine(label, checked = false){
  const w = el('label', 'checkline'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = checked;
  const sp = el('span'); sp.textContent = label; w.append(cb, sp); return { root: w, input: cb };
}
function btn(label, cls, handler){ const b = el('button', 'btn ' + cls); b.type = 'button'; b.innerHTML = label; if(handler) b.addEventListener('click', handler); return b; }
function fgrid(mount, cols, ...nodes){ const g = el('div', 'fgrid' + (cols === 3 ? ' g3' : '')); nodes.forEach(n => g.appendChild(n.root)); mount.appendChild(g); return g; }
function note(mount, html){ const p = el('p', 'note'); p.innerHTML = html; mount.appendChild(p); return p; }

function val(input, o = {}){
  const name = o.name || 'This value';
  const raw = String(input.value).trim();
  if(!raw){ if(o.required === false) return null; throw new Error(name + ' is required.'); }
  const n = Number(raw);
  if(!isFinite(n)) throw new Error(name + ' must be a valid number.');
  if(o.integer && !Number.isInteger(n)) throw new Error(name + ' must be a whole number.');
  if(o.min != null && n < o.min) throw new Error(name + ' must be at least ' + o.min + '.');
  if(o.max != null && n > o.max) throw new Error(name + ' must be at most ' + o.max + '.');
  return n;
}
function numList(str, name = 'Numbers'){
  const parts = String(str).split(/[,\s;]+/).filter(Boolean);
  if(!parts.length) throw new Error(name + ' are required.');
  const nums = parts.map(p => { const n = Number(p); if(!isFinite(n)) throw new Error('“' + p + '” is not a valid number.'); return n; });
  return nums;
}

function outBox(mount, title = 'Result'){
  const box = el('div', 'outbox');
  box.innerHTML = '<div class="ob-head"><span class="ob-title">' + title + '</span>' +
    '<button type="button" class="btn tiny ghost ob-copy" disabled><svg class="ic" style="width:13px;height:13px"><use href="#i-copy"/></svg> Copy</button></div>' +
    '<div class="ob-body" role="status" aria-live="polite"></div>';
  mount.appendChild(box);
  const body = box.querySelector('.ob-body'), cbtn = box.querySelector('.ob-copy');
  cbtn.addEventListener('click', () => copyText(body.innerText));
  return {
    box,
    show(entries){
      body.innerHTML = '';
      entries.forEach(e => {
        if(e.s != null){ const d = el('div', 'ob-step'); d.textContent = e.s; body.appendChild(d); return; }
        const r = el('div', 'ob-row' + (e[2] ? ' ' + e[2] : ''));
        const k = el('span', 'ob-k'); k.textContent = e[0];
        const dots = el('span', 'ob-dots');
        const v = el('span', 'ob-v'); v.textContent = e[1];
        r.append(k, dots, v); body.appendChild(r);
      });
      box.classList.add('on'); box.classList.remove('err'); cbtn.disabled = false;
    },
    error(msg){ body.innerHTML = ''; const d = el('div', 'ob-err'); d.textContent = msg; body.appendChild(d); box.classList.add('on', 'err'); cbtn.disabled = true; },
    clear(){ body.innerHTML = ''; box.classList.remove('on', 'err'); cbtn.disabled = true; }
  };
}
function attempt(out, fn){ try { fn(); } catch(e){ out.error(e.message || 'Invalid input.'); } }

function actionBar(mount, onCalc, calcLabel = 'Calculate'){
  const bar = el('div', 'actions');
  const c = btn(calcLabel, 'primary', onCalc);
  const r = btn('<svg class="ic" style="width:15px;height:15px"><use href="#i-reset"/></svg> Reset', 'ghost', () => resetMount(mount));
  bar.append(c, r); mount.appendChild(bar);
  mount.addEventListener('keydown', e => { if(e.key === 'Enter' && e.target.tagName === 'INPUT'){ e.preventDefault(); c.click(); } });
  return bar;
}
function resetMount(mount){
  mount.querySelectorAll('input, select').forEach(i => {
    if(i.dataset.keep != null) return;
    if(i.tagName === 'SELECT'){ for(const op of i.options){ if(op.defaultSelected){ i.value = op.value; break; } } }
    else i.value = i.defaultValue;
    if(i.type === 'checkbox') i.checked = i.defaultChecked;
  });
  mount.querySelectorAll('.outbox').forEach(o => { o.classList.remove('on', 'err'); o.querySelector('.ob-body').innerHTML = ''; const cb = o.querySelector('.ob-copy'); if(cb) cb.disabled = true; });
}

function seg(options, onChange){
  const w = el('div', 'seg'); let cur = options[0][0];
  options.forEach(([k, l]) => {
    const b = el('button', 'seg-b' + (k === cur ? ' on' : '')); b.type = 'button'; b.textContent = l;
    b.addEventListener('click', () => { cur = k; w.querySelectorAll('.seg-b').forEach(x => x.classList.toggle('on', x === b)); onChange(k); });
    w.appendChild(b);
  });
  return { root: w, get: () => cur };
}

/* Dynamic rows editor (GPA, weighted avg, grade scale) */
function rowEditor({ cols, initial = 3, addLabel = 'Add row', gridCols }){
  const root = el('div', 'rowed');
  const tpl = gridCols || cols.length + 1;
  const head = el('div', 'rowed-head'); head.style.gridTemplateColumns = `repeat(${cols.length}, 1fr) 36px`;
  cols.forEach(c => { const h = el('span'); h.textContent = c.label; head.appendChild(h); });
  head.appendChild(el('span'));
  root.appendChild(head);
  const list = el('div', 'rowed-list'); root.appendChild(list);
  function addRow(vals = {}){
    const row = el('div', 'rowed-row'); row.style.gridTemplateColumns = `repeat(${cols.length}, 1fr) 36px`;
    cols.forEach(c => {
      const inp = document.createElement('input');
      inp.type = c.type || 'number'; if(inp.type === 'number') inp.step = 'any';
      inp.placeholder = c.ph || ''; inp.dataset.k = c.key;
      if(vals[c.key] != null) inp.value = vals[c.key];
      row.appendChild(inp);
    });
    const del = el('button', 'rowdel'); del.type = 'button'; del.textContent = '×'; del.setAttribute('aria-label', 'Remove row');
    del.addEventListener('click', () => { if(list.children.length > 1) row.remove(); else { row.querySelectorAll('input').forEach(i => i.value = ''); } });
    row.appendChild(del);
    list.appendChild(row);
  }
  for(let i = 0; i < initial; i++) addRow();
  const addB = btn('+ ' + addLabel, 'ghost sm', () => addRow());
  root.appendChild(addB);
  return {
    root,
    addRow,
    values(){ return [...list.querySelectorAll('.rowed-row')].map(r => { const o = {}; cols.forEach(c => { o[c.key] = r.querySelector(`[data-k="${c.key}"]`).value; }); return o; }); }
  };
}

/* ============================================================
   UNIT CONVERTER FACTORY
   ============================================================ */
function fmtConv(n){
  if(Object.is(n, -0)) n = 0;
  if(n === 0) return '0';
  const a = Math.abs(n);
  if(a >= 1e12 || a < 1e-9) return n.toExponential(6).replace(/\.?0+e/, 'e');
  return parseFloat(n.toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 8 });
}
function buildConverter(mount, cfg){
  const flat = [];
  cfg.units.forEach(u => { if(u.g) flat.push(...u.items); else flat.push(u); });
  const optList = cfg.grouped ? cfg.units.map(g => ({ g: g.g, items: g.items.map(u => [u.k, u.label]) })) : flat.map(u => [u.k, u.label]);
  const fVal = field('Value', { value: '1' });
  const fFrom = selectField('From', optList, { value: cfg.defFrom || flat[0].k });
  const fTo = selectField('To', optList, { value: cfg.defTo || flat[1].k });
  const swap = btn('⇄', 'ghost sm swapbtn', () => { const t = fFrom.select.value; fFrom.select.value = fTo.select.value; fTo.select.value = t; update(); });
  fgrid(mount, 3, fVal, fFrom, fTo);
  mount.querySelector('.fgrid').insertBefore(swap.root, fTo.root);
  const resWrap = el('div', 'conv-result'); resWrap.innerHTML = '<span class="dim">=</span> <b id="cvMain">—</b>';
  mount.appendChild(resWrap);
  const mainB = resWrap.querySelector('#cvMain');
  const table = el('div', 'conv-table'); mount.appendChild(table);
  const getUnit = k => flat.find(u => u.k === k);
  const toBase = (u, x) => u.toBase ? u.toBase(x) : x * u.f;
  const fromBase = (u, b) => u.fromBase ? u.fromBase(b) : b / u.f;
  function update(){
    try{
      const x = val(fVal.input, { name: 'Value' });
      const fu = getUnit(fFrom.select.value), tu = getUnit(fTo.select.value);
      const b = toBase(fu, x), out = fromBase(tu, b);
      mainB.textContent = fmtConv(out) + ' ' + tu.k;
      table.innerHTML = '';
      flat.forEach(u => {
        if(u.k === fu.k) return;
        const r = el('div', 'conv-row');
        r.innerHTML = '<span></span><b></b>';
        r.children[0].textContent = u.label;
        r.children[1].textContent = fmtConv(fromBase(u, b)) + ' ' + u.k;
        table.appendChild(r);
      });
    }catch(e){ mainB.textContent = e.message; table.innerHTML = ''; }
  }
  [fVal.input, fFrom.select, fTo.select].forEach(x => x.addEventListener('input', update));
  update();
  note(mount, cfg.note);
}
function converterDef(id, name, short, keywords, cfg){
  reg({ id, name, short, cat: 'convert', keywords, build: m => buildConverter(m, cfg) });
}

/* ============================================================
   REGISTRY
   ============================================================ */
const CALC = {}, ORDER = [];
function reg(d){ CALC[d.id] = d; ORDER.push(d.id); }
const CATS = {
  basic:     { name: 'Basic',           icon: 'i-basic',   cls: 'cat-basic' },
  scientific:{ name: 'Scientific',      icon: 'i-sci',     cls: 'cat-sci' },
  student:   { name: 'Student',         icon: 'i-student', cls: 'cat-student' },
  finance:   { name: 'Financial',       icon: 'i-fin',     cls: 'cat-fin' },
  datetime:  { name: 'Date & Time',     icon: 'i-date',    cls: 'cat-date' },
  convert:   { name: 'Unit Converters', icon: 'i-conv',    cls: 'cat-conv' },
  math:      { name: 'Advanced Math',   icon: 'i-math',    cls: 'cat-math' }
};

/* ============================================================
   A. BASIC CALCULATORS
   ============================================================ */

/* --- Standard Calculator (keyboard support) --- */
reg({ id:'standard', name:'Standard Calculator', cat:'basic', feat:true,
  short:'Everyday arithmetic with full keyboard support',
  keywords:'basic arithmetic add subtract multiply divide plus minus brackets',
  build(mount){
    mount.innerHTML = `
      <div class="calcwrap">
        <div class="sc-display"><div class="sc-expr" id="stExpr">&nbsp;</div><div class="sc-main" id="stMain" aria-live="polite">0</div></div>
        <div class="keys k4" id="stKeys"></div>
        <div class="sc-hist" id="stHist"></div>
      </div>
      <p class="note">Keyboard works while this tool is open: digits, <code>+ − * / ( ) %</code> · Enter = equals · Backspace = delete · Esc = clear. <code>%</code> converts the preceding number to a fraction of 100 (25% → 0.25).</p>`;
    const exprEl = mount.querySelector('#stExpr'), mainEl = mount.querySelector('#stMain'),
          keysEl = mount.querySelector('#stKeys'), histEl = mount.querySelector('#stHist');
    let expr = window.__prefill || ''; window.__prefill = '';
    let errState = false;
    const hist = [];
    const KEYS = [
      ['C','clear','fn','C'], ['⌫','back','fn','⌫'], ['(','ins','fn','('], [')','ins','fn',')'],
      ['7','ins','n','7'], ['8','ins','n','8'], ['9','ins','n','9'], ['÷','ins','op','/'],
      ['4','ins','n','4'], ['5','ins','n','5'], ['6','ins','n','6'], ['×','ins','op','*'],
      ['1','ins','n','1'], ['2','ins','n','2'], ['3','ins','n','3'], ['−','ins','op','-'],
      ['%','ins','op','%'], ['0','ins','n','0'], ['.','ins','n','.'], ['+','ins','op','+']
    ];
    KEYS.forEach(([lab, act, kind, v]) => {
      const b = el('button', 'key ' + (kind === 'fn' ? 'fn' : kind === 'op' ? 'op' : '')); b.type = 'button'; b.textContent = lab;
      b.addEventListener('click', () => doAct(act, v));
      keysEl.appendChild(b);
    });
    const eq = el('button', 'key eq'); eq.type = 'button'; eq.textContent = '=';
    eq.addEventListener('click', () => doAct('eq')); keysEl.appendChild(eq);

    function render(){
      exprEl.innerHTML = expr ? prettyExpr(expr) : '&nbsp;';
      if(errState) return;
      let pv = '';
      if(expr){ try { pv = fmtNum(Engine.eval(expr)); } catch(e){ pv = ''; } }
      mainEl.textContent = pv || '0';
      mainEl.classList.remove('err');
    }
    function renderHist(){
      histEl.innerHTML = '';
      if(!hist.length) return;
      const t = el('div', 'sc-hist-t'); t.textContent = 'Recent'; histEl.appendChild(t);
      hist.forEach(h => {
        const b = el('button', 'hist-b'); b.type = 'button';
        b.innerHTML = '<span></span><span></span>';
        b.children[0].textContent = h.t; b.children[1].textContent = '= ' + h.d;
        b.addEventListener('click', () => { expr = h.v; errState = false; render(); });
        histEl.appendChild(b);
      });
    }
    function doAct(act, v){
      if(errState && act !== 'clear'){ expr = ''; errState = false; }
      if(act === 'ins') expr += v;
      else if(act === 'back') expr = smartBack(expr);
      else if(act === 'clear'){ expr = ''; }
      else if(act === 'eq'){
        if(!expr) return;
        try{
          const r = Engine.eval(expr);
          hist.unshift({ t: prettyExpr(expr), d: fmtNum(r), v: rawNum(r) });
          if(hist.length > 5) hist.pop();
          expr = rawNum(r); renderHist();
        }catch(e){ mainEl.textContent = e.message; mainEl.classList.add('err'); errState = true; exprEl.innerHTML = prettyExpr(expr); return; }
      }
      render();
    }
    function onKey(e){
      const t = document.activeElement;
      if(t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      const k = e.key;
      if(/^[0-9.]$/.test(k) || '+-*/%^()'.includes(k) && k.length === 1){ doAct('ins', k); e.preventDefault(); }
      else if(k === 'Enter' || k === '='){ doAct('eq'); e.preventDefault(); }
      else if(k === 'Backspace'){ doAct('back'); e.preventDefault(); }
      else if(k === 'Escape' || k === 'c' || k === 'C'){ doAct('clear'); e.preventDefault(); }
    }
    document.addEventListener('keydown', onKey);
    render();
    return () => document.removeEventListener('keydown', onKey);
  }
});

/* --- Percentage --- */
reg({ id:'percent', name:'Percentage Calculator', cat:'basic', feat:true,
  short:'Percent of, percent change, increase & decrease',
  keywords:'percent percentage change increase decrease of',
  build(mount){
    const mode = selectField('What do you want to find?', [
      ['of', 'What is X % of Y'], ['is', 'X is what % of Y'],
      ['change', '% change from X to Y'], ['by', 'Increase / decrease Y by X %']
    ]);
    const a = field('X', { value: '' }); const b = field('Y', { value: '' });
    const dir = selectField('Direction', [['inc','Increase'],['dec','Decrease']]);
    dir.root.style.display = 'none';
    fgrid(mount, 2, mode, a); mount.querySelector('.fgrid').appendChild(b.root); mount.querySelector('.fgrid').appendChild(dir.root);
    const out = outBox(mount);
    function labels(){
      const m = mode.select.value;
      a.root.querySelector('label').textContent = m === 'change' ? 'Old value (X)' : 'X';
      b.root.querySelector('label').textContent = m === 'change' ? 'New value (Y)' : 'Y';
      dir.root.style.display = m === 'by' ? '' : 'none';
    }
    mode.select.addEventListener('change', labels); labels();
    actionBar(mount, () => attempt(out, () => {
      const x = val(a.input, { name: 'X' }), y = val(b.input, { name: 'Y' });
      const m = mode.select.value;
      if(m === 'of') out.show([['Result', fmtNum(x / 100 * y), 'lead'], { s: `${fmt(x)}% × ${fmt(y)} = ${fmt(y)} × ${fmt(x/100,6)}` }]);
      else if(m === 'is'){ if(y === 0) throw new Error('Y cannot be zero.'); out.show([['Percentage', pct(x / y * 100), 'lead'], { s: `${fmt(x)} ÷ ${fmt(y)} × 100` }]); }
      else if(m === 'change'){
        if(x === 0) throw new Error('Old value cannot be zero.');
        const c = (y - x) / Math.abs(x) * 100;
        out.show([['Change', (c >= 0 ? '+' : '') + fmt(c, 4) + '%', c >= 0 ? 'lead good' : 'lead bad'],
          ['Direction', c > 0 ? 'Increase' : c < 0 ? 'Decrease' : 'No change'],
          { s: `(new − old) ÷ |old| × 100 = (${fmt(y)} − ${fmt(x)}) ÷ ${fmt(Math.abs(x))} × 100` }]);
      } else {
        const f = dir.select.value === 'inc' ? 1 + x / 100 : 1 - x / 100;
        out.show([['Result', fmtNum(y * f), 'lead'], ['Applied factor', fmt(f, 6)], { s: `${fmt(y)} × ${fmt(f, 6)}` }]);
      }
    }));
    note(mount, 'Percent change uses the absolute value of the old value in the denominator so the sign always reflects increase (+) or decrease (−).');
  }
});

/* --- Fraction --- */
reg({ id:'fraction', name:'Fraction Calculator', cat:'basic',
  short:'Add, subtract, multiply & divide fractions with simplification',
  keywords:'fraction simplify numerator denominator mixed number',
  build(mount){
    const mk = ph => { const f = field(ph, { value: '' }); return f; };
    const n1 = mk('Numerator'), d1 = mk('Denominator'), n2 = mk('Numerator'), d2 = mk('Denominator');
    const op = selectField('Operation', [['+','+  Add'],['-','−  Subtract'],['*','×  Multiply'],['/','÷  Divide']]);
    [n1, d1, n2, d2].forEach(f => f.root.querySelector('label').textContent = f.root.querySelector('label').textContent);
    const grp = el('div', 'frac-group');
    const f1 = el('div', 'frac'), f2 = el('div', 'frac');
    f1.append(n1.root, d1.root); f2.append(n2.root, d2.root);
    const slash = el('span', 'frac-slash'); slash.textContent = '/';
    grp.append(f1, op.root, f2);
    mount.appendChild(grp);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const a = val(n1.input, { name: 'First numerator', integer: true });
      const b = val(d1.input, { name: 'First denominator', integer: true });
      const c = val(n2.input, { name: 'Second numerator', integer: true });
      const d = val(d2.input, { name: 'Second denominator', integer: true });
      if(b === 0 || d === 0) throw new Error('Denominators cannot be zero.');
      let rn, rd, step;
      const o = op.select.value;
      if(o === '+'){ rn = a * d + c * b; rd = b * d; step = `${a}/${b} + ${c}/${d} = (${a}×${d} + ${c}×${b}) / (${b}×${d}) = ${rn}/${rd}`; }
      else if(o === '-'){ rn = a * d - c * b; rd = b * d; step = `${a}/${b} − ${c}/${d} = (${a}×${d} − ${c}×${b}) / (${b}×${d}) = ${rn}/${rd}`; }
      else if(o === '*'){ rn = a * c; rd = b * d; step = `${a}/${b} × ${c}/${d} = ${rn}/${rd}`; }
      else { if(c === 0) throw new Error('Cannot divide by a zero fraction.'); rn = a * d; rd = b * c; step = `${a}/${b} ÷ ${c}/${d} = ${a}/${b} × ${d}/${c} = ${rn}/${rd}`; }
      if(rd < 0){ rn = -rn; rd = -rd; }
      const g = gcd(rn, rd) || 1; const sn = rn / g, sd = rd / g;
      const rows = [[ 'Raw result', rn + ' / ' + rd ]];
      if(g !== 1) rows.push(['Simplified (÷ GCD ' + g + ')', sn + ' / ' + sd, 'lead']);
      else rows.push(['Simplified', sn + ' / ' + sd, 'lead']);
      if(sd !== 1 && Math.abs(sn) > sd){
        const w = Math.trunc(sn / sd), rem = Math.abs(sn % sd);
        rows.push(['Mixed number', (w < 0 ? '−' : '') + Math.abs(w) + ' ' + rem + '/' + sd]);
      }
      rows.push({ s: step });
      rows.push(['Decimal', fmtNum(sn / sd)]);
      out.show(rows);
    }));
    note(mount, 'Results are reduced using the greatest common divisor. Improper fractions are also shown as mixed numbers.');
  }
});

/* --- Ratio & proportion --- */
reg({ id:'ratio', name:'Ratio & Proportion', cat:'basic',
  short:'Solve proportions and split amounts by ratio',
  keywords:'ratio proportion split distribute share',
  build(mount){
    const h1 = el('h3'); h1.textContent = 'Solve proportion  a : b = c : x'; h1.style.cssText = 'font-size:1rem;margin-bottom:12px';
    mount.appendChild(h1);
    const fa = field('a', { value: '' }), fb = field('b', { value: '' }), fc = field('c', { value: '' });
    fgrid(mount, 3, fa, fb, fc);
    const out1 = outBox(mount, 'Proportion result');
    actionBar(mount, () => attempt(out1, () => {
      const a = val(fa.input, { name: 'a' }), b = val(fb.input, { name: 'b' }), c = val(fc.input, { name: 'c' });
      if(a === 0) throw new Error('a cannot be zero.');
      const x = b * c / a;
      out1.show([['x (fourth term)', fmtNum(x), 'lead'], { s: `x = b × c ÷ a = ${fmt(b)} × ${fmt(c)} ÷ ${fmt(a)}` }]);
    }), 'Solve');
    const h2 = el('h3'); h2.textContent = 'Split an amount by ratio'; h2.style.cssText = 'font-size:1rem;margin:26px 0 12px';
    mount.appendChild(h2);
    const famt = field('Total amount', { value: '1000' });
    const fratio = field('Ratio parts (comma-separated)', { type: 'text', ph: 'e.g. 2, 3, 5', value: '2, 3, 5' });
    fgrid(mount, 2, famt, fratio);
    const out2 = outBox(mount, 'Split result');
    actionBar(mount, () => attempt(out2, () => {
      const amt = val(famt.input, { name: 'Amount' });
      const parts = numList(fratio.input.value, 'Ratio parts').map(p => { if(p < 0) throw new Error('Ratio parts must be ≥ 0.'); return p; });
      if(parts.length < 2) throw new Error('Enter at least two ratio parts.');
      const sum = parts.reduce((s, p) => s + p, 0);
      if(sum === 0) throw new Error('Ratio parts cannot all be zero.');
      const rows = parts.map((p, i) => ['Share ' + (i + 1) + ' (' + fmt(p) + ' part' + (p === 1 ? '' : 's') + ')', fmtNum(amt * p / sum)]);
      rows.push(['Check — total', fmtNum(amt), 'good'], { s: 'share = amount × part ÷ sum of parts (' + fmt(sum) + ')' });
      out2.show(rows);
    }), 'Split');
  }
});

/* --- Average --- */
reg({ id:'average', name:'Average Calculator', cat:'basic',
  short:'Mean, sum, count, min & max of a number list',
  keywords:'average mean sum numbers list',
  build(mount){
    const f = field('Numbers (comma or space separated)', { type: 'text', ph: 'e.g. 12, 15, 9, 21' });
    mount.appendChild(f.root);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const nums = numList(f.input.value);
      const sum = nums.reduce((s, n) => s + n, 0);
      out.show([
        ['Average (mean)', fmtNum(sum / nums.length), 'lead'],
        ['Sum', fmtNum(sum)], ['Count', fmt(nums.length, 0)],
        ['Minimum', fmtNum(Math.min(...nums))], ['Maximum', fmtNum(Math.max(...nums))],
        ['Range', fmtNum(Math.max(...nums) - Math.min(...nums))],
        { s: 'mean = sum ÷ count = ' + fmtNum(sum) + ' ÷ ' + nums.length }
      ]);
    }));
    note(mount, 'Accepts commas, spaces or both. For weight-aware averages, use the Weighted Average tool in Student.');
  }
});

/* ============================================================
   B. SCIENTIFIC CALCULATORS
   ============================================================ */

/* --- Scientific Calculator --- */
reg({ id:'scientific', name:'Scientific Calculator', cat:'scientific', feat:true,
  short:'Trig, logs, powers, factorials, brackets & precedence',
  keywords:'scientific trig sin cos tan log ln power root factorial pi exponent',
  build(mount){
    let deg = true;
    mount.innerHTML = `
      <div class="calcwrap">
        <div class="sc-toprow"><div id="sciSeg"></div><span class="dim" style="font-size:.78rem">type or tap keys</span></div>
        <div class="sc-display">
          <input class="sci-input" id="sciInp" type="text" inputmode="text" autocomplete="off" spellcheck="false" aria-label="Scientific expression">
          <div class="sc-prev" id="sciPrev">&nbsp;</div>
        </div>
        <div class="keys k5" id="sciKeys"></div>
      </div>
      <p class="note">Trig uses <b>degrees</b> by default — switch to radians above. <code>%</code> = ÷100, <code>!</code> = factorial (0–170), implicit multiplication works: <code>2π</code>, <code>3(4+1)</code>. Operator precedence and brackets are fully respected.</p>`;
    const segc = seg([['deg','DEG'],['rad','RAD']], k => { deg = k === 'deg'; preview(); });
    mount.querySelector('#sciSeg').appendChild(segc.root);
    const inp = mount.querySelector('#sciInp'), prev = mount.querySelector('#sciPrev'), keys = mount.querySelector('#sciKeys');
    const KEYS = [
      ['sin(','fn'],['cos(','fn'],['tan(','fn'],['log(','fn'],['ln(','fn'],
      ['√(','fn','sqrt('],['x²','fn','^2'],['^','op'],['!','op'],['π','op','pi'],
      ['7','n'],['8','n'],['9','n'],['÷','op','/'],['⌫','fn','BACK'],
      ['4','n'],['5','n'],['6','n'],['×','op','*'],['C','fn','CLEAR'],
      ['1','n'],['2','n'],['3','n'],['−','op','-'],['%','op'],
      ['0','n'],['.','n'],['(',')'],['+','op'],['e','op','e']
    ];
    function insert(s){
      const st = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? st;
      inp.value = inp.value.slice(0, st) + s + inp.value.slice(en);
      const p = st + s.length; inp.setSelectionRange(p, p); inp.focus(); preview();
    }
    KEYS.forEach(([lab, kind, v]) => {
      const b = el('button', 'key ' + (kind === 'fn' ? 'fn' : kind === 'op' ? 'op' : ''));
      b.type = 'button'; b.textContent = lab;
      b.addEventListener('click', () => {
        if(v === 'BACK') inp.value = smartBack(inp.value);
        else if(v === 'CLEAR') inp.value = '';
        else insert(v != null ? v : lab);
        inp.focus(); preview();
      });
      keys.appendChild(b);
    });
    const eq = el('button', 'key eq'); eq.type = 'button'; eq.textContent = '=';
    eq.addEventListener('click', doEq); keys.appendChild(eq);

    function preview(){
      if(!inp.value.trim()){ prev.innerHTML = '&nbsp;'; return; }
      try { prev.textContent = '= ' + fmtNum(Engine.eval(inp.value, deg)); prev.classList.remove('err'); }
      catch(e){ prev.innerHTML = '&nbsp;'; }
    }
    function doEq(){
      try{
        const r = Engine.eval(inp.value, deg);
        prev.textContent = '= ' + fmtNum(r);
        inp.value = rawNum(r);
      }catch(e){ prev.textContent = e.message; }
    }
    inp.addEventListener('input', preview);
    inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); doEq(); } });
    return null;
  }
});

/* --- Powers & Roots --- */
reg({ id:'powers', name:'Powers & Roots', cat:'scientific',
  short:'Squares, cubes, nth powers, roots & exponentials',
  keywords:'power square cube root nth exponential exp',
  build(mount){
    const h1 = el('h3'); h1.textContent = 'From a single value x'; h1.style.cssText = 'font-size:1rem;margin-bottom:12px';
    mount.appendChild(h1);
    const fx = field('x', { value: '8' }); mount.appendChild(fx.root);
    const out1 = outBox(mount);
    actionBar(mount, () => attempt(out1, () => {
      const x = val(fx.input, { name: 'x' });
      const rows = [
        ['x²', fmtNum(x * x)], ['x³', fmtNum(x * x * x)],
        ['√x', x < 0 ? 'not real' : fmtNum(Math.sqrt(x))],
        ['∛x', fmtNum(Math.cbrt(x))],
        ['1/x', x === 0 ? 'undefined' : fmtNum(1 / x)],
        ['eˣ', fmtNum(Math.exp(x))], ['10ˣ', fmtNum(Math.pow(10, x))],
        ['|x|', fmtNum(Math.abs(x))]
      ];
      if(Number.isInteger(x) && x >= 0 && x <= 170) rows.push(['x!', fmtNum(fact(x))]);
      out1.show(rows);
    }), 'Compute');
    const h2 = el('h3'); h2.textContent = 'Custom power & root'; h2.style.cssText = 'font-size:1rem;margin:26px 0 12px';
    mount.appendChild(h2);
    const fb = field('Base (a)', { value: '2' }), fe = field('Exponent (n)', { value: '10' });
    const fn = field('Root degree (n)', { value: '3', integer: true }), fr = field('Value', { value: '27' });
    fgrid(mount, 2, fb, fe); fgrid(mount, 2, fn, fr);
    const out2 = outBox(mount);
    actionBar(mount, () => attempt(out2, () => {
      const a = val(fb.input, { name: 'Base' }), n = val(fe.input, { name: 'Exponent' });
      const d = val(fn.input, { name: 'Root degree', integer: true }), rv = val(fr.input, { name: 'Value' });
      const pw = Math.pow(a, n);
      let root;
      if(d === 0) root = 'undefined';
      else if(rv < 0 && d % 2 === 0) root = 'not real';
      else root = fmtNum(d % 2 !== 0 && rv < 0 ? -Math.pow(-rv, 1 / d) : Math.pow(rv, 1 / d));
      out2.show([
        [`${fmt(a)} ^ ${fmt(n)}`, fmtNum(pw), 'lead'],
        [`${fmt(d)}th root of ${fmt(rv)}`, root, 'lead'],
        { s: 'aⁿ uses repeated multiplication; ⁿ√x = x^(1/n)' }
      ]);
    }), 'Compute');
  }
});

/* --- Factorial --- */
reg({ id:'factorial', name:'Factorial Calculator', cat:'scientific',
  short:'n! for whole numbers 0–170, with digit count',
  keywords:'factorial n product permutation combination',
  build(mount){
    const f = field('n (whole number, 0–170)', { value: '10', integer: true, min: 0, max: 170 });
    mount.appendChild(f.root);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const n = val(f.input, { name: 'n', integer: true, min: 0, max: 170 });
      const r = fact(n);
      let digits = 1; if(r > 0){ digits = 0; let t = r; while(t >= 1){ t /= 10; digits++; } }
      const rows = [[n + '!', fmtNum(r), 'lead'], ['Digits in result', fmt(digits, 0)]];
      if(n <= 20) rows.push({ s: n + '! = ' + Array.from({ length: n }, (_, i) => n - i).join(' × ') || n + '! = 1' });
      out.show(rows);
    }));
    note(mount, 'n! = n × (n−1) × … × 1, with 0! = 1. Values above 170 exceed double-precision range and are rejected.');
  }
});

/* --- Scientific notation --- */
reg({ id:'scinotation', name:'Scientific Notation', cat:'scientific',
  short:'Convert between decimal, scientific & E-notation',
  keywords:'scientific notation exponent mantissa e notation standard form',
  build(mount){
    const h1 = el('h3'); h1.textContent = 'Decimal → scientific'; h1.style.cssText = 'font-size:1rem;margin-bottom:12px';
    mount.appendChild(h1);
    const fd = field('Decimal number', { type: 'text', ph: 'e.g. 0.000452 or 6320000', value: '6320000' });
    mount.appendChild(fd.root);
    const out1 = outBox(mount);
    actionBar(mount, () => attempt(out1, () => {
      const n = val(fd.input, { name: 'Number' });
      if(n === 0){ out1.show([['Scientific', '0 × 10⁰', 'lead'], ['E-notation', '0E0']]); return; }
      const e = Math.floor(Math.log10(Math.abs(n)));
      const m = n / Math.pow(10, e);
      const mm = parseFloat(m.toPrecision(8));
      out1.show([
        ['Scientific', mm + ' × 10' + superscript(e), 'lead'],
        ['E-notation', mm + 'E' + e],
        ['Mantissa / exponent', mm + '  /  ' + e],
        { s: 'normalized so 1 ≤ |mantissa| < 10' }
      ]);
    }), 'Convert');
    const h2 = el('h3'); h2.textContent = 'Mantissa × 10^exponent → decimal'; h2.style.cssText = 'font-size:1rem;margin:26px 0 12px';
    mount.appendChild(h2);
    const fm = field('Mantissa', { value: '3.2' }), fe = field('Exponent', { value: '5', integer: true });
    fgrid(mount, 2, fm, fe);
    const out2 = outBox(mount);
    actionBar(mount, () => attempt(out2, () => {
      const m = val(fm.input, { name: 'Mantissa' }), e = val(fe.input, { name: 'Exponent', integer: true, min: -300, max: 300 });
      out2.show([['Decimal value', fmtNum(m * Math.pow(10, e)), 'lead'], { s: `${fmt(m)} × 10^(${fmt(e,0)})` }]);
    }), 'Convert');
  }
});

/* ============================================================
   C. STUDENT CALCULATORS
   ============================================================ */

/* --- Percentage & marks --- */
reg({ id:'marks', name:'Percentage & Marks', cat:'student',
  short:'Marks to percentage and marks needed for a target',
  keywords:'marks percentage exam score obtained total student',
  build(mount){
    const fo = field('Marks obtained', { value: '412' }), ft = field('Total marks', { value: '500' }), fg = field('Target % (optional)', { value: '90', required: false });
    fgrid(mount, 3, fo, ft, fg);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const o = val(fo.input, { name: 'Marks obtained', min: 0 });
      const t = val(ft.input, { name: 'Total marks', min: 0 });
      if(t === 0) throw new Error('Total marks cannot be zero.');
      if(o > t) throw new Error('Obtained marks cannot exceed total marks.');
      const p = o / t * 100;
      const rows = [['Percentage', fmt(p, 4) + '%', 'lead'], { s: `${fmt(o)} ÷ ${fmt(t)} × 100` }];
      const gRaw = fg.input.value.trim();
      if(gRaw){
        const g = val(fg.input, { name: 'Target %', min: 0, max: 100 });
        const needTotal = Math.ceil(g / 100 * t - 1e-9);
        const extra = needTotal - o;
        if(extra <= 0) rows.push(['Marks needed for ' + fmt(g) + '%', '0 — already achieved', 'good']);
        else rows.push(['Marks needed for ' + fmt(g) + '%', fmt(extra, 0) + ' more', extra > t - o ? 'bad' : 'good']);
      }
      out.show(rows);
    }));
    note(mount, '“Marks needed” rounds up to the next whole mark so the target is guaranteed.');
  }
});

/* --- Grade calculator (configurable scale) --- */
reg({ id:'grade', name:'Grade Calculator', cat:'student',
  short:'Score → letter grade with your own configurable scale',
  keywords:'grade letter gpa scale threshold configurable',
  build(mount){
    const scale = loadJSON('cs_gradescale', [
      { g: 'A+', m: '90' }, { g: 'A', m: '80' }, { g: 'B', m: '70' },
      { g: 'C', m: '60' }, { g: 'D', m: '50' }, { g: 'F', m: '0' }
    ]);
    const fo = field('Marks obtained', { value: '74' }), ft = field('Total marks', { value: '100' });
    fgrid(mount, 2, fo, ft);
    const h = el('h3'); h.textContent = 'Grading scale (editable — highest matching minimum wins)'; h.style.cssText = 'font-size:.92rem;margin:22px 0 10px';
    mount.appendChild(h);
    const ed = rowEditor({ cols: [{ key: 'g', label: 'Grade', type: 'text', ph: 'A+' }, { key: 'm', label: 'Minimum %', ph: '90' }], initial: scale.length, addLabel: 'Add grade' });
    mount.appendChild(ed.root);
    ed.values().forEach((row, i) => { if(scale[i]){ const inputs = ed.root.querySelectorAll('.rowed-row')[i].querySelectorAll('input'); inputs[0].value = scale[i].g; inputs[1].value = scale[i].m; } });
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const o = val(fo.input, { name: 'Marks obtained', min: 0 });
      const t = val(ft.input, { name: 'Total marks', min: 0 });
      if(t === 0) throw new Error('Total marks cannot be zero.');
      const rows = ed.values().filter(r => r.g.trim() || r.m.trim());
      if(rows.length < 2) throw new Error('Define at least two grades in the scale.');
      const parsed = rows.map(r => { const m = Number(r.m); if(!isFinite(m)) throw new Error('“' + r.m + '” is not a valid minimum.'); return { g: r.g.trim() || '?', m }; });
      saveJSON('cs_gradescale', parsed.map(p => ({ g: p.g, m: String(p.m) })));
      const p = o / t * 100;
      const sorted = [...parsed].sort((a, b) => b.m - a.m);
      const hit = sorted.find(s => p >= s.m);
      if(!hit) throw new Error('No grade covers ' + fmt(p, 2) + '% — lower the smallest minimum (e.g. F at 0).');
      out.show([
        ['Percentage', fmt(p, 4) + '%'],
        ['Grade', hit.g, 'lead'],
        { s: `scale: ${sorted.map(s => s.g + ' ≥ ' + fmt(s.m) + '%').join(' · ')}` }
      ]);
    }), 'Find grade');
    note(mount, 'Your scale is saved on this device automatically when you calculate.');
  }
});

/* --- GPA / CGPA --- */
reg({ id:'gpa', name:'GPA / CGPA Calculator', cat:'student', feat:true,
  short:'Credit-weighted GPA with editable grade points',
  keywords:'gpa cgpa credits grade point semester university college',
  build(mount){
    const ed = rowEditor({
      cols: [{ key: 'p', label: 'Grade point', ph: 'e.g. 9' }, { key: 'c', label: 'Credits', ph: 'e.g. 4' }],
      initial: 5, addLabel: 'Add subject'
    });
    mount.appendChild(ed.root);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const rows = ed.values().filter(r => r.p.trim() || r.c.trim());
      if(!rows.length) throw new Error('Fill in at least one subject.');
      let num = 0, den = 0;
      rows.forEach((r, i) => {
        const p = Number(r.p), c = Number(r.c);
        if(!isFinite(p) || !isFinite(c)) throw new Error('Row ' + (i + 1) + ' needs numbers in both columns.');
        if(c < 0 || p < 0) throw new Error('Row ' + (i + 1) + ': values must be ≥ 0.');
        if(c === 0) throw new Error('Row ' + (i + 1) + ': credits cannot be zero.');
        num += p * c; den += c;
      });
      out.show([
        ['GPA / CGPA', fmt(num / den, 4), 'lead'],
        ['Total credits', fmt(den, 2)],
        ['Subjects counted', fmt(rows.length, 0)],
        { s: 'GPA = Σ(point × credits) ÷ Σ(credits)' }
      ]);
    }), 'Calculate GPA');
    note(mount, 'Works with any scale — enter the grade points your institution uses (4-point, 10-point, …). Rows left empty are ignored.');
  }
});

/* --- Attendance --- */
reg({ id:'attendance', name:'Attendance Calculator', cat:'student',
  short:'Current %, classes needed to hit target, safe skips',
  keywords:'attendance classes target required bunk skip college school',
  build(mount){
    const fa = field('Classes attended', { value: '32' }), fh = field('Total classes held', { value: '40' }), ft = field('Target attendance', { value: '75', suffix: '%' });
    fgrid(mount, 3, fa, fh, ft);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const a = val(fa.input, { name: 'Classes attended', integer: true, min: 0 });
      const h = val(fh.input, { name: 'Classes held', integer: true, min: 1 });
      const t = val(ft.input, { name: 'Target %', min: 0, max: 100 });
      if(a > h) throw new Error('Attended cannot exceed classes held.');
      const cur = a / h * 100, tf = t / 100;
      const rows = [['Current attendance', fmt(cur, 2) + '%', cur >= t ? 'lead good' : 'lead bad']];
      if(tf >= 1){
        rows.push(['Classes needed for 100%', a === h ? 'attend every future class' : 'unreachable — a class was already missed', a === h ? 'good' : 'bad']);
        rows.push(['Classes you can skip', '0']);
      } else {
        const needed = Math.max(0, Math.ceil((tf * h - a) / (1 - tf) - 1e-9));
        rows.push(['To reach ' + fmt(t) + '%', needed === 0 ? 'already there — attend next class to stay' : needed + ' consecutive classes', needed === 0 ? 'good' : '']);
        const skip = Math.floor(a / tf - h + 1e-9);
        rows.push(['Classes you can safely skip', Math.max(0, skip), skip < 0 ? 'bad' : '']);
        if(cur < t) rows.push({ s: 'You are below target — no skips until you recover.' });
        rows.push({ s: 'needed = ceil((target×held − attended) ÷ (1 − target)) · skips = floor(attended ÷ target − held)' });
      }
      out.show(rows);
    }));
    note(mount, 'Assumes every future class you attend counts, and skipped classes are simply added to “held”.');
  }
});

/* --- Exam target --- */
reg({ id:'examtarget', name:'Exam Target Calculator', cat:'student',
  short:'Marks needed in the final exam to reach your goal',
  keywords:'exam target final needed marks goal overall percentage',
  build(mount){
    const fs = field('Marks scored so far', { value: '62' }), fm = field('Max marks so far', { value: '80' });
    const ff = field('Final exam max marks', { value: '100' }), ft = field('Target overall %', { value: '85', suffix: '%' });
    fgrid(mount, 2, fs, fm); fgrid(mount, 2, ff, ft);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const s = val(fs.input, { name: 'Marks scored', min: 0 });
      const m = val(fm.input, { name: 'Max marks so far', min: 0 });
      const f = val(ff.input, { name: 'Final exam max', min: 1 });
      const t = val(ft.input, { name: 'Target %', min: 0, max: 100 });
      if(s > m) throw new Error('Scored marks cannot exceed max marks.');
      const totalMax = m + f;
      const need = Math.ceil(t / 100 * totalMax - 1e-9) - s;
      const rows = [];
      if(need <= 0) rows.push(['Marks needed in final', '0 — target already secured', 'lead good']);
      else if(need > f) rows.push(['Marks needed in final', fmt(need, 0) + ' (impossible — max is ' + fmt(f, 0) + ')', 'lead bad']);
      else rows.push(['Marks needed in final', fmt(need, 0) + ' / ' + fmt(f, 0), 'lead']);
      const maxPct = (s + f) / totalMax * 100;
      rows.push(['Maximum achievable overall', fmt(maxPct, 2) + '%'],
        { s: `needed = ceil(${fmt(t)}% × ${fmt(totalMax,0)}) − ${fmt(s,0)}` });
      out.show(rows);
    }), 'Find target');
  }
});

/* --- Weighted average --- */
reg({ id:'wavg', name:'Weighted Average', cat:'student',
  short:'Average where each value carries its own weight',
  keywords:'weighted average weight assignment internal external',
  build(mount){
    const ed = rowEditor({
      cols: [{ key: 'v', label: 'Value', ph: 'e.g. 82' }, { key: 'w', label: 'Weight', ph: 'e.g. 0.3' }],
      initial: 4, addLabel: 'Add item'
    });
    mount.appendChild(ed.root);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const rows = ed.values().filter(r => r.v.trim() || r.w.trim());
      if(!rows.length) throw new Error('Fill in at least one item.');
      let num = 0, den = 0;
      rows.forEach((r, i) => {
        const v = Number(r.v), w = Number(r.w);
        if(!isFinite(v) || !isFinite(w)) throw new Error('Row ' + (i + 1) + ' needs numbers in both columns.');
        if(w < 0) throw new Error('Row ' + (i + 1) + ': weight must be ≥ 0.');
        num += v * w; den += w;
      });
      if(den === 0) throw new Error('Total weight cannot be zero.');
      out.show([
        ['Weighted average', fmtNum(num / den), 'lead'],
        ['Total weight', fmtNum(den)],
        { s: 'Σ(value × weight) ÷ Σ(weight)' + (Math.abs(den - 1) < 1e-9 ? ' — weights sum to 1 ✓' : '') }
      ]);
    }));
    note(mount, 'Weights can be percentages (30, 70), fractions (0.3, 0.7) or credits — only their relative sizes matter.');
  }
});

/* ============================================================
   D. FINANCIAL CALCULATORS
   ============================================================ */

/* --- EMI --- */
reg({ id:'emi', name:'EMI Calculator', cat:'finance', feat:true,
  short:'Monthly instalment, total interest & payment for any loan',
  keywords:'emi loan instalment interest home car personal tenure',
  build(mount){
    const fp = field('Loan amount', { value: '500000', suffix: '₹' });
    const fr = field('Interest rate (per year)', { value: '8.5', suffix: '%' });
    const ft = field('Tenure', { value: '5' });
    const fu = selectField('Tenure unit', [['years','Years'],['months','Months']]);
    fgrid(mount, 2, fp, fr); fgrid(mount, 2, ft, fu);
    const out = outBox(mount);
    const bar = el('div'); bar.style.display = 'none';
    bar.innerHTML = '<div class="splitbar"><div class="sb-p"></div><div class="sb-i"></div></div>' +
      '<div class="splitbar-legend"><span><i style="background:var(--brand)"></i>Principal <b class="lp"></b></span><span><i style="background:var(--amber)"></i>Interest <b class="li"></b></span></div>';
    actionBar(mount, () => attempt(out, () => {
      const P = val(fp.input, { name: 'Loan amount', min: 1 });
      const R = val(fr.input, { name: 'Interest rate', min: 0 });
      const T = val(ft.input, { name: 'Tenure', min: 0 });
      if(T === 0) throw new Error('Tenure cannot be zero.');
      const n = fu.select.value === 'months' ? T : T * 12;
      if(!Number.isInteger(n)) throw new Error('Tenure converts to a fractional month count — use whole months.');
      const r = R / 1200;
      const emi = r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      const total = emi * n, interest = total - P;
      out.show([
        ['Monthly EMI', fmtMoney(emi), 'lead'],
        ['Total payment', fmtMoney(total)],
        ['Total interest', fmtMoney(interest)],
        ['Interest share', pct(interest / total * 100)],
        { s: 'EMI = P·r·(1+r)ⁿ ÷ ((1+r)ⁿ − 1), r = monthly rate' }
      ]);
      bar.style.display = '';
      const pp = P / total * 100;
      bar.querySelector('.sb-p').style.width = pp + '%';
      bar.querySelector('.sb-i').style.width = (100 - pp) + '%';
      bar.querySelector('.lp').textContent = fmt(pp, 1) + '%';
      bar.querySelector('.li').textContent = fmt(100 - pp, 1) + '%';
    }));
    note(mount, 'Assumes a reducing-balance (monthly compounding) loan, the standard for home & personal loans. Amounts rounded to 2 decimals.');
  }
});

/* --- Simple interest --- */
reg({ id:'si', name:'Simple Interest', cat:'finance',
  short:'SI = P·R·T ÷ 100 with total amount',
  keywords:'simple interest principal rate time',
  build(mount){
    const fp = field('Principal', { value: '25000', suffix: '₹' }), fr = field('Rate (per year)', { value: '7', suffix: '%' }), ft = field('Time (years)', { value: '3' });
    fgrid(mount, 3, fp, fr, ft);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const P = val(fp.input, { name: 'Principal', min: 0 }), R = val(fr.input, { name: 'Rate', min: 0 }), T = val(ft.input, { name: 'Time', min: 0 });
      const si = P * R * T / 100;
      out.show([['Simple interest', fmtMoney(si), 'lead'], ['Total amount', fmtMoney(P + si)], { s: `${fmtMoney(P)} × ${fmt(R)}% × ${fmt(T)} yr ÷ 100` }]);
    }));
  }
});

/* --- Compound interest --- */
reg({ id:'ci', name:'Compound Interest', cat:'finance',
  short:'Growth with yearly to monthly compounding',
  keywords:'compound interest compounding frequency investment fd',
  build(mount){
    const fp = field('Principal', { value: '100000', suffix: '₹' }), fr = field('Rate (per year)', { value: '8', suffix: '%' });
    const ft = field('Time (years)', { value: '5' }), fq = selectField('Compounding', [['12','Monthly'],['4','Quarterly'],['2','Half-yearly'],['1','Yearly']]);
    fgrid(mount, 2, fp, fr); fgrid(mount, 2, ft, fq);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const P = val(fp.input, { name: 'Principal', min: 0 }), R = val(fr.input, { name: 'Rate', min: 0 }), T = val(ft.input, { name: 'Time', min: 0 });
      const n = Number(fq.select.value);
      const A = P * Math.pow(1 + R / (100 * n), n * T);
      const eff = (Math.pow(1 + R / (100 * n), n) - 1) * 100;
      out.show([
        ['Maturity amount', fmtMoney(A), 'lead'],
        ['Compound interest earned', fmtMoney(A - P)],
        ['Effective annual rate', fmt(eff, 4) + '%'],
        { s: 'A = P(1 + R/100n)^(nT), n = ' + n + '×/year' }
      ]);
    }));
  }
});

/* --- Discount --- */
reg({ id:'discount', name:'Discount & Final Price', cat:'finance',
  short:'Single or stacked discounts with effective savings',
  keywords:'discount sale price mrp offer stacked final price',
  build(mount){
    const fm = field('Marked price', { value: '2499', suffix: '₹' }), f1 = field('Discount 1', { value: '30', suffix: '%' }), f2 = field('Discount 2 (optional)', { value: '', suffix: '%', required: false });
    fgrid(mount, 3, fm, f1, f2);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const M = val(fm.input, { name: 'Marked price', min: 0 });
      const d1 = val(f1.input, { name: 'Discount 1', min: 0, max: 100 });
      const d2 = val(f2.input, { name: 'Discount 2', min: 0, max: 100, required: false }) || 0;
      const after1 = M * (1 - d1 / 100), fin = after1 * (1 - d2 / 100);
      const eff = (1 - fin / (M || 1)) * 100;
      const rows = [
        ['Final price', fmtMoney(fin), 'lead'],
        ['You save', fmtMoney(M - fin), 'good'],
        ['Effective discount', fmt(eff, 2) + '%']
      ];
      if(d2) rows.push({ s: 'stacked: price × (1 − ' + fmt(d1) + '%) × (1 − ' + fmt(d2) + '%) — discounts multiply, they don’t add' });
      out.show(rows);
    }));
  }
});

/* --- GST --- */
reg({ id:'gst', name:'GST Calculator', cat:'finance',
  short:'Add or remove GST at any rate, with CGST/SGST split',
  keywords:'gst tax india cgst sgst inclusive exclusive',
  build(mount){
    const fa = field('Amount', { value: '1000', suffix: '₹' });
    const frate = selectField('GST rate', [['5','5%'],['12','12%'],['18','18%'],['28','28%'],['3','3%'],['0.25','0.25%'],['custom','Custom…']]);
    const fcustom = field('Custom rate', { value: '18', suffix: '%', required: false });
    fcustom.root.style.display = 'none';
    const fmode = selectField('Amount is', [['add','Exclusive — add GST'],['rem','Inclusive — remove GST']]);
    fgrid(mount, 2, fa, frate); fgrid(mount, 2, fcustom, fmode);
    frate.select.addEventListener('change', () => { fcustom.root.style.display = frate.select.value === 'custom' ? '' : 'none'; });
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const A = val(fa.input, { name: 'Amount', min: 0 });
      const rate = frate.select.value === 'custom' ? val(fcustom.input, { name: 'Custom rate', min: 0, max: 100 }) : Number(frate.select.value);
      let net, tax, gross;
      if(fmode.select.value === 'add'){ net = A; tax = A * rate / 100; gross = net + tax; }
      else { gross = A; net = A / (1 + rate / 100); tax = gross - net; }
      out.show([
        ['Net (before GST)', fmtMoney(net)],
        ['GST @ ' + fmt(rate, 2) + '%', fmtMoney(tax)],
        ['Gross (after GST)', fmtMoney(gross), 'lead'],
        ['CGST + SGST (intra-state)', fmtMoney(tax / 2) + ' + ' + fmtMoney(tax / 2)],
        { s: 'inclusive → net = gross ÷ (1 + rate/100)' }
      ]);
    }));
    note(mount, 'For intra-state supply, GST splits equally into CGST and SGST; inter-state it is charged as IGST of the same total.');
  }
});

/* --- Savings goal --- */
reg({ id:'savings', name:'Savings Goal', cat:'finance',
  short:'How long until your monthly saving hits the target',
  keywords:'savings goal target monthly deposit future value',
  build(mount){
    const fg = field('Goal amount', { value: '500000', suffix: '₹' }), fi = field('Starting balance', { value: '50000', suffix: '₹' });
    const fm = field('Monthly deposit', { value: '10000', suffix: '₹' }), fr = field('Annual return', { value: '7', suffix: '%' });
    fgrid(mount, 2, fg, fi); fgrid(mount, 2, fm, fr);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const goal = val(fg.input, { name: 'Goal', min: 1 });
      const start = val(fi.input, { name: 'Starting balance', min: 0 });
      const monthly = val(fm.input, { name: 'Monthly deposit', min: 0 });
      const R = val(fr.input, { name: 'Annual return', min: 0 });
      if(start >= goal){ out.show([['Time to goal', '0 months — goal already met', 'lead good']]); return; }
      if(monthly === 0 && R === 0) throw new Error('With no deposits and no growth the goal is unreachable.');
      const r = R / 1200; let bal = start, m = 0;
      while(bal < goal && m < 1200){ bal = bal * (1 + r) + monthly; m++; }
      if(m >= 1200) throw new Error('Goal not reached within 100 years — increase deposits or return.');
      const invested = start + monthly * m;
      const yrs = Math.floor(m / 12), mos = m % 12;
      out.show([
        ['Time to goal', (yrs ? yrs + ' yr ' : '') + mos + ' mo', 'lead'],
        ['Total invested', fmtMoney(invested)],
        ['Growth earned', fmtMoney(bal - invested), 'good'],
        ['Balance at that point', fmtMoney(bal)],
        { s: 'monthly compounding; deposit added at end of each month' }
      ]);
    }));
  }
});

/* --- Tip & split --- */
reg({ id:'tip', name:'Tip & Bill Split', cat:'finance',
  short:'Tip amount and per-person share of the bill',
  keywords:'tip bill split restaurant share per person',
  build(mount){
    const fb = field('Bill amount', { value: '1840', suffix: '₹' }), ft = field('Tip', { value: '10', suffix: '%' }), fp = field('People', { value: '4', integer: true, min: 1 });
    fgrid(mount, 3, fb, ft, fp);
    const chips = el('div', 'chips'); chips.style.marginTop = '12px';
    ['5', '10', '15', '20'].forEach(v => {
      const b = el('button', 'pill'); b.type = 'button'; b.textContent = v + '% tip';
      b.addEventListener('click', () => { ft.input.value = v; doCalc(); });
      chips.appendChild(b);
    });
    mount.appendChild(chips);
    const out = outBox(mount);
    function doCalc(){ attempt(out, () => {
      const B = val(fb.input, { name: 'Bill', min: 0 });
      const T = val(ft.input, { name: 'Tip %', min: 0 });
      const P = val(fp.input, { name: 'People', integer: true, min: 1 });
      const tip = B * T / 100, total = B + tip, each = total / P;
      out.show([
        ['Tip amount', fmtMoney(tip)],
        ['Total with tip', fmtMoney(total)],
        ['Per person', fmtMoney(each), 'lead'],
        ['Round up per person', fmtMoney(Math.ceil(each))],
        { s: 'rounded up value makes settling easier' }
      ]);
    }); }
    actionBar(mount, doCalc);
  }
});

/* ============================================================
   E. DATE & TIME CALCULATORS
   ============================================================ */

/* --- Age --- */
reg({ id:'age', name:'Age Calculator', cat:'datetime', feat:true,
  short:'Exact age, totals, and countdown to next birthday',
  keywords:'age birthday date of birth years months days',
  build(mount){
    const today = new Date();
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const fd = field('Date of birth', { type: 'date', value: '2000-01-15' });
    const fa = field('Age as of', { type: 'date', value: iso(today) });
    fgrid(mount, 2, fd, fa);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const dob = parseDate(fd.input.value, 'Date of birth');
      const as = parseDate(fa.input.value, 'As-of date');
      if(dob > as) throw new Error('Date of birth must be before the as-of date.');
      const { y, m, d } = diffYMD(dob, as);
      const totalDays = Math.round((as - dob) / DAY);
      let by = as.getFullYear(); let cand = new Date(by, dob.getMonth(), dob.getDate());
      if(cand < new Date(as.getFullYear(), as.getMonth(), as.getDate())) cand = new Date(by + 1, dob.getMonth(), dob.getDate());
      const toBday = Math.round((cand - new Date(as.getFullYear(), as.getMonth(), as.getDate())) / DAY);
      out.show([
        ['Age', y + ' years, ' + m + ' months, ' + d + ' days', 'lead'],
        ['Total months', fmt(y * 12 + m, 0) + (d ? ' (+ ' + d + ' days)' : '')],
        ['Total weeks', fmt(Math.floor(totalDays / 7), 0)],
        ['Total days', fmt(totalDays, 0)],
        ['Total hours', fmt(totalDays * 24, 0)],
        ['Born on a', dob.toLocaleDateString('en-GB', { weekday: 'long' })],
        ['Next birthday', toBday === 0 ? 'Today — happy birthday! 🎉' : toBday === 1 ? 'Tomorrow' : 'in ' + toBday + ' days (' + fmtDate(cand) + ')']
      ]);
    }), 'Calculate age');
  }
});

/* --- Date difference --- */
reg({ id:'datediff', name:'Date Difference', cat:'datetime',
  short:'Years, months, weeks & days between two dates',
  keywords:'date difference between duration how long',
  build(mount){
    const f1 = field('From', { type: 'date', value: '2026-01-01' }), f2 = field('To', { type: 'date', value: '2026-10-21' });
    fgrid(mount, 2, f1, f2);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      let a = parseDate(f1.input.value, 'From date'), b = parseDate(f2.input.value, 'To date');
      let swapped = false;
      if(a > b){ [a, b] = [b, a]; swapped = true; }
      const days = Math.round((b - a) / DAY);
      const { y, m, d } = diffYMD(a, b);
      const rows = [
        ['Exact difference', y + ' yr, ' + m + ' mo, ' + d + ' d', 'lead'],
        ['Total days', fmt(days, 0)],
        ['Weeks', fmt(Math.floor(days / 7), 0) + ' wk ' + (days % 7) + ' d'],
        ['Approx. months', fmt(y * 12 + m + d / 30.44, 1)]
      ];
      if(swapped) rows.push({ s: 'Dates were swapped so the difference is positive.' });
      out.show(rows);
    }));
    note(mount, 'Months use actual calendar lengths; the approximate months line uses 30.44 d/month.');
  }
});

/* --- Days between dates (with business days) --- */
reg({ id:'daysbetween', name:'Days Between Dates', cat:'datetime',
  short:'Day count with weekday / weekend breakdown',
  keywords:'days between count weekdays business days working',
  build(mount){
    const f1 = field('Start date', { type: 'date', value: '2026-10-01' }), f2 = field('End date', { type: 'date', value: '2026-10-31' });
    fgrid(mount, 2, f1, f2);
    const inc = checkLine('Include the end date (+1 day)', false);
    mount.appendChild(inc.root);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      let a = parseDate(f1.input.value, 'Start date'), b = parseDate(f2.input.value, 'End date');
      if(a > b){ [a, b] = [b, a]; }
      let n = Math.round((b - a) / DAY);
      const weeks = Math.floor(n / 7); let wd = a.getDay(), extra = 0;
      for(let i = 0; i < n % 7; i++){ if(wd !== 0 && wd !== 6) extra++; wd = (wd + 1) % 7; }
      let biz = weeks * 5 + extra;
      if(inc.input.checked){ n += 1; if(b.getDay() !== 0 && b.getDay() !== 6) biz += 1; }
      out.show([
        ['Total days', fmt(n, 0), 'lead'],
        ['Weekdays (Mon–Fri)', fmt(biz, 0)],
        ['Weekend days', fmt(n - biz, 0)],
        { s: 'difference counts elapsed days' + (inc.input.checked ? ' + end date included' : ' (end date excluded)') }
      ]);
    }), 'Count days');
  }
});

/* --- Add / subtract days --- */
reg({ id:'dateadd', name:'Date Add / Subtract', cat:'datetime',
  short:'Add or remove days, weeks, months or years from a date',
  keywords:'date add subtract days weeks months years deadline',
  build(mount){
    const fd = field('Starting date', { type: 'date', value: '2026-10-21' });
    const fn = field('Amount', { value: '30', integer: true });
    const fu = selectField('Unit', [['days','Days'],['weeks','Weeks'],['months','Months'],['years','Years']]);
    const fo = selectField('Operation', [['add','Add'],['sub','Subtract']]);
    fgrid(mount, 2, fd, fn); fgrid(mount, 2, fu, fo);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const d = parseDate(fd.input.value, 'Starting date');
      const n = val(fn.input, { name: 'Amount', integer: true, min: 0, max: 100000 });
      const sign = fo.select.value === 'add' ? 1 : -1;
      let res;
      const u = fu.select.value;
      if(u === 'days') res = new Date(d.getTime() + sign * n * DAY);
      else if(u === 'weeks') res = new Date(d.getTime() + sign * n * 7 * DAY);
      else if(u === 'months') res = addMonths(d, sign * n);
      else res = addMonths(d, sign * n * 12);
      out.show([
        ['Resulting date', fmtDate(res), 'lead'],
        ['ISO format', res.toISOString().slice(0, 10)],
        { s: u === 'months' || u === 'years' ? 'month-end dates clamp (31 Jan + 1 mo → 28/29 Feb)' : 'calendar days, DST ignored' }
      ]);
    }), 'Calculate date');
  }
});

/* --- Time duration --- */
reg({ id:'time', name:'Time Duration', cat:'datetime',
  short:'Difference between times, plus adding durations',
  keywords:'time duration hours minutes seconds between add subtract',
  build(mount){
    const segc = seg([['diff','Between two times'],['math','Add / subtract durations']], k => {
      p1.style.display = k === 'diff' ? '' : 'none';
      p2.style.display = k === 'math' ? '' : 'none';
    });
    mount.appendChild(segc.root);
    const p1 = el('div'); const p2 = el('div'); p2.style.display = 'none';
    mount.append(p1, p2);
    const fs = field('Start time', { type: 'time', value: '09:30' }), fe = field('End time', { type: 'time', value: '17:45' });
    fgrid(p1, 2, fs, fe);
    const out1 = outBox(p1);
    actionBar(p1, () => attempt(out1, () => {
      let s = parseTimeSec(fs.input.value, 'Start time'), e = parseTimeSec(fe.input.value, 'End time');
      let crossed = false;
      if(e < s){ e += 86400; crossed = true; }
      const d = e - s, t = hms(d);
      out1.show([
        ['Duration', t.h + ' h ' + t.m + ' m ' + t.s + ' s', 'lead'],
        ['Decimal hours', fmt(d / 3600, 4)],
        ['Total minutes', fmt(Math.round(d / 60), 0)],
        ...(crossed ? [{ s: 'End was earlier than start — assumed to cross midnight (+24 h).' }] : [])
      ]);
    }), 'Find duration');
    const h1 = field('Hours', { value: '2' }), m1 = field('Minutes', { value: '45' }), s1 = field('Seconds', { value: '0' });
    const op = selectField('Operation', [['+','+'],['-','−']]);
    const h2f = field('Hours', { value: '1' }), m2 = field('Minutes', { value: '20' }), s2 = field('Seconds', { value: '30' });
    fgrid(p2, 3, h1, m1, s1); fgrid(p2, 3, op, h2f, m2); p2.querySelector('.fgrid:last-of-type').appendChild(s2.root);
    const out2 = outBox(p2);
    actionBar(p2, () => attempt(out2, () => {
      const zero = f => { const v = f.input.value.trim(); return v === '' ? 0 : val(f.input, { name: 'Value', min: 0 }); };
      const a = zero(h1) * 3600 + zero(m1) * 60 + zero(s1);
      const b = zero(h2f) * 3600 + zero(m2) * 60 + zero(s2);
      const res = op.select.value === '+' ? a + b : a - b;
      const t = hms(res);
      out2.show([
        ['Result', (t.neg ? '−' : '') + t.h + ' h ' + t.m + ' m ' + t.s + ' s', 'lead'],
        ['Decimal hours', fmt(res / 3600, 4)],
        ['Total seconds', fmt(res, 0)]
      ]);
    }), 'Calculate');
  }
});

/* ============================================================
   F. UNIT CONVERTERS
   ============================================================ */
converterDef('len', 'Length Converter', 'Metric & imperial length units', 'length meter kilometre mile inch feet converter', {
  defFrom: 'm', defTo: 'ft',
  units: [
    { k:'mm', label:'Millimetre (mm)', f:.001 }, { k:'cm', label:'Centimetre (cm)', f:.01 },
    { k:'m', label:'Metre (m)', f:1 }, { k:'km', label:'Kilometre (km)', f:1000 },
    { k:'in', label:'Inch (in)', f:.0254 }, { k:'ft', label:'Foot (ft)', f:.3048 },
    { k:'yd', label:'Yard (yd)', f:.9144 }, { k:'mi', label:'Mile (mi)', f:1609.344 },
    { k:'nmi', label:'Nautical mile', f:1852 }
  ],
  note: 'Exact definitions: 1 in = 2.54 cm, 1 mi = 1,609.344 m, 1 nmi = 1,852 m.'
});
converterDef('weight', 'Weight / Mass Converter', 'Milligrams to tonnes, ounces to stones', 'weight mass kg pound ounce gram converter', {
  defFrom: 'kg', defTo: 'lb',
  units: [
    { k:'mg', label:'Milligram (mg)', f:1e-6 }, { k:'g', label:'Gram (g)', f:.001 },
    { k:'kg', label:'Kilogram (kg)', f:1 }, { k:'t', label:'Tonne (t)', f:1000 },
    { k:'oz', label:'Ounce (oz)', f:.028349523125 }, { k:'lb', label:'Pound (lb)', f:.45359237 },
    { k:'st', label:'Stone (st)', f:6.35029318 }, { k:'uston', label:'US ton', f:907.18474 }
  ],
  note: 'Avoirdupois weights: 1 lb = exactly 0.45359237 kg, 16 oz = 1 lb, 1 st = 14 lb.'
});
converterDef('temp', 'Temperature Converter', 'Celsius, Fahrenheit & Kelvin', 'temperature celsius fahrenheit kelvin converter', {
  defFrom: 'C', defTo: 'F',
  units: [
    { k:'°C', label:'Celsius (°C)', toBase: x => x, fromBase: x => x },
    { k:'°F', label:'Fahrenheit (°F)', toBase: x => (x - 32) * 5 / 9, fromBase: x => x * 9 / 5 + 32 },
    { k:'K', label:'Kelvin (K)', toBase: x => x - 273.15, fromBase: x => x + 273.15 }
  ],
  note: '°F = °C × 9/5 + 32 · K = °C + 273.15 · absolute zero = −273.15 °C = 0 K.'
});
converterDef('area', 'Area Converter', 'From cm² to acres and square miles', 'area square meter hectare acre converter', {
  defFrom: 'm2', defTo: 'ft2',
  units: [
    { k:'cm2', label:'Square centimetre', f:1e-4 }, { k:'m2', label:'Square metre (m²)', f:1 },
    { k:'ha', label:'Hectare (ha)', f:1e4 }, { k:'km2', label:'Square kilometre', f:1e6 },
    { k:'in2', label:'Square inch', f:.00064516 }, { k:'ft2', label:'Square foot', f:.09290304 },
    { k:'yd2', label:'Square yard', f:.83612736 }, { k:'ac', label:'Acre', f:4046.8564224 },
    { k:'mi2', label:'Square mile', f:2589988.110336 }
  ],
  note: '1 acre = 4,046.8564224 m² exactly · 1 hectare = 10,000 m² ≈ 2.471 acres.'
});
converterDef('volume', 'Volume Converter', 'Litres, gallons, cups and more', 'volume litre gallon ml cup pint converter', {
  defFrom: 'L', defTo: 'gal',
  units: [
    { k:'mL', label:'Millilitre (mL)', f:.001 }, { k:'L', label:'Litre (L)', f:1 },
    { k:'m3', label:'Cubic metre (m³)', f:1000 },
    { k:'tsp', label:'Teaspoon (US)', f:.00492892159375 }, { k:'tbsp', label:'Tablespoon (US)', f:.01478676478125 },
    { k:'floz', label:'Fluid ounce (US)', f:.0295735295625 }, { k:'cup', label:'Cup (US)', f:.2365882365 },
    { k:'pt', label:'Pint (US)', f:.473176473 }, { k:'qt', label:'Quart (US)', f:.946352946 },
    { k:'gal', label:'Gallon (US)', f:3.785411784 }
  ],
  note: 'US customary volumes. 1 US gallon = 3.785411784 L exactly (UK gallon = 4.54609 L is not listed).'
});
converterDef('speed', 'Speed Converter', 'm/s, km/h, mph, knots', 'speed velocity kmh mph knot converter', {
  defFrom: 'kmh', defTo: 'mph',
  units: [
    { k:'m/s', label:'Metres per second', f:1 }, { k:'km/h', label:'Kilometres per hour', f:1/3.6 },
    { k:'mph', label:'Miles per hour', f:.44704 }, { k:'ft/s', label:'Feet per second', f:.3048 },
    { k:'kn', label:'Knot', f:.5144444444 }
  ],
  note: '1 knot = 1 nautical mile/hour = 1.852 km/h exactly.'
});
converterDef('timeunits', 'Time Converter', 'Milliseconds to weeks', 'time seconds minutes hours days weeks converter', {
  defFrom: 'h', defTo: 'min',
  units: [
    { k:'ms', label:'Millisecond', f:.001 }, { k:'s', label:'Second', f:1 },
    { k:'min', label:'Minute', f:60 }, { k:'h', label:'Hour', f:3600 },
    { k:'d', label:'Day', f:86400 }, { k:'wk', label:'Week', f:604800 },
    { k:'mo', label:'Month (avg)', f:2629746 }, { k:'yr', label:'Year (avg)', f:31556952 }
  ],
  note: 'Month = average Gregorian month (30.436875 days) · Year = 365.2425 days. Use the Date tools for exact calendar math.'
});
converterDef('storage', 'Digital Storage', 'KB, MB, GB — decimal and binary', 'storage kb mb gb tb kib mib gib bytes bits converter', {
  defFrom: 'GB', defTo: 'GiB', grouped: true,
  units: [
    { g: 'Decimal (SI — powers of 1000)', items: [
      { k:'bit', label:'Bit (bit)', f:.125 }, { k:'B', label:'Byte (B)', f:1 },
      { k:'KB', label:'Kilobyte (KB)', f:1e3 }, { k:'MB', label:'Megabyte (MB)', f:1e6 },
      { k:'GB', label:'Gigabyte (GB)', f:1e9 }, { k:'TB', label:'Terabyte (TB)', f:1e12 }
    ]},
    { g: 'Binary (IEC — powers of 1024)', items: [
      { k:'KiB', label:'Kibibyte (KiB)', f:1024 }, { k:'MiB', label:'Mebibyte (MiB)', f:1048576 },
      { k:'GiB', label:'Gibibyte (GiB)', f:1073741824 }, { k:'TiB', label:'Tebibyte (TiB)', f:1099511627776 }
    ]}
  ],
  note: '<b>Decimal vs binary:</b> storage makers use 1 GB = 1000³ bytes, while operating systems often report in GiB where 1 GiB = 1024³ bytes ≈ 1.074 GB. That’s why a “1 TB” drive shows ≈ 931 GiB.'
});

/* ============================================================
   G. ADVANCED MATHEMATICS
   ============================================================ */

/* --- Statistics --- */
reg({ id:'stats', name:'Statistics (Descriptive)', cat:'math',
  short:'Mean, median, mode, range & standard deviation',
  keywords:'statistics mean median mode range standard deviation variance',
  build(mount){
    const f = field('Data set (comma or space separated)', { type: 'text', ph: 'e.g. 4, 8, 6, 5, 8, 9' });
    mount.appendChild(f.root);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const nums = numList(f.input.value, 'Data');
      const n = nums.length, sum = nums.reduce((s, x) => s + x, 0), mean = sum / n;
      const sorted = [...nums].sort((a, b) => a - b);
      const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
      const freq = {}; nums.forEach(x => freq[x] = (freq[x] || 0) + 1);
      const maxF = Math.max(...Object.values(freq));
      const modes = Object.keys(freq).filter(k => freq[k] === maxF).map(Number);
      const modeStr = maxF === 1 ? 'none (all values unique)' : modes.slice(0, 5).map(fmtNum).join(', ') + (modes.length > 5 ? '…' : '');
      const varP = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
      const varS = n > 1 ? nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
      const rows = [
        ['Mean', fmtNum(mean), 'lead'], ['Median', fmtNum(median)], ['Mode', modeStr],
        ['Range', fmtNum(sorted[n - 1] - sorted[0])],
        ['Minimum / Maximum', fmtNum(sorted[0]) + ' / ' + fmtNum(sorted[n - 1])],
        ['Std deviation (sample)', fmtNum(Math.sqrt(varS))],
        ['Std deviation (population)', fmtNum(Math.sqrt(varP))],
        ['Variance (sample)', fmtNum(varS)],
        ['Count · Sum', n + ' · ' + fmtNum(sum)]
      ];
      if(n <= 20) rows.push({ s: 'sorted: ' + sorted.map(fmtNum).join(', ') });
      out.show(rows);
    }), 'Analyse');
    note(mount, 'Sample standard deviation uses n−1 (Bessel’s correction); population uses n.');
  }
});

/* --- Prime checker --- */
reg({ id:'prime', name:'Prime Number Checker', cat:'math',
  short:'Primality test with factorization & neighbouring primes',
  keywords:'prime number checker factorization composite',
  build(mount){
    const f = field('Number (up to 1,000,000,000,000)', { value: '97', integer: true, min: 0 });
    mount.appendChild(f.root);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const n = val(f.input, { name: 'Number', integer: true, min: 0, max: 1e12 });
      const rows = [];
      if(n < 2){ rows.push(['Prime?', 'No — primes are ≥ 2', 'lead bad']); out.show(rows); return; }
      const p = isPrime(n);
      rows.push(['Prime?', p ? 'Yes ✓' : 'No', p ? 'lead good' : 'lead bad']);
      if(!p){
        const fac = factorize(n);
        const grouped = {}; fac.forEach(x => grouped[x] = (grouped[x] || 0) + 1);
        rows.push(['Prime factorization', Object.entries(grouped).map(([b, e]) => b + (e > 1 ? superscript(e) : '')).join(' × ')]);
      }
      let below = null; for(let x = n - 1; x >= 2 && n - x < 3000; x--) if(isPrime(x)){ below = x; break; }
      let above = null; for(let x = n + 1; x - n < 3000; x++) if(isPrime(x)){ above = x; break; }
      if(below != null) rows.push(['Previous prime', fmt(below, 0)]);
      if(above != null) rows.push(['Next prime', fmt(above, 0)]);
      out.show(rows);
    }), 'Check');
    note(mount, 'Uses trial division up to √n — instant for everyday numbers, capped at 10¹² for speed.');
  }
});

/* --- Factors & multiples --- */
reg({ id:'factors', name:'Factors & Multiples', cat:'math',
  short:'All factors, prime factorization & first multiples',
  keywords:'factors multiples divisor prime factorization',
  build(mount){
    const f = field('Number', { value: '360', integer: true, min: 1, max: 1e9 });
    mount.appendChild(f.root);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const n = val(f.input, { name: 'Number', integer: true, min: 1, max: 1e9 });
      const facs = [];
      for(let i = 1; i * i <= n; i++) if(n % i === 0){ facs.push(i); if(i !== n / i) facs.push(n / i); }
      facs.sort((a, b) => a - b);
      const mults = Array.from({ length: 12 }, (_, i) => fmt(n * (i + 1), 0));
      const grouped = {}; factorize(n).forEach(x => grouped[x] = (grouped[x] || 0) + 1);
      out.show([
        ['Number of factors', fmt(facs.length, 0)],
        ['Factors', facs.length <= 60 ? facs.map(fmt).join(', ') : facs.slice(0, 60).map(fmt).join(', ') + ' …', ''],
        ['Prime factorization', Object.entries(grouped).map(([b, e]) => b + (e > 1 ? superscript(e) : '')).join(' × ')],
        ['First 12 multiples', mults.join(', ')]
      ]);
    }));
  }
});

/* --- LCM & GCD --- */
reg({ id:'lcmgcd', name:'LCM & GCD', cat:'math',
  short:'Greatest common divisor & least common multiple',
  keywords:'lcm gcd hcf greatest common divisor least common multiple',
  build(mount){
    const f = field('Numbers (comma-separated, 2–6)', { type: 'text', value: '12, 18, 24', ph: 'e.g. 12, 18, 24' });
    mount.appendChild(f.root);
    const out = outBox(mount);
    actionBar(mount, () => attempt(out, () => {
      const nums = numList(f.input.value, 'Numbers');
      if(nums.length < 2) throw new Error('Enter at least two numbers.');
      if(nums.length > 6) throw new Error('Up to six numbers, please.');
      nums.forEach(n => { if(!Number.isInteger(n) || n === 0) throw new Error('All values must be non-zero whole numbers.'); if(Math.abs(n) > 1e9) throw new Error('Keep values ≤ 1,000,000,000.'); });
      const g = nums.reduce((a, b) => gcd(a, b));
      const l = nums.reduce((a, b) => lcm(a, b));
      const rows = [['GCD (HCF)', fmt(g, 0), 'lead'], ['LCM', fmt(l, 0), 'lead']];
      if(nums.length === 2) rows.push({ s: `check: ${fmt(nums[0],0)} × ${fmt(nums[1],0)} = ${fmt(Math.abs(nums[0]*nums[1]),0)} = GCD × LCM = ${fmt(g * l,0)} ✓` });
      out.show(rows);
    }));
    note(mount, 'GCD via Euclid’s algorithm; LCM built pairwise as a·b ÷ gcd(a,b).');
  }
});

/* --- Number base converter --- */
reg({ id:'base', name:'Number Base Converter', cat:'math',
  short:'Binary, octal, decimal & hexadecimal — live',
  keywords:'base binary octal decimal hexadecimal hex converter',
  build(mount){
    const f = field('Value', { type: 'text', value: '255', ph: 'digits only' });
    const fb = selectField('Input base', [['2','Binary (2)'],['8','Octal (8)'],['10','Decimal (10)'],['16','Hexadecimal (16)']], { value: '10' });
    fgrid(mount, 2, f, fb);
    const grid = el('div', 'base-grid');
    const outs = {};
    [['2','Binary'],['8','Octal'],['10','Decimal'],['16','Hexadecimal']].forEach(([b, l]) => {
      const d = el('div', 'base-out'); d.innerHTML = '<div class="lbl"></div><div class="val">—</div>';
      d.querySelector('.lbl').textContent = l + ' (base ' + b + ')';
      grid.appendChild(d); outs[b] = d.querySelector('.val');
    });
    mount.appendChild(grid);
    const errP = el('p'); errP.style.cssText = 'color:var(--danger);font-size:.86rem;font-weight:600;margin-top:10px;min-height:1.2em';
    mount.appendChild(errP);
    function parseBase(str, base){
      str = str.trim().toLowerCase().replace(/^(0b|0x|0o)/, '');
      if(!str) throw new Error('Enter a value.');
      if(str.length > 64) throw new Error('Keep it under 64 digits.');
      let acc = 0n;
      for(const ch of str){
        const d = parseInt(ch, 36);
        if(isNaN(d) || d >= base) throw new Error('“' + ch + '” is not valid in base ' + base + '.');
        acc = acc * BigInt(base) + BigInt(d);
      }
      return acc;
    }
    function update(){
      errP.textContent = '';
      try{
        const base = Number(fb.select.value);
        const v = parseBase(f.input.value, base);
        outs['2'].textContent = v.toString(2);
        outs['8'].textContent = v.toString(8);
        outs['10'].textContent = v.toString(10);
        outs['16'].textContent = v.toString(16).toUpperCase();
      }catch(e){
        Object.values(outs).forEach(o => o.textContent = '—');
        errP.textContent = e.message;
      }
    }
    f.input.addEventListener('input', update); fb.select.addEventListener('change', update);
    update();
    note(mount, 'Whole numbers only, arbitrary precision via BigInt. Hex letters a–f are accepted in either case.');
  }
});

/* --- Quadratic equation solver --- */
reg({ id:'quadratic', name:'Quadratic Equation Solver', cat:'math', feat:true,
  short:'Roots, discriminant & vertex with full steps',
  keywords:'quadratic equation roots discriminant ax2 bx c vertex',
  build(mount){
    const eqLine = el('p'); eqLine.style.cssText = 'font:600 1.05rem "JetBrains Mono",monospace;color:var(--muted);margin-bottom:14px';
    eqLine.textContent = 'a·x² + b·x + c = 0';
    mount.appendChild(eqLine);
    const fa = field('a', { value: '1' }), fb = field('b', { value: '-5' }), fc = field('c', { value: '6' });
    fgrid(mount, 3, fa, fb, fc);
    const out = outBox(mount, 'Solution & steps');
    actionBar(mount, () => attempt(out, () => {
      const a = val(fa.input, { name: 'a' }), b = val(fb.input, { name: 'b' }), c = val(fc.input, { name: 'c' });
      if(a === 0){
        if(b === 0) throw new Error(c === 0 ? 'Every x is a solution (0 = 0).' : 'No solution — c ≠ 0 with a = b = 0.');
        out.show([['This is linear (a = 0)', 'x = ' + fmtNum(-c / b), 'lead'], { s: `x = −c ÷ b = ${fmtNum(-c)} ÷ ${fmtNum(b)}` }]);
        return;
      }
      const D = b * b - 4 * a * c;
      const rows = [
        { s: `Equation: ${fmtNum(a)}x² ${b < 0 ? '−' : '+'} ${fmtNum(Math.abs(b))}x ${c < 0 ? '−' : '+'} ${fmtNum(Math.abs(c))} = 0` },
        { s: `Discriminant D = b² − 4ac = ${fmtNum(b * b)} − ${fmtNum(4 * a * c)} = ${fmtNum(D)}` }
      ];
      if(D > 0){
        const r1 = (-b + Math.sqrt(D)) / (2 * a), r2 = (-b - Math.sqrt(D)) / (2 * a);
        rows.push(['Root x₁', fmtNum(r1), 'lead'], ['Root x₂', fmtNum(r2), 'lead'],
          { s: 'x = (−b ± √D) ÷ 2a — two distinct real roots (D > 0)' });
      } else if(D === 0){
        rows.push(['Repeated root', fmtNum(-b / (2 * a)), 'lead'], { s: 'D = 0 — one real root of multiplicity 2' });
      } else {
        const re = -b / (2 * a), im = Math.sqrt(-D) / (2 * a);
        rows.push(['Root x₁', fmtNum(re) + ' + ' + fmtNum(Math.abs(im)) + 'i', 'lead'],
          ['Root x₂', fmtNum(re) + ' − ' + fmtNum(Math.abs(im)) + 'i', 'lead'],
          { s: 'D < 0 — complex conjugate roots' });
      }
      rows.push(['Vertex (h, k)', '(' + fmtNum(-b / (2 * a)) + ', ' + fmtNum(c - b * b / (4 * a)) + ')'],
        ['Sum of roots · Product', fmtNum(-b / a) + ' · ' + fmtNum(c / a)]);
      out.show(rows);
    }), 'Solve');
  }
});

/* ============================================================
   APP SHELL — state, router, home, search, favourites
   ============================================================ */
const state = {
  cat: 'all',
  q: '',
  favs: new Set(loadJSON('cs_favs', [])),
  recents: loadJSON('cs_recents', []).filter(id => CALC[id])
};
const FEATURED = ORDER.filter(id => CALC[id].feat);

/* theme */
function applyTheme(t){
  document.documentElement.dataset.theme = t;
  saveJSON('cs_theme', t);
}
(function initTheme(){
  const saved = loadJSON('cs_theme', null);
  if(saved) applyTheme(saved);
  else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');
})();
$('#themeBtn').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* card builder */
function card(def){
  const c = el('article', 'card ' + CATS[def.cat].cls);
  c.tabIndex = 0;
  c.setAttribute('role', 'button');
  c.setAttribute('aria-label', 'Open ' + def.name);
  c.innerHTML =
    '<div class="card-ic"><svg class="ic"><use href="#' + CATS[def.cat].icon + '"/></svg></div>' +
    '<div class="card-bd"><h3></h3><p></p></div>' +
    '<button class="star" type="button" aria-pressed="false" aria-label="Toggle favourite"><svg class="ic"><use href="#i-star"/></svg></button>';
  c.querySelector('h3').textContent = def.name;
  c.querySelector('p').textContent = def.short;
  const star = c.querySelector('.star');
  const setStar = () => { const on = state.favs.has(def.id); star.classList.toggle('active', on); star.setAttribute('aria-pressed', on); };
  setStar();
  star.addEventListener('click', e => {
    e.stopPropagation();
    if(state.favs.has(def.id)) state.favs.delete(def.id); else state.favs.add(def.id);
    saveJSON('cs_favs', [...state.favs]);
    renderDyn();
    if(currentCalc === def.id) setCalcStar();
  });
  const open = () => { location.hash = '#/c/' + def.id; };
  c.addEventListener('click', open);
  c.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(); } });
  return c;
}

/* category bar */
(function buildCatbar(){
  const bar = $('#catbar');
  const items = [['all', 'All'], ['favs', '★ Favourites'], ...Object.keys(CATS).map(k => [k, CATS[k].name])];
  items.forEach(([k, label]) => {
    const b = el('button', 'catchip' + (k === 'all' ? ' on' : ''));
    b.type = 'button'; b.dataset.cat = k;
    if(k !== 'all') b.classList.add(k === 'favs' ? 'cat-favs' : CATS[k].cls);
    b.innerHTML = '<span class="dot"></span>';
    b.appendChild(document.createTextNode(label));
    b.addEventListener('click', () => {
      state.cat = k;
      bar.querySelectorAll('.catchip').forEach(x => x.classList.toggle('on', x === b));
      renderDyn();
      $('#home-dyn').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    bar.appendChild(b);
  });
})();

/* home rendering */
function matchQ(def, q){
  if(!q) return true;
  const hay = (def.name + ' ' + def.short + ' ' + def.keywords + ' ' + CATS[def.cat].name).toLowerCase();
  return q.split(/\s+/).every(part => hay.includes(part));
}
function section(title, countTxt, catCls){
  const s = el('section', 'home-section');
  const head = el('div', 'hs-head');
  if(catCls){ const mk = el('span', 'hs-catmark ' + catCls); head.appendChild(mk); }
  const h = el('h2'); h.textContent = title; head.appendChild(h);
  if(countTxt){ const c = el('span', 'hs-count'); c.textContent = countTxt; head.appendChild(c); }
  s.appendChild(head);
  return s;
}
function renderDyn(){
  const host = $('#home-dyn');
  host.innerHTML = '';
  const q = state.q.trim().toLowerCase();
  const filtering = q !== '' || state.cat !== 'all';

  if(filtering){
    const list = ORDER.map(id => CALC[id]).filter(d => {
      const catOK = state.cat === 'all' ? true : state.cat === 'favs' ? state.favs.has(d.id) : d.cat === state.cat;
      return catOK && matchQ(d, q);
    });
    const title = q ? 'Results for “' + state.q.trim() + '”' : state.cat === 'favs' ? 'Favourites' : CATS[state.cat].name;
    const s = section(title, list.length + (list.length === 1 ? ' tool' : ' tools'));
    if(list.length){
      const g = el('div', 'grid');
      list.forEach(d => g.appendChild(card(d)));
      s.appendChild(g);
    } else {
      const e = el('div', 'empty');
      e.innerHTML = '<div class="glyph">∅</div><h3>No calculators found</h3><p>Try a different word — or jump to a popular tool:</p>';
      const chips = el('div', 'chips');
      ['emi', 'age', 'percent', 'gst', 'gpa', 'temp'].forEach(id => {
        const b = el('button', 'pill'); b.type = 'button'; b.textContent = CALC[id].name;
        b.addEventListener('click', () => { location.hash = '#/c/' + id; });
        chips.appendChild(b);
      });
      const clear = el('button', 'btn ghost sm'); clear.type = 'button'; clear.textContent = 'Clear search';
      clear.addEventListener('click', () => { state.q = ''; $('#searchInp').value = ''; state.cat = 'all';
        document.querySelectorAll('.catchip').forEach(x => x.classList.toggle('on', x.dataset.cat === 'all'));
        renderDyn(); });
      e.append(chips, el('br'), clear);
      e.querySelector('br').remove();
      chips.style.marginBottom = '16px';
      s.appendChild(e);
    }
    host.appendChild(s);
    return;
  }

  /* curated home */
  if(state.favs.size){
    const s = section('Favourites', state.favs.size + ' saved', 'cat-favs');
    const g = el('div', 'grid');
    [...state.favs].filter(id => CALC[id]).forEach(id => g.appendChild(card(CALC[id])));
    s.appendChild(g); host.appendChild(s);
  }
  if(state.recents.length){
    const s = section('Recently used');
    const row = el('div', 'recent-row');
    state.recents.slice(0, 8).forEach(id => {
      const d = CALC[id]; if(!d) return;
      const b = el('button', 'recent-chip ' + CATS[d.cat].cls); b.type = 'button';
      b.innerHTML = '<span class="dot"></span>'; b.appendChild(document.createTextNode(d.name));
      b.addEventListener('click', () => { location.hash = '#/c/' + id; });
      row.appendChild(b);
    });
    s.appendChild(row); host.appendChild(s);
  }
  {
    const s = section('Featured tools', FEATURED.length + ' picks');
    const g = el('div', 'grid');
    FEATURED.forEach(id => g.appendChild(card(CALC[id])));
    s.appendChild(g); host.appendChild(s);
  }
  Object.keys(CATS).forEach(k => {
    const defs = ORDER.map(id => CALC[id]).filter(d => d.cat === k);
    if(!defs.length) return;
    const s = section(CATS[k].name, defs.length + ' tools', CATS[k].cls);
    const g = el('div', 'grid');
    defs.forEach(d => g.appendChild(card(d)));
    s.appendChild(g); host.appendChild(s);
  });
}

/* search */
$('#searchInp').addEventListener('input', e => { state.q = e.target.value; renderDyn(); });
$('#searchInp').addEventListener('keydown', e => { if(e.key === 'Escape'){ e.target.value = ''; state.q = ''; renderDyn(); } });
document.addEventListener('keydown', e => {
  if(e.key === '/' && !e.ctrlKey && !e.metaKey){
    const t = document.activeElement;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    if(location.hash.startsWith('#/c/')) location.hash = '#/';
    setTimeout(() => $('#searchInp').focus(), 30);
  }
});

/* popular chips */
document.querySelectorAll('.popular .pill').forEach(b => {
  b.addEventListener('click', () => { location.hash = '#/c/' + b.dataset.open; });
});

/* quick calc */
(function quickCalc(){
  const inp = $('#quickInp'), outEl = $('#quickOut');
  inp.addEventListener('input', () => {
    const v = inp.value.trim();
    if(!v){ outEl.textContent = '= 0'; outEl.classList.remove('bad'); return; }
    try { outEl.textContent = '= ' + fmtNum(Engine.eval(v)); outEl.classList.remove('bad'); }
    catch(e){ outEl.textContent = '…'; outEl.classList.remove('bad'); }
  });
  inp.addEventListener('keydown', e => {
    if(e.key === 'Enter'){
      const v = inp.value.trim();
      if(v){ window.__prefill = v; location.hash = '#/c/standard'; }
    }
  });
})();

/* ---------- calculator view / router ---------- */
let currentCalc = null;
let activeCleanup = null;
function addRecent(id){
  state.recents = [id, ...state.recents.filter(x => x !== id)].slice(0, 10);
  saveJSON('cs_recents', state.recents);
}
function setCalcStar(){
  const b = $('#calcStar');
  const on = state.favs.has(currentCalc);
  b.classList.toggle('active', on);
  b.setAttribute('aria-pressed', on);
}
$('#calcStar').addEventListener('click', () => {
  if(!currentCalc) return;
  if(state.favs.has(currentCalc)) state.favs.delete(currentCalc); else state.favs.add(currentCalc);
  saveJSON('cs_favs', [...state.favs]);
  setCalcStar(); renderDyn();
});
$('#backBtn').addEventListener('click', () => { location.hash = '#/'; });

function showHome(){
  $('#view-calc').hidden = true;
  $('#view-home').hidden = false;
  currentCalc = null;
  if(activeCleanup){ try { activeCleanup(); } catch(e){} activeCleanup = null; }
  renderDyn();
}
function showCalc(id){
  const d = CALC[id];
  if(!d){ showHome(); return; }
  if(activeCleanup){ try { activeCleanup(); } catch(e){} activeCleanup = null; }
  currentCalc = id;
  $('#view-home').hidden = true;
  $('#view-calc').hidden = false;
  $('#calcTitle').textContent = d.name;
  $('#calcDesc').textContent = d.short + '.';
  const tag = $('#calcCat');
  tag.textContent = CATS[d.cat].name;
  tag.className = 'cattag ' + CATS[d.cat].cls;
  const mount = $('#calcMount');
  mount.innerHTML = '';
  activeCleanup = d.build(mount) || null;
  setCalcStar();
  /* related */
  $('#relatedTitle').textContent = 'More in ' + CATS[d.cat].name;
  const rel = $('#relatedChips'); rel.innerHTML = '';
  ORDER.map(x => CALC[x]).filter(x => x.cat === d.cat && x.id !== id).slice(0, 6).forEach(x => {
    const b = el('button', 'pill'); b.type = 'button'; b.textContent = x.name;
    b.addEventListener('click', () => { location.hash = '#/c/' + x.id; });
    rel.appendChild(b);
  });
  addRecent(id);
  renderDyn();
  window.scrollTo(0, 0);
  $('#calcTitle').focus({ preventScroll: true });
}
function route(){
  const m = location.hash.match(/^#\/c\/([\w-]+)/);
  if(m && CALC[m[1]]) showCalc(m[1]);
  else showHome();
}
window.addEventListener('hashchange', route);

/* ---------- init ---------- */
$('#toolCount').textContent = ORDER.length;
route();
/* CalcSpace: Open dedicated SEO pages */
(function () {
  const pages = {
    age: "/age-calculator/",
    percent: "/percentage-calculator/",
    emi: "/emi-calculator/",
    gpa: "/gpa-calculator/"
  };

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-open]");
    if (!button) return;

    const page = pages[button.dataset.open];
    if (page) {
      event.preventDefault();
      window.location.href = page;
    }
  });
})();
