/* Built from src/paper_template.html by build.py. Do not edit by hand. */

var DATA = window.__PAPER__;
var GAPRE = /\{\{(\d+)\}\}/g, KGAP = /_{3,}/;
var NAMES = {part1:'Part 1', part2:'Part 2', part3:'Part 3', part4:'Part 4'};
/* The level comes from the paper data ("B2", "C1" or "C2"); a paper without one is C1. */
var LEVELS = {B2:{name:'B2 First', k4:'two and five'}, C1:{name:'C1 Advanced', k4:'three and six'}, C2:{name:'C2 Proficiency', k4:'three and eight'}};
var LV = LEVELS[String(DATA.level || 'C1').toUpperCase()] || LEVELS.C1;
/* "For questions 1 to 8": the numbers come from the part's own items. */
function qrange(p, a, b){ var q = (p && p.items || []).map(function(it){ return it.q; }); return q.length ? q[0] + ' to ' + q[q.length - 1] : a + ' to ' + b; }
var RUB = {
  part1: 'For questions 1 to 8, read the text below and decide which answer (A, B, C or D) best fits each gap. There is an example at the beginning (0).',
  part2: 'For questions 9 to 16, read the text below and think of the word which best fits each gap. Use only one word in each gap. There is an example at the beginning (0).',
  part3: 'For questions 17 to 24, read the text below. Use the word given in capitals after each gap to form a word that fits in the gap. There is an example at the beginning (0).'
};
var STORE = 'uoe_' + DATA.slug;
var S = {set:0, ans:{}, key:false, checked:false};

function el(t, c, x){ var n = document.createElement(t); if(c) n.className = c; if(x != null) n.textContent = x; return n; }
function load(){ try{ var r = JSON.parse(localStorage.getItem(STORE) || '{}'); if(r.ans) S.ans = r.ans; if(typeof r.set === 'number' && DATA.tests[r.set]) S.set = r.set; }catch(e){} }
function save(){ try{ localStorage.setItem(STORE, JSON.stringify({ans:S.ans, set:S.set})); }catch(e){} }
function cur(){ return DATA.tests[S.set]; }
function id(q){ return S.set + '-' + q; }
function list(a){ return Array.isArray(a) ? a : (a ? [a] : []); }
function parts(t){ return ['part1','part2','part3','part4'].filter(function(p){ return t[p]; }); }

/* ---- marking ---- */
function low(s){ return (s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim(); }
function norm(s){
  s = low(s).replace(/\bcan't\b/g, 'cannot').replace(/\bwon't\b/g, 'will not').replace(/\bshan't\b/g, 'shall not')
       .replace(/n't\b/g, ' not').replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'ve\b/g, ' have').replace(/'ll\b/g, ' will')
       .replace(/\b(it|that|there|he|she|what|who|here)'s\b/g, '$1 is');
  return s.replace(/[.,;:!?"|]/g, ' ').replace(/\bcan not\b/g, 'cannot').replace(/\s+/g, ' ').trim();
}
function markWord(it, text){ var c = low(text); if(!c) return 0; return list(it.answer).some(function(a){ return low(a) === c; }) ? 1 : 0; }
function markK(it, text){
  var c = norm(text); if(!c) return 0;
  var acc = [it.answer].concat(it.alts || []), best = 0;
  for(var i = 0; i < acc.length; i++){
    if(c === norm(acc[i])) return 2;
    var h = acc[i].split('|');
    if(h.length === 2){
      var a = norm(h[0]), b = norm(h[1]);
      if((c + ' ').indexOf(a + ' ') === 0 || (c.length >= b.length && (' ' + c).slice(-(b.length + 1)) === ' ' + b)) best = 1;
    }
  }
  return best;
}
function plainK(a){ return a.replace(/\s*\|\s*/g, ' '); }

/* ---- rendering ---- */
var PHOTO = '/assets/img/john.jpg', IG = 'https://www.instagram.com/johnplusenglish/';
var IGSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
function logo(){ var d = el('div', 'logo'); d.appendChild(document.createTextNode('john')); d.appendChild(el('span', null, 'plus')); d.appendChild(document.createTextNode('english')); return d; }
function photo(size){ var i = document.createElement('img'); i.src = PHOTO; i.alt = 'John from johnplusenglish'; i.width = size; i.height = size; return i; }
function igButton(){ var a = document.createElement('a'); a.className = 'ig'; a.href = IG; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = IGSVG; a.appendChild(document.createTextNode('Follow on Instagram')); return a; }
function brandTop(){
  var b = el('div', 'brand'); b.appendChild(photo(56));
  var t = el('div'); t.appendChild(logo()); t.appendChild(el('div', 'handle', '@johnplusenglish')); b.appendChild(t);
  b.appendChild(igButton()); return b;
}
function sheetFoot(){ var f = el('div', 'sfoot'); var l = logo(); l.setAttribute('aria-hidden', 'true'); f.appendChild(l); f.appendChild(el('span', null, '@johnplusenglish on Instagram')); return f; }
function head(title, sub, h){ var d = el('div', 'head'); var t = el(h || 'h2', null, title); d.appendChild(t); d.appendChild(el('div', 'lv', sub)); return d; }
function subline(){ return LV.name + (DATA.tests.length > 1 ? ', ' + (cur().name || 'Test ' + (S.set + 1)) : ''); }

function exampleLine(pk, p){
  var ex = p.example; if(!ex) return null;
  var d = el('p', 'exline'); d.appendChild(el('b', null, 'Example: (0) '));
  if(pk === 'part1'){
    ['A','B','C','D'].forEach(function(L){ var s = el('span', 'exo', L + ' ' + ex.options[L]); if(L === ex.answer) s.style.fontWeight = '600'; d.appendChild(s); });
    d.appendChild(el('span', 'exo', 'Answer: ' + ex.answer));
  } else {
    d.appendChild(document.createTextNode(ex.answer.toUpperCase ? ex.answer.toUpperCase() : ex.answer));
    if(ex.stem) d.appendChild(document.createTextNode('  (from ' + ex.stem + ')'));
  }
  return d;
}

function passage(pk, p){
  var box = el('div', 'text'), items = {}, ex = p.example || {};
  (p.items || []).forEach(function(it){ items[String(it.q)] = it; });
  String(p.text).split(/\n\s*\n/).forEach(function(par){
    var P = el('p'), last = 0, m; GAPRE.lastIndex = 0;
    while((m = GAPRE.exec(par))){
      P.appendChild(document.createTextNode(par.slice(last, m.index)));
      var n = m[1], it = items[n], W = el('span', 'gw');
      P.appendChild(W);
      W.appendChild(el('span', 'gn', '(' + n + ')'));
      if(n === '0'){
        var shown = pk === 'part1' ? (ex.options ? ex.options[ex.answer] : '') : (ex.answer || '');
        W.appendChild(el('span', 'eg', shown));
        if(pk === 'part3' && ex.stem){ W.appendChild(document.createTextNode(' ')); W.appendChild(el('span', 'stem', ex.stem)); }
      } else if(pk === 'part1'){
        var sl = el('span', 'slot'); sl.id = 'g-' + n; sl.textContent = it && S.ans[id(n)] ? it.options[S.ans[id(n)]] : '';
        sl.setAttribute('aria-label', 'Gap ' + n); W.appendChild(sl);
      } else {
        var inp = document.createElement('input');
        inp.type = 'text'; inp.className = 'gap'; inp.id = 'g-' + n; inp.value = S.ans[id(n)] || '';
        inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('autocapitalize', 'off');
        inp.setAttribute('aria-label', 'Question ' + n + (it && it.stem ? ', from ' + it.stem : ''));
        (function(nn, ii){
          ii.addEventListener('input', function(){ fitGap(ii); S.ans[id(nn)] = ii.value; save(); ii.classList.remove('m0','m1','m2'); document.getElementById('score').textContent = ''; });
          ii.addEventListener('keydown', function(e){ if(e.key !== 'Enter') return; e.preventDefault(); var all = Array.prototype.slice.call(document.querySelectorAll('#paper input.gap')), k = all.indexOf(ii); if(all[k + 1]) all[k + 1].focus(); });
        })(n, inp);
        W.appendChild(inp);
        if(pk === 'part3' && it){ W.appendChild(document.createTextNode(' ')); W.appendChild(el('span', 'stem', it.stem)); }
      }
      last = m.index + m[0].length;
    }
    P.appendChild(document.createTextNode(par.slice(last)));
    box.appendChild(P);
  });
  return box;
}

function options(p){
  var wrap = el('div', 'opts');
  p.items.forEach(function(it){
    var n = String(it.q), row = el('div', 'orow'); row.appendChild(el('div', 'no', n));
    var ch = el('div', 'ochoices'); ch.setAttribute('role', 'group'); ch.setAttribute('aria-label', 'Question ' + n);
    ['A','B','C','D'].forEach(function(L){
      var b = el('button', 'opt'); b.type = 'button'; b.dataset.q = n; b.dataset.l = L;
      b.appendChild(el('b', null, L)); b.appendChild(document.createTextNode(it.options[L]));
      b.setAttribute('aria-pressed', S.ans[id(n)] === L ? 'true' : 'false');
      b.addEventListener('click', function(){
        if(S.key) return;
        S.ans[id(n)] = L; save();
        Array.prototype.forEach.call(ch.children, function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); x.classList.remove('right','wrong'); });
        var sl = document.getElementById('g-' + n); sl.textContent = it.options[L]; sl.classList.remove('m0','m1','m2');
        document.getElementById('score').textContent = '';
      });
      ch.appendChild(b);
    });
    row.appendChild(ch); wrap.appendChild(row);
  });
  return wrap;
}

function kSentence(p, gapped, node){
  var bits = gapped.split(KGAP);
  if(bits[0] && bits[0].trim()) p.appendChild(document.createTextNode(bits[0].replace(/\s+$/, '') + ' '));
  p.appendChild(node);
  if(bits[1] && bits[1].trim()){ var tail = bits[1].replace(/^\s+/, ''); p.appendChild(document.createTextNode((/^[,.;:?!]/.test(tail) ? '' : ' ') + tail)); }
}
function keyBox(w){ var k = el('div', 'key'); k.appendChild(el('span', 'sr', 'Key word: ')); k.appendChild(document.createTextNode(w)); return k; }

function part4(p){
  var d = el('div');
  var r = el('div', 'rubric'), rp = el('p');
  rp.appendChild(document.createTextNode('For questions ' + qrange(p, 25, 30) + ', complete the second sentence so that it has a similar meaning to the first sentence, using the word given. '));
  rp.appendChild(el('b', null, 'Do not change the word given. '));
  rp.appendChild(document.createTextNode('You must use between ' + LV.k4 + ' words, including the word given. Here is an example (0).'));
  r.appendChild(rp); d.appendChild(r);
  var ex = p.example || {lead:'Nobody told me about the party until yesterday.', key:'FOUND', gapped:'I only ___ the party yesterday.', answer:'found out | about'};
  var q0 = el('div', 'q'); q0.appendChild(el('div', 'no', '0')); var b0 = el('div', 'body');
  b0.appendChild(el('p', 'first', ex.lead)); b0.appendChild(keyBox(ex.key));
  var s0 = el('p', 'second'); kSentence(s0, ex.gapped, el('span', 'eg', plainK(ex.answer))); b0.appendChild(s0); q0.appendChild(b0); d.appendChild(q0);
  p.items.forEach(function(it){
    var n = String(it.q), q = el('div', 'q'); q.id = 'q-' + n; q.appendChild(el('div', 'no', n));
    var b = el('div', 'body'); b.appendChild(el('p', 'first', it.lead)); b.appendChild(keyBox(it.key));
    var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'gap wide'; inp.id = 'g-' + n; inp.value = S.ans[id(n)] || '';
    inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('aria-label', 'Question ' + n + ', your answer');
    inp.setAttribute('aria-describedby', 'fb-' + n);
    inp.addEventListener('input', function(){ fitGap(inp); S.ans[id(n)] = inp.value; save(); inp.classList.remove('m0','m1','m2'); var f = document.getElementById('fb-' + n); f.textContent = ''; f.className = 'fb'; document.getElementById('score').textContent = ''; });
    var s = el('p', 'second'); kSentence(s, it.gapped, inp); b.appendChild(s);
    var fb = el('p', 'fb'); fb.id = 'fb-' + n; b.appendChild(fb);
    q.appendChild(b); d.appendChild(q);
  });
  return d;
}

function render(){
  var t = cur(), paper = document.getElementById('paper'); paper.textContent = '';
  parts(t).forEach(function(pk, i){
    var p = t[pk], sh = el('article', 'sheet'); sh.setAttribute('aria-label', NAMES[pk]);
    if(i === 0) sh.appendChild(brandTop());
    var h = head(i === 0 ? (DATA.title || 'Reading and Use of English') + ', ' + NAMES[pk] : NAMES[pk], subline(), i === 0 ? 'h1' : 'h2');
    if(i === 0){ h.firstChild.id = 'paper-title'; h.firstChild.tabIndex = -1; }
    sh.appendChild(h);
    if(pk === 'part4'){ sh.appendChild(part4(p)); }
    else {
      var r = el('div', 'rubric'); r.appendChild(el('p', null, RUB[pk].replace(/^For questions \d+ to \d+/, 'For questions ' + qrange(p)))); sh.appendChild(r);
      var e = exampleLine(pk, p); if(e) sh.appendChild(e);
      if(p.title) sh.appendChild(el('p', 'ttl', p.title));
      sh.appendChild(passage(pk, p));
      if(pk === 'part1') sh.appendChild(options(p));
    }
    var row = el('div', 'prow'), pb = el('button', 'btn main pcheck', 'Check ' + NAMES[pk]); pb.type = 'button';
    pb.addEventListener('click', function(){ checkPart(pk); });
    var ps = el('p', 'pscore'); ps.id = 'ps-' + pk; ps.setAttribute('aria-live', 'polite');
    row.appendChild(pb); row.appendChild(ps); sh.appendChild(row);
    var ex = document.createElement('details'); ex.className = 'exps'; ex.id = 'ex-' + pk; ex.hidden = true; sh.appendChild(ex);
    sh.appendChild(sheetFoot());
    paper.appendChild(sh);
  });
  renderKey();
  document.getElementById('score').textContent = '';
  syncBar();
}

function renderKey(){
  var t = cur(), k = document.getElementById('keysheet'); k.textContent = '';
  k.appendChild(head('Answer key', subline()));
  parts(t).forEach(function(pk){
    var p = t[pk]; k.appendChild(el('h3', null, NAMES[pk]));
    var ol = el('ol', pk === 'part4' ? 'k4' : null);
    p.items.forEach(function(it){
      var li = el('li'); li.appendChild(el('div', 'no', String(it.q)));
      var b = el('div'), a = el('div', 'a');
      if(pk === 'part1') a.textContent = it.answer + '  ' + it.options[it.answer];
      else if(pk === 'part4'){ var h = it.answer.split('|'); a.appendChild(document.createTextNode(h[0].trim())); if(h[1]){ a.appendChild(el('span', 'bar2', '|')); a.appendChild(document.createTextNode(h[1].trim())); } }
      else a.textContent = list(it.answer).join(' / ');
      b.appendChild(a);
      if(pk === 'part4' && it.alts && it.alts.length) b.appendChild(el('div', 'alt', 'Also accepted: ' + it.alts.map(plainK).join('; ')));
      if(it.explain) b.appendChild(rich('div', 'kx', it.explain));
      if(it.tests) b.appendChild(el('div', 'm', 'Tests: ' + it.tests));
      if(it.why) b.appendChild(el('div', 'm', 'Why not the others: ' + it.why));
      li.appendChild(b); ol.appendChild(li);
    });
    k.appendChild(ol);
  });
  k.appendChild(sheetFoot());
  k.hidden = !(S.key || DATA.pdf);
  var sk = document.getElementById('showkey'); sk.setAttribute('aria-expanded', S.key); sk.textContent = S.key ? 'Hide answers' : 'Show answers';
  fill();
}

/* Show answers puts each answer in its gap; Hide answers gives the student's own work back. */
function fill(){
  var t = cur();
  parts(t).forEach(function(pk){
    t[pk].items.forEach(function(it){
      var n = String(it.q), g = document.getElementById('g-' + n); if(!g) return;
      g.classList.remove('m0','m1','m2');
      if(pk === 'part1'){
        g.textContent = S.key ? it.options[it.answer] : (S.ans[id(n)] ? it.options[S.ans[id(n)]] : '');
        g.classList.toggle('shown', S.key);
        Array.prototype.forEach.call(document.querySelectorAll('.opt[data-q="' + n + '"]'), function(b){
          b.classList.remove('right','wrong'); b.disabled = S.key;
          b.setAttribute('aria-pressed', S.key ? (b.dataset.l === it.answer ? 'true' : 'false') : (S.ans[id(n)] === b.dataset.l ? 'true' : 'false'));
        });
      } else {
        g.value = S.key ? (pk === 'part4' ? plainK(it.answer) : list(it.answer)[0]) : (S.ans[id(n)] || '');
        g.readOnly = S.key; g.classList.toggle('shown', S.key); fitGap(g);
        if(pk === 'part4'){ var f = document.getElementById('fb-' + n); f.textContent = ''; f.className = 'fb'; }
      }
    });
    var ps = document.getElementById('ps-' + pk); if(ps) ps.textContent = '';
    var ex = document.getElementById('ex-' + pk); if(ex){ ex.hidden = true; ex.textContent = ''; }
  });
  if(S.key) document.getElementById('score').textContent = '';
  document.getElementById('check').disabled = S.key;
  Array.prototype.forEach.call(document.querySelectorAll('.pcheck'), function(b){ b.disabled = S.key; });
}

function checkPart(pk){
    var t = cur(), sub = 0, pm = 0, marks = [];
    t[pk].items.forEach(function(it){
      var n = String(it.q), g = document.getElementById('g-' + n), v = S.ans[id(n)] || '', m;
      if(pk === 'part1'){
        m = v === it.answer ? 1 : 0; pm += 1;
        Array.prototype.forEach.call(document.querySelectorAll('.opt[data-q="' + n + '"]'), function(b){
          b.classList.remove('right','wrong');
          if(b.dataset.l === it.answer) b.classList.add('right'); else if(b.dataset.l === v) b.classList.add('wrong');
        });
        g.classList.remove('m0','m1','m2'); g.classList.add(m ? 'm2' : 'm0');
      } else if(pk === 'part4'){
        m = markK(it, v); pm += 2;
        g.classList.remove('m0','m1','m2'); g.classList.add('m' + m);
        var f = document.getElementById('fb-' + n); f.className = 'fb m' + m + 'c';
        f.textContent = m === 2 ? 'Correct. 2 marks' : ((v.trim() ? (m === 1 ? '1 mark out of 2. ' : 'Not quite. ') : 'No answer. ') + 'Answer: ' + plainK(it.answer));
      } else {
        m = markWord(it, v); pm += 1;
        g.classList.remove('m0','m1','m2'); g.classList.add(m ? 'm2' : 'm0');
        g.title = m ? 'Correct' : 'Answer: ' + list(it.answer).join(' / ');
      }
      sub += m;
      marks.push({v: v, full: pk === 'part4' ? m === 2 : m === 1, part: pk === 'part4' && m === 1});
    });
    showExps(pk, marks);
    var ps = document.getElementById('ps-' + pk); if(ps) ps.textContent = 'You scored ' + sub + ' out of ' + pm + '.';
    try{ window.dispatchEvent(new CustomEvent('uoe:part-checked', {detail:{pk:pk, test:cur(), sub:sub, max:pm, marks:marks}})); }catch(e){}
    return [sub, pm];
}
function check(){
  var total = 0, max = 0;
  parts(cur()).forEach(function(pk){ var r = checkPart(pk); total += r[0]; max += r[1]; });
  document.getElementById('score').textContent = 'Whole paper: ' + total + ' out of ' + max + '.';
}

function ansText(pk, it){
  if(pk === 'part1') return it.answer + ' ' + it.options[it.answer];
  if(pk === 'part4') return plainK(it.answer);
  return list(it.answer).join(' / ');
}
function yourText(pk, it, v){
  if(!v) return 'no answer';
  return pk === 'part1' ? v + ' ' + it.options[v] : v;
}
/* After a part is checked: each question with the student's answer, the right one and the explanation, wrong ones marked. */
/* A gap keeps its printed width but grows when the answer in it is longer, so a revealed answer is never cut off. */
function fitGap(g){ g.style.width = ''; if(g.scrollWidth > g.clientWidth + 1) g.style.width = (g.scrollWidth + 14) + 'px'; }
function showExps(pk, marks){
  var t = cur(), box = document.getElementById('ex-' + pk); if(!box) return;
  box.textContent = '';
  var wrong = marks.filter(function(m){ return !m.full; }).length;
  box.appendChild(el('summary', null, 'See explanations for ' + NAMES[pk] + (wrong ? ' (' + wrong + ' to review)' : '')));
  var ol = el('ol');
  t[pk].items.forEach(function(it, i){
    var mk = marks[i], li = el('li'); li.appendChild(el('div', 'no', String(it.q)));
    var b = el('div'), r = el('p', 'res');
    var cls = mk.full ? 'ok' : (mk.part ? 'half' : 'bad');
    r.appendChild(el('span', cls, mk.full ? 'Right: ' : (mk.part ? 'Half right: ' : 'Not right: ')));
    r.appendChild(document.createTextNode(mk.full ? (pk === 'part1' ? ansText(pk, it) : mk.v.trim()) : 'you wrote ' + yourText(pk, it, mk.v) + '. Answer: ' + ansText(pk, it)));
    b.appendChild(r);
    if(it.explain) b.appendChild(rich('p', 'ex', it.explain));
    if(pk === 'part1' && it.why) b.appendChild(el('p', 'm', 'Why not the others: ' + it.why));
    if(pk === 'part4' && it.alts && it.alts.length) b.appendChild(el('p', 'm', 'Also accepted: ' + it.alts.map(plainK).join('; ')));
    li.appendChild(b); ol.appendChild(li);
  });
  box.appendChild(ol); box.hidden = false; box.open = wrong > 0 ? box.open : false;
}

/* Explanations mark key language with **double stars**: shown in a subtle bold, never italic. */
function rich(tag, cls, s){
  var n = el(tag, cls);
  String(s || '').split(/\*\*/).forEach(function(part, i){ if(!part) return; n.appendChild(i % 2 ? el('b', 'kb', part) : document.createTextNode(part)); });
  return n;
}

/* ---- controls ---- */
function syncBar(){
  var bar = document.getElementById('bar'); bar.hidden = DATA.tests.length < 2;
  document.getElementById('test').value = String(S.set);
  document.getElementById('prev').disabled = S.set <= 0;
  document.getElementById('next').disabled = S.set >= DATA.tests.length - 1;
  var few = DATA.tests.length <= 4;
  document.getElementById('tabs').hidden = !few;
  ['pick','prev','next'].forEach(function(x){ document.getElementById(x).hidden = few; });
  Array.prototype.forEach.call(document.querySelectorAll('#tabs .tab'), function(tb, i){ tb.setAttribute('aria-selected', i === S.set ? 'true' : 'false'); });
}
function go(n){ S.set = n; S.key = false; save(); render(); window.scrollTo(0, 0); var h = document.getElementById('paper-title'); if(h) h.focus(); }
(function(){
  var sel = document.getElementById('test'), tabs = document.getElementById('tabs');
  DATA.tests.forEach(function(t, i){
    var o = el('option', null, t.name || ('Test ' + (i + 1))); o.value = String(i); sel.appendChild(o);
    var b = el('button', 'tab', t.name || ('Test ' + (i + 1))); b.type = 'button'; b.setAttribute('role', 'tab'); b.addEventListener('click', function(){ if(i !== S.set) go(i); }); tabs.appendChild(b);
  });
  sel.addEventListener('change', function(){ go(parseInt(sel.value, 10)); });
})();
document.getElementById('prev').addEventListener('click', function(){ if(S.set > 0) go(S.set - 1); });
document.getElementById('next').addEventListener('click', function(){ if(S.set < DATA.tests.length - 1) go(S.set + 1); });
document.getElementById('check').addEventListener('click', check);
document.getElementById('showkey').addEventListener('click', function(){ S.key = !S.key; renderKey(); });
document.getElementById('clear').addEventListener('click', function(){
  var t = cur(); S.key = false;
  parts(t).forEach(function(pk){ t[pk].items.forEach(function(it){ delete S.ans[id(String(it.q))]; }); });
  save(); render();
});
document.getElementById('print').addEventListener('click', function(){ window.print(); });

(function(){ var e = document.getElementById('endbrand'); e.appendChild(photo(48)); var t = el('div'); t.appendChild(logo()); t.appendChild(el('p', null, 'Practice papers by John. More on Instagram at @johnplusenglish.')); e.appendChild(t); e.appendChild(igButton()); })();
if(DATA.pdf){ document.body.classList.add('pdf'); if(DATA.nokey) document.body.classList.add('nokey'); try{ localStorage.removeItem(STORE); }catch(e){} }
else load();
render();
