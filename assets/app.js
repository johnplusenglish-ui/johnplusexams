/* johnplusexams app: sign-in, My papers, the paper reader and My Mistakes.
   With Supabase configured in config.js it uses the real database; without it, it runs a local
   demo that keeps everything in this browser (for previewing before launch). */
(function(){
'use strict';
var CFG = window.JPX || {};
var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname); /* a local preview always runs the demo */
var LIVE = !LOCAL && !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
var sb = LIVE ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
var PAGE = document.body.getAttribute('data-page') || (document.getElementById('paper') ? 'app-paper' : '');
/* One entry per level on sale. The key is the pack: paper ids start with it ('c1-01') and the PDFs sit in its folder. */
var PACKS = {
  b2: {name: 'B2 First · Use of English', short: 'B2 Use of English', level: 'B2', page: '/pricing/', products: ['b2']},
  c1: {name: 'C1 Advanced · Use of English', short: 'C1 Use of English', level: 'C1', page: '/c1-use-of-english/', products: ['c1', 'c1-student', 'c1-teacher']},
  c2: {name: 'C2 Proficiency · Use of English', short: 'C2 Use of English', level: 'C2', page: '/pricing/', products: ['c2']}
};
/* b2 and c2 are not on sale yet: their sections only show for someone given access by hand. Point page at the level page once it exists. */

function $(id){ return document.getElementById(id); }
function el(t, c, x){ var n = document.createElement(t); if(c) n.className = c; if(x != null) n.textContent = x; return n; }
function qs(k){ return new URLSearchParams(location.search).get(k); }
function showDemo(){ var d = $('demo-note'); if(d && !LIVE) d.hidden = false; }

/* ---------- data layer ---------- */
var LS = {
  get: function(k, d){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set: function(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
var Demo = {
  user: function(){ return Promise.resolve(LS.get('jpx-demo-user', null)); },
  signIn: function(email){ LS.set('jpx-demo-user', {email: email, id: 'demo'}); return Promise.resolve({demo: true}); },
  signOut: function(){ try{ localStorage.removeItem('jpx-demo-user'); }catch(e){} return Promise.resolve(); },
  entitlements: function(){
    var exp = new Date(Date.now() + 365 * 864e5).toISOString();
    return Promise.resolve(Object.keys(PACKS).map(function(p){ return {product: p, expires_at: exp}; }));
  },
  index: function(pack){ return fetch('/private-demo/' + pack + '-index.json').then(function(r){ if(!r.ok) throw 0; return r.json(); }).catch(function(){ return []; }); },
  paper: function(id){ return fetch('/private-demo/' + id + '.json').then(function(r){ if(!r.ok) throw new Error('missing'); return r.json(); }); },
  attempts: function(){ return Promise.resolve(LS.get('jpx-demo-attempts', [])); },
  saveAttempt: function(a){ var l = LS.get('jpx-demo-attempts', []); a.created_at = new Date().toISOString(); l.push(a); LS.set('jpx-demo-attempts', l); return Promise.resolve(); },
  mistakes: function(){ return Promise.resolve(LS.get('jpx-demo-mistakes', []).filter(function(m){ return !m.resolved; })); },
  allMistakes: function(){ return Promise.resolve(LS.get('jpx-demo-mistakes', [])); },
  saveMarks: function(paperId, rows){
    var l = LS.get('jpx-demo-mistakes', []);
    rows.forEach(function(r){
      var m = l.find(function(x){ return x.paper_id === paperId && x.q === r.q; });
      if(r.ok){ if(m) m.resolved = true; return; }
      if(m){ m.given = r.given; m.part = r.part; m.resolved = false; m.updated_at = new Date().toISOString(); }
      else l.push({paper_id: paperId, part: r.part, q: r.q, given: r.given, resolved: false, updated_at: new Date().toISOString()});
    });
    LS.set('jpx-demo-mistakes', l); return Promise.resolve();
  },
  resolve: function(paperId, q){ var l = LS.get('jpx-demo-mistakes', []); l.forEach(function(m){ if(m.paper_id === paperId && m.q === q) m.resolved = true; }); LS.set('jpx-demo-mistakes', l); return Promise.resolve(); },
  pdf: function(path){ return Promise.resolve('/private-demo/pdf/' + path.split('/').pop()); }
};
var Live = {
  user: function(){ return sb.auth.getSession().then(function(r){ var s = r.data && r.data.session; return s ? {email: s.user.email, id: s.user.id} : null; }); },
  signIn: function(email){ return sb.auth.signInWithOtp({email: email, options: {emailRedirectTo: location.origin + '/app/'}}).then(function(r){ if(r.error) throw r.error; return r; }); },
  signOut: function(){ return sb.auth.signOut(); },
  entitlements: function(){ return sb.from('entitlements').select('product,expires_at').gt('expires_at', new Date().toISOString()).then(function(r){ if(r.error) throw r.error; return r.data; }); },
  index: function(pack){ return sb.from('paper_index').select('id,title,topics,sort,pdf_student,pdf_teacher').eq('pack', pack).order('sort').then(function(r){ if(r.error) throw r.error; return r.data; }); },
  paper: function(id){ return sb.from('papers').select('data').eq('id', id).maybeSingle().then(function(r){ if(r.error) throw r.error; if(!r.data) throw new Error('locked'); return r.data.data; }); },
  attempts: function(){ return sb.from('attempts').select('paper_id,part,score,max,created_at').order('created_at').then(function(r){ if(r.error) throw r.error; return r.data; }); },
  saveAttempt: function(a){ return Live.user().then(function(u){ a.user_id = u.id; return sb.from('attempts').insert(a); }); },
  allMistakes: function(){ return sb.from('mistakes').select('paper_id,part,q,given,resolved,updated_at').order('updated_at', {ascending: false}).then(function(r){ if(r.error) throw r.error; return r.data; }); },
  mistakes: function(){ return sb.from('mistakes').select('paper_id,part,q,given,updated_at').eq('resolved', false).order('updated_at', {ascending: false}).then(function(r){ if(r.error) throw r.error; return r.data; }); },
  saveMarks: function(paperId, rows){
    return Live.user().then(function(u){
      var wrong = rows.filter(function(r){ return !r.ok; }).map(function(r){ return {user_id: u.id, paper_id: paperId, part: r.part, q: r.q, given: r.given, resolved: false, updated_at: new Date().toISOString()}; });
      var right = rows.filter(function(r){ return r.ok; }).map(function(r){ return r.q; });
      var jobs = [];
      if(wrong.length) jobs.push(sb.from('mistakes').upsert(wrong, {onConflict: 'user_id,paper_id,q'}));
      if(right.length) jobs.push(sb.from('mistakes').update({resolved: true}).eq('paper_id', paperId).in('q', right));
      return Promise.all(jobs);
    });
  },
  resolve: function(paperId, q){ return sb.from('mistakes').update({resolved: true}).eq('paper_id', paperId).eq('q', q); },
  pdf: function(path){ return sb.storage.from('pdfs').createSignedUrl(path, 3600).then(function(r){ if(r.error) throw r.error; return r.data.signedUrl; }); }
};
var DB = LIVE ? Live : Demo;

function access(ents){
  var a = {};
  ents.forEach(function(e){
    Object.keys(PACKS).forEach(function(p){
      if(PACKS[p].products.indexOf(e.product) >= 0){
        a[p] = a[p] || {expires: e.expires_at};
        if(e.expires_at > a[p].expires) a[p].expires = e.expires_at;
      }
    });
  });
  return a;
}
function fmtDate(s){ try{ return new Date(s).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}); }catch(e){ return s; } }
function packOf(id){ return (id || '').split('-')[0]; }

/* ---------- sign in ---------- */
function showSignIn(){
  $('signin').hidden = false; var dash = $('dash'); if(dash) dash.hidden = true;
  var f = $('signin-form'), msg = $('signin-msg');
  f.addEventListener('submit', function(e){
    e.preventDefault();
    var email = $('email').value.trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg.hidden = false; msg.className = 'msg err'; msg.textContent = 'Check the email address and try again.'; $('email').focus(); return; }
    $('signin-btn').disabled = true;
    DB.signIn(email).then(function(r){
      if(r && r.demo){ location.reload(); return; }
      msg.hidden = false; msg.className = 'msg ok'; msg.textContent = 'Check your inbox: we sent a sign-in link to ' + email + '. It works once and opens your papers here.';
    }).catch(function(err){
      msg.hidden = false; msg.className = 'msg err'; msg.textContent = 'We could not send the link (' + ((err && err.message) || 'unknown error') + '). Wait a minute and try again.';
    }).then(function(){ $('signin-btn').disabled = false; });
  });
}

/* ---------- dashboard ---------- */
function best(attempts){
  var b = {};
  attempts.forEach(function(a){
    var k = a.paper_id + '|' + a.part;
    if(!b[k] || a.score / a.max > b[k].score / b[k].max) b[k] = a;
  });
  return b;
}
var PKS = ['part1', 'part2', 'part3', 'part4'];
var PARTNAMES = {part1: 'Multiple-choice cloze', part2: 'Open cloze', part3: 'Word formation', part4: 'Key word transformations'};
function pct(s, m){ return m ? Math.round(100 * s / m) : 0; }
/* Everything My papers shows for one level, worked out from the best attempt at each part. */
function summarise(pack, list, bp, all){
  var S = {pack: pack, papers: [], done: 0, started: 0, score: 0, max: 0, parts: {}, open: 0, fixed: 0, openBy: {part1: 0, part2: 0, part3: 0, part4: 0}};
  PKS.forEach(function(pk){ S.parts[pk] = {score: 0, max: 0, n: 0}; });
  list.forEach(function(p, i){
    var P = {row: p, n: i + 1, score: 0, max: 0, nparts: 0, parts: {}};
    PKS.forEach(function(pk){
      var x = bp[p.id + '|' + pk]; if(!x) return;
      P.parts[pk] = x; P.score += x.score; P.max += x.max; P.nparts++;
      S.parts[pk].score += x.score; S.parts[pk].max += x.max; S.parts[pk].n++;
    });
    if(P.nparts){ S.started++; S.score += P.score; S.max += P.max; }
    if(P.nparts === 4) S.done++;
    S.papers.push(P);
  });
  all.forEach(function(m){ if(packOf(m.paper_id) !== pack) return; if(m.resolved) S.fixed++; else { S.open++; if(S.openBy[m.part] != null) S.openBy[m.part]++; } });
  var tried = PKS.filter(function(pk){ return S.parts[pk].n; });
  S.weak = tried.length > 1 ? tried.slice().sort(function(x, y){ return S.parts[x].score / S.parts[x].max - S.parts[y].score / S.parts[y].max; })[0] : null;
  if(S.weak && pct(S.parts[S.weak].score, S.parts[S.weak].max) === 100) S.weak = null;
  return S;
}
/* ---------- Progress: one results sheet. Ink on paper, hairline rules, one blue for "you are here". ---------- */
var SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, at){ var e = document.createElementNS(SVGNS, tag); for(var k in at) e.setAttribute(k, at[k]); return e; }
var pgTip = null;
function tipShow(title, lines, x, y){
  if(!pgTip){ pgTip = el('div'); pgTip.id = 'pg-tip'; pgTip.hidden = true; document.body.appendChild(pgTip); window.addEventListener('scroll', tipHide, true); }
  pgTip.textContent = ''; pgTip.appendChild(el('b', null, title)); lines.forEach(function(l){ pgTip.appendChild(el('span', null, l)); });
  pgTip.hidden = false;
  var w = pgTip.offsetWidth, h = pgTip.offsetHeight;
  pgTip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
  pgTip.style.top = (y - h - 12 < 8 ? y + 16 : y - h - 12) + 'px';
}
function tipHide(){ if(pgTip) pgTip.hidden = true; }
function bindTip(node, title, lines){
  function on(){ var b = node.getBoundingClientRect(); tipShow(title, lines, b.left + b.width / 2, b.top); }
  node.addEventListener('pointerenter', on); node.addEventListener('focus', on);
  node.addEventListener('pointerleave', tipHide); node.addEventListener('blur', tipHide);
}
var PASS = 60; /* roughly the pass level, as a percentage */
function heatStep(v){ return v < 50 ? 1 : v < 65 ? 2 : v < 80 ? 3 : v < 90 ? 4 : 5; }
function paperHref(P){ return '/app/paper.html?id=' + encodeURIComponent(P.row.id); }
function dayKey(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function pgSec(cls, title, sub){
  var s = el('section', 'pg-sec' + (cls ? ' ' + cls : '')), h = el('div', 'pg-h');
  s.setAttribute('aria-label', title); h.appendChild(el('h3', null, title)); if(sub) h.appendChild(el('span', null, sub)); s.appendChild(h);
  return s;
}

/* Up next: the one thing to do now. */
function pgNext(S){
  var c = el('section', 'pg-next'); c.setAttribute('aria-label', 'Up next');
  var P = S.papers.filter(function(x){ return x.nparts < 4; })[0], t = el('div', 'pg-next-t'), a = el('a', 'btn main');
  t.appendChild(el('span', 'pg-lab', 'Up next'));
  if(P){
    var miss = PKS.filter(function(pk){ return !P.parts[pk]; })[0];
    t.appendChild(el('h3', null, 'Paper ' + P.n + ' · ' + P.row.title));
    t.appendChild(el('p', null, P.nparts ? P.nparts + ' of 4 parts checked. Part ' + (PKS.indexOf(miss) + 1) + ' is next.' : 'Not started yet. Four parts, 30 questions.'));
    a.textContent = P.nparts ? 'Continue paper ' + P.n : 'Start paper ' + P.n; a.href = paperHref(P);
  } else {
    var low = S.papers.slice().sort(function(x, y){ return x.score / x.max - y.score / y.max; })[0];
    t.appendChild(el('h3', null, 'All papers finished'));
    t.appendChild(el('p', null, 'Your lowest score is Paper ' + low.n + ', ' + pct(low.score, low.max) + '%. Try it again to beat it.'));
    a.textContent = 'Open paper ' + low.n; a.href = paperHref(low);
  }
  c.appendChild(t); c.appendChild(a);
  return c;
}
/* The headline: average score on a 0 to 100 ruler, beside the score for each finished paper. */
function pgTop(S, fin, sc){
  var top = el('div', 'pg-top'), l = el('div', 'pg-score'), avg = S.max ? pct(S.score, S.max) : null;
  l.appendChild(el('span', 'pg-lab', 'Average score'));
  var big = el('p', 'pg-big');
  if(avg == null) big.appendChild(el('strong', null, 'No score yet'));
  else { big.appendChild(el('b', 'num', String(avg))); big.appendChild(el('span', null, '%')); }
  l.appendChild(big);
  var r = el('div', 'pg-ruler'); r.setAttribute('aria-hidden', 'true');
  var pass = el('i', 'pass'); pass.style.left = PASS + '%'; r.appendChild(pass);
  if(avg != null){ var me = el('i', 'me'); me.style.left = avg + '%'; r.appendChild(me); }
  [['0', 0], ['Pass ' + PASS, PASS], ['100', 100]].forEach(function(x){ var s = el('span', x[1] === 0 ? 'a' : x[1] === 100 ? 'z' : null, x[0]); s.style.left = x[1] + '%'; r.appendChild(s); });
  l.appendChild(r);
  var dl = el('p', 'pg-delta'), h = Math.min(5, Math.floor(sc.length / 2));
  if(h >= 1){
    var sum = function(a){ return a.reduce(function(x, y){ return x + y; }, 0); };
    var df = Math.round(sum(sc.slice(-h)) / h - sum(sc.slice(0, h)) / h), since = h === 1 ? ' since your first paper' : ' since your first ' + h + ' papers';
    dl.appendChild(el('b', df < 0 ? 'down' : null, df > 0 ? 'Up ' + df + (df === 1 ? ' point' : ' points') : df < 0 ? 'Down ' + (-df) + (df === -1 ? ' point' : ' points') : 'No change'));
    dl.appendChild(document.createTextNode(since + '.'));
  } else dl.textContent = S.max ? 'Across the parts you have checked so far.' : 'Check a part of any paper and your score shows here.';
  l.appendChild(dl); top.appendChild(l);
  var c = el('div', 'pg-chart'), hd = el('div', 'pg-h'); hd.appendChild(el('h3', null, 'Score by paper')); hd.appendChild(el('span', null, 'Finished papers, best attempt')); c.appendChild(hd);
  var tr = el('div', 'pg-trend'); c.appendChild(tr); top.appendChild(c);
  if(!fin.length){ tr.appendChild(el('p', 'pg-none', S.started ? 'Finish all four parts of a paper and it shows here.' : 'Each paper you finish adds a point to this graph.')); return top; }
  var lastW = 0;
  if(window.ResizeObserver) new ResizeObserver(function(){ var w = tr.clientWidth; if(w && Math.abs(w - lastW) > 1){ lastW = w; drawTrend(tr, S, fin); } }).observe(tr);
  else setTimeout(function(){ drawTrend(tr, S, fin); }, 0);
  return top;
}
function drawTrend(box, S, fin){
  box.textContent = '';
  var W = Math.max(280, box.clientWidth), H = 230, l = 30, rt = 16, t = 24, b = 28, n = S.papers.length;
  var INK = '#0B0D12', SOFT = '#6B7185', RULE = '#E3E6EC', SKY = '#2176FF';
  var pts = fin.map(function(P){ return {P: P, v: pct(P.score, P.max)}; });
  var lo = Math.min(40, Math.floor(Math.min.apply(null, pts.map(function(q){ return q.v; })) / 20) * 20);
  function X(i){ return l + (n === 1 ? (W - l - rt) / 2 : (i - 1) * (W - l - rt) / (n - 1)); }
  function Y(v){ return t + (100 - v) * (H - t - b) / (100 - lo); }
  var s = svgEl('svg', {viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Score for each finished paper: ' + pts.map(function(q){ return 'Paper ' + q.P.n + ' ' + q.v + '%'; }).join(', ')});
  function txt(x, y, a, v, at){ var e = svgEl('text', Object.assign({x: x, y: y, 'text-anchor': a, fill: SOFT, 'font-size': 11.5, 'font-family': 'Inter,sans-serif'}, at || {})); e.textContent = v; s.appendChild(e); return e; }
  for(var v = lo; v <= 100; v += 20){ s.appendChild(svgEl('line', {x1: l, x2: W - rt, y1: Y(v), y2: Y(v), stroke: v === lo ? INK : RULE, 'stroke-width': 1})); txt(l - 8, Y(v) + 4, 'end', v); }
  if(lo < PASS){ s.appendChild(svgEl('line', {x1: l, x2: W - rt, y1: Y(PASS), y2: Y(PASS), stroke: SOFT, 'stroke-width': 1, 'stroke-dasharray': '2 4'})); txt(W - rt, Y(PASS) + 14, 'end', 'Pass, about ' + PASS + '%'); }
  var every = n > 24 ? 4 : n > 12 ? 2 : 1;
  for(var i = 1; i <= n; i += every) txt(X(i), H - 8, 'middle', i);
  var d = pts.map(function(q, i){ return (i ? 'L' : 'M') + X(q.P.n).toFixed(1) + ' ' + Y(q.v).toFixed(1); }).join(' '), last = pts[pts.length - 1];
  if(pts.length > 1) s.appendChild(svgEl('path', {d: d, fill: 'none', stroke: INK, 'stroke-width': 1.75, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1, 'class': 'pg-tline'}));
  pts.forEach(function(q){ if(q !== last) s.appendChild(svgEl('circle', {cx: X(q.P.n), cy: Y(q.v), r: 3, fill: '#fff', stroke: INK, 'stroke-width': 1.75})); });
  s.appendChild(svgEl('circle', {cx: X(last.P.n), cy: Y(last.v), r: 5.5, fill: SKY, stroke: '#fff', 'stroke-width': 2}));
  txt(Math.max(l + 14, Math.min(X(last.P.n), W - rt - 14)), Y(last.v) - 13, 'middle', last.v + '%', {fill: INK, 'font-size': 13, 'font-weight': 600, 'font-family': 'Outfit,sans-serif'});
  var cross = svgEl('line', {y1: t, y2: H - b, stroke: INK, 'stroke-width': 1, visibility: 'hidden'}), hot = svgEl('circle', {r: 5.5, fill: SKY, stroke: '#fff', 'stroke-width': 2, visibility: 'hidden'});
  s.appendChild(cross); s.appendChild(hot);
  var hit = svgEl('rect', {x: l - 10, y: 0, width: W - l - rt + 20, height: H - b, fill: 'transparent'}); hit.style.cursor = 'pointer'; s.appendChild(hit);
  function near(e){ var bb = s.getBoundingClientRect(), mx = (e.clientX - bb.left) * W / bb.width, q0 = pts[0]; pts.forEach(function(q){ if(Math.abs(X(q.P.n) - mx) < Math.abs(X(q0.P.n) - mx)) q0 = q; }); return {q: q0, bb: bb}; }
  hit.addEventListener('pointermove', function(e){
    var r = near(e), q = r.q, bb = r.bb;
    cross.setAttribute('x1', X(q.P.n)); cross.setAttribute('x2', X(q.P.n)); cross.setAttribute('visibility', 'visible');
    hot.setAttribute('cx', X(q.P.n)); hot.setAttribute('cy', Y(q.v)); hot.setAttribute('visibility', 'visible');
    tipShow('Paper ' + q.P.n + ' · ' + q.v + '%', [q.P.row.title, q.P.score + ' of ' + q.P.max + ' marks'], bb.left + X(q.P.n) * bb.width / W, bb.top + Y(q.v) * bb.height / H);
  });
  hit.addEventListener('pointerleave', function(){ cross.setAttribute('visibility', 'hidden'); hot.setAttribute('visibility', 'hidden'); tipHide(); });
  hit.addEventListener('click', function(e){ location.href = paperHref(near(e).q.P); });
  box.appendChild(s);
}
function pgFacts(S, fin, sc, streak){
  var dl = el('dl', 'pg-facts'), bi = sc.length ? sc.indexOf(Math.max.apply(null, sc)) : -1;
  [['Papers finished', String(S.done), 'of ' + S.papers.length], ['Marks earned', String(S.score), 'of ' + S.max], ['Best paper', bi < 0 ? 'None yet' : sc[bi] + '%', bi < 0 ? '' : 'Paper ' + fin[bi].n], ['Day streak', String(streak), streak === 1 ? 'day' : 'days']].forEach(function(f){
    var d = el('div'); d.appendChild(el('dt', null, f[0])); var dd = el('dd'); dd.appendChild(el('b', 'num', f[1])); if(f[2]) dd.appendChild(el('span', null, f[2])); d.appendChild(dd); dl.appendChild(d);
  });
  return dl;
}
function pgSpark(vals){
  var s = svgEl('svg', {viewBox: '0 0 84 30', 'class': 'pg-spark', 'aria-hidden': 'true'});
  if(vals.length < 2) return s;
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if(hi === lo){ lo -= 1; hi += 1; }
  function Y(v){ return 25 - (v - lo) * 20 / (hi - lo); }
  s.appendChild(svgEl('path', {d: vals.map(function(v, i){ return (i ? 'L' : 'M') + (4 + i * 74 / (vals.length - 1)).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' '), fill: 'none', stroke: '#0B0D12', 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'}));
  s.appendChild(svgEl('circle', {cx: 78, cy: Y(vals[vals.length - 1]), r: 3, fill: '#2176FF', stroke: '#fff', 'stroke-width': 1.5}));
  return s;
}
function pgParts(S){
  var c = pgSec('pg-parts', 'Score by part', 'The mark on each bar is ' + PASS + '%, roughly the pass level');
  PKS.forEach(function(pk, j){
    var x = S.parts[pk], row = el('div', 'pg-part'), lab = el('div', 'pg-plab'), v = pct(x.score, x.max);
    lab.appendChild(el('b', null, 'Part ' + (j + 1))); lab.appendChild(el('span', null, PARTNAMES[pk]));
    if(S.weak === pk) lab.appendChild(el('span', 'chip some', 'Work on this first'));
    row.appendChild(lab);
    var tr = el('div', 'pg-track'), f = el('i'); f.style.width = (x.n ? Math.max(v, 1) : 0) + '%'; tr.appendChild(f); tr.appendChild(el('u')); row.appendChild(tr);
    row.appendChild(pgSpark(S.papers.filter(function(P){ return P.parts[pk]; }).map(function(P){ return pct(P.parts[pk].score, P.parts[pk].max); })));
    var pv = el('div', 'pg-pval');
    if(x.n){ pv.appendChild(el('b', 'num', v + '%')); pv.appendChild(el('span', 'num', x.score + ' of ' + x.max)); } else pv.appendChild(el('span', null, 'Not tried'));
    row.appendChild(pv);
    row.title = x.n ? x.score + ' out of ' + x.max + ' marks, from ' + x.n + (x.n === 1 ? ' paper' : ' papers') : 'Not tried yet';
    c.appendChild(row);
  });
  return c;
}
function pgMistakes(S){
  var tot = S.open + S.fixed, c = pgSec('pg-mk', 'My Mistakes', tot ? S.fixed + ' of ' + tot + ' fixed' : '');
  var top = el('p', 'pg-mk-n'); top.appendChild(el('b', 'num', String(S.open))); top.appendChild(el('span', null, 'still to fix')); c.appendChild(top);
  var ul = el('ul', 'pg-mlist');
  PKS.forEach(function(pk, j){ var li = el('li'); li.appendChild(el('span', null, 'Part ' + (j + 1) + ' · ' + PARTNAMES[pk])); li.appendChild(el('b', 'num', String(S.openBy[pk]))); ul.appendChild(li); });
  c.appendChild(ul);
  var go = el('a', 'btn', S.open ? 'Practise my mistakes' : 'Open My Mistakes'); go.href = '/app/mistakes.html?level=' + S.pack; c.appendChild(go);
  return c;
}
function pgLegend(items){
  var lg = el('div', 'pg-legend');
  items.forEach(function(k){ var s = el('span'); s.appendChild(el('i', k[0])); s.appendChild(document.createTextNode(k[1])); lg.appendChild(s); });
  return lg;
}
function pgHeat(S){
  var c = pgSec('pg-heatsec', 'Every paper, every part', 'Darker means a higher score');
  var sc = el('div', 'pg-scroll'), g = el('div', 'pg-heat'), n = S.papers.length;
  g.style.gridTemplateColumns = '52px repeat(' + n + ',minmax(26px,1fr))'; g.style.minWidth = (52 + n * 29) + 'px';
  g.appendChild(el('span'));
  S.papers.forEach(function(P){ g.appendChild(el('span', 'hx num', String(P.n))); });
  PKS.forEach(function(pk, j){
    g.appendChild(el('span', 'hy', 'Part ' + (j + 1)));
    S.papers.forEach(function(P){
      var x = P.parts[pk], v = x ? pct(x.score, x.max) : 0, a = el('a', 'pg-cell' + (x ? ' g' + heatStep(v) : ' none')); a.href = paperHref(P);
      var res = x ? x.score + ' of ' + x.max + ' (' + v + '%)' : 'Not tried yet';
      a.setAttribute('aria-label', 'Paper ' + P.n + ', Part ' + (j + 1) + ': ' + res);
      bindTip(a, 'Paper ' + P.n + ' · Part ' + (j + 1), [P.row.title, res]);
      g.appendChild(a);
    });
  });
  sc.appendChild(g); c.appendChild(sc);
  c.appendChild(pgLegend([['g1', 'Under 50%'], ['g2', '50 to 64%'], ['g3', '65 to 79%'], ['g4', '80 to 89%'], ['g5', '90% or more'], ['none', 'Not tried yet']]));
  return c;
}
/* Every part checked in this level, by day. Returns the tally for the last 12 weeks and the current streak. */
function practice(S, attempts){
  var per = {}, today = new Date(); today.setHours(0, 0, 0, 0);
  attempts.forEach(function(a){ if(!a.created_at || packOf(a.paper_id) !== S.pack) return; var k = dayKey(new Date(a.created_at)); per[k] = (per[k] || 0) + 1; });
  var streak = 0, s = new Date(today);
  if(!per[dayKey(s)]) s.setDate(s.getDate() - 1);
  while(per[dayKey(s)]){ streak++; s.setDate(s.getDate() - 1); }
  return {per: per, today: today, streak: streak};
}
function pgDays(S, A){
  var c = pgSec('pg-days', 'Practice days', 'Last 12 weeks, Monday to Sunday');
  var start = new Date(A.today); start.setDate(A.today.getDate() - ((A.today.getDay() + 6) % 7) - 77);
  var cal = el('div', 'pg-cal'), parts = 0, days = 0;
  for(var d = new Date(start), i = 0; i < 84; i++, d.setDate(d.getDate() + 1)){
    var v = A.per[dayKey(d)] || 0, cell = el('i');
    if(d > A.today){ cell.className = 'future'; cal.appendChild(cell); continue; }
    if(v){ cell.className = 'g' + (v === 1 ? 2 : v === 2 ? 3 : v <= 4 ? 4 : 5); parts += v; days++; }
    if(d.getTime() === A.today.getTime()) cell.classList.add('today');
    bindTip(cell, d.toLocaleDateString('en-IE', {weekday: 'short', day: 'numeric', month: 'short'}), [v ? v + (v === 1 ? ' part checked' : ' parts checked') : 'No practice']);
    cal.appendChild(cell);
  }
  cal.setAttribute('role', 'img'); cal.setAttribute('aria-label', days + (days === 1 ? ' day' : ' days') + ' practised in the last 12 weeks');
  var act = el('div', 'pg-act'), sc = el('div', 'pg-scroll'); sc.appendChild(cal); act.appendChild(sc);
  var p = el('p', 'pg-daysum');
  [[days, days === 1 ? 'day practised' : 'days practised'], [parts, parts === 1 ? 'part checked' : 'parts checked']].forEach(function(m){ var x = el('span'); x.appendChild(el('b', 'num', String(m[0]))); x.appendChild(document.createTextNode(' ' + m[1])); p.appendChild(x); });
  act.appendChild(p); c.appendChild(act);
  return c;
}
function progressView(S, attempts){
  var pg = el('div', 'pg'), A = practice(S, attempts);
  if(!S.papers.length){ pg.appendChild(el('p', 'empty', 'Your papers will appear here.')); return pg; }
  var fin = S.papers.filter(function(P){ return P.nparts === 4; }), sc = fin.map(function(P){ return pct(P.score, P.max); });
  pg.appendChild(pgNext(S));
  var sh = el('section', 'sheet pg-sheet'); sh.setAttribute('aria-label', 'Your progress in ' + PACKS[S.pack].level);
  var hd = el('div', 'sheet-head'); hd.appendChild(el('h2', null, 'Progress')); hd.appendChild(el('span', 'lv', PACKS[S.pack].name)); sh.appendChild(hd);
  sh.appendChild(pgTop(S, fin, sc));
  sh.appendChild(pgFacts(S, fin, sc, A.streak));
  var two = el('div', 'pg-two'); two.appendChild(pgParts(S)); two.appendChild(pgMistakes(S)); sh.appendChild(two);
  sh.appendChild(pgHeat(S));
  sh.appendChild(pgDays(S, A));
  pg.appendChild(sh);
  return pg;
}
function paperCard(P){
  var p = P.row, a = el('a', 'pcard'); a.href = '/app/paper.html?id=' + encodeURIComponent(p.id);
  var top = el('span', 'ptop'); top.appendChild(el('span', 'eyebrow', 'Paper ' + P.n));
  if(P.nparts === 4) top.appendChild(el('span', 'chip done', P.score + '/' + P.max));
  else if(P.nparts) top.appendChild(el('span', 'chip some', P.nparts + ' of 4 parts'));
  a.appendChild(top);
  a.appendChild(el('span', 't', p.title));
  a.appendChild(el('span', 'topics', p.topics || ''));
  var bars = el('div', 'bars4');
  PKS.forEach(function(pk, j){
    var x = P.parts[pk], w = el('div', 'bar4'), lab = 'Part ' + (j + 1);
    w.appendChild(el('span', null, lab)); w.appendChild(el('span', 'sc', x ? x.score + '/' + x.max : '\u00a0')); var i2 = el('i'); var bb = el('b'); bb.style.width = x ? (100 * x.score / x.max) + '%' : '0'; i2.appendChild(bb); w.appendChild(i2); bars.appendChild(w);
  });
  a.appendChild(bars);
  return a;
}
function pdfRows(S){
  var box = el('div', 'stack'); box.style.gap = '8px';
  S.papers.forEach(function(P, i){
    var p = P.row; if(!p.pdf_student && !p.pdf_teacher) return;
    var row = el('div', 'pdfrow');
    row.appendChild(el('span', null, 'Paper ' + P.n + ' · ' + p.title));
    var btns = el('span', 'pdfbtns');
    [['pdf_student', 'Student PDF'], ['pdf_teacher', 'Answer key PDF']].forEach(function(k){
      if(!p[k[0]]) return;
      var b = el('button', 'btn small', k[1]); b.type = 'button';
      b.addEventListener('click', function(){ b.disabled = true; DB.pdf(p[k[0]]).then(function(u){ window.open(u, '_blank', 'noopener'); }).catch(function(){ alertMsg('That PDF could not be opened. Try again in a moment.'); }).then(function(){ b.disabled = false; }); });
      btns.appendChild(b);
    });
    row.appendChild(btns); box.appendChild(row);
  });
  return box;
}
/* Download several PDFs at once: as one ZIP, or joined into one PDF to print. The libraries load only when needed. */
var LIBS = {zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'};
function lib(k){
  if(k === 'zip' && window.JSZip) return Promise.resolve(window.JSZip);
  if(k === 'pdf' && window.PDFLib) return Promise.resolve(window.PDFLib);
  return new Promise(function(ok, no){ var sc = document.createElement('script'); sc.src = LIBS[k]; sc.onload = function(){ ok(k === 'zip' ? window.JSZip : window.PDFLib); }; sc.onerror = no; document.head.appendChild(sc); });
}
function saveBlob(blob, name){
  var u = URL.createObjectURL(blob), a = el('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(u); }, 60000);
}
function pdfBatch(S){
  var pack = S.pack, papers = S.papers.filter(function(P){ return P.row.pdf_student || P.row.pdf_teacher; });
  var box = el('div', 'batch'), pick = {}, kind = 'pdf_student', joined = false;
  box.appendChild(el('h3', null, 'Download several at once'));
  var quick = el('div', 'batch-row'); quick.appendChild(el('span', 'blab', 'Select'));
  var grid = el('div', 'batch-grid'), boxes = [];
  papers.forEach(function(P, i){
    var l = el('label', 'bpick'), c = el('input'); c.type = 'checkbox'; c.value = String(i);
    c.addEventListener('change', function(){ pick[i] = c.checked; sync(); });
    l.appendChild(c); l.appendChild(el('span', null, 'Paper ' + P.n)); l.title = P.row.title;
    grid.appendChild(l); boxes.push(c);
  });
  function setRange(from, n){ boxes.forEach(function(c, i){ c.checked = i >= from && i < from + n; pick[i] = c.checked; }); sync(); }
  /* 2, 3, 5, 10: the next papers after the ones already picked, so pressing 5 twice gives papers 1 to 5, then 6 to 10 */
  [2, 3, 5, 10].forEach(function(n){
    if(n >= papers.length) return;
    var b = el('button', 'btn small', String(n)); b.type = 'button'; b.setAttribute('aria-label', 'Select the next ' + n + ' papers');
    b.addEventListener('click', function(){
      var last = -1; boxes.forEach(function(c, i){ if(c.checked) last = i; });
      var from = last + 1 >= papers.length ? 0 : last + 1; setRange(from, n);
    });
    quick.appendChild(b);
  });
  var all = el('button', 'btn small', 'All ' + papers.length); all.type = 'button'; all.addEventListener('click', function(){ setRange(0, papers.length); }); quick.appendChild(all);
  var none = el('button', 'btn small', 'Clear'); none.type = 'button'; none.addEventListener('click', function(){ setRange(0, 0); }); quick.appendChild(none);
  box.appendChild(quick); box.appendChild(grid);
  function radios(label, opts, on){
    var g = el('div', 'batch-row'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', label); g.appendChild(el('span', 'blab', label));
    opts.forEach(function(o, i){
      var b = el('button', 'btn small' + (i === 0 ? ' main' : ''), o[1]); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function(){ Array.prototype.forEach.call(g.querySelectorAll('button'), function(x){ x.classList.remove('main'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('main'); b.setAttribute('aria-checked', 'true'); on(o[0]); sync(); });
      g.appendChild(b);
    });
    return g;
  }
  box.appendChild(radios('Which', [['pdf_student', 'Student'], ['pdf_teacher', 'Answer key'], ['both', 'Both']], function(v){ kind = v; }));
  box.appendChild(radios('As', [[false, 'ZIP of separate PDFs'], [true, 'One PDF to print']], function(v){ joined = v; }));
  var go = el('button', 'btn main', ''); go.type = 'button'; var msg = el('p', 'small muted'); msg.setAttribute('aria-live', 'polite');
  var act = el('div', 'batch-row'); act.appendChild(go); act.appendChild(msg); box.appendChild(act);
  function files(){
    var out = [];
    /* students first, then answer keys: a joined PDF prints the class set in one go, keys at the end */
    (kind === 'both' ? ['pdf_student', 'pdf_teacher'] : [kind]).forEach(function(k){
      papers.forEach(function(P, i){ if(pick[i] && P.row[k]) out.push({P: P, path: P.row[k], k: k}); });
    });
    return out;
  }
  function sync(){
    var f = files(), n = f.length;
    go.disabled = !n; go.textContent = n ? 'Download ' + n + (n === 1 ? ' PDF' : ' PDFs') : 'Pick some papers';
  }
  go.addEventListener('click', function(){
    var f = files(); if(!f.length) return;
    var nums = f.map(function(x){ return x.P.n; }), lo = Math.min.apply(null, nums), hi = Math.max.apply(null, nums);
    var base = 'johnplusexams-' + pack + '-paper' + (lo === hi ? '-' + lo : 's-' + lo + '-' + hi) + (kind === 'both' ? '' : (kind === 'pdf_student' ? '-student' : '-answer-key'));
    go.disabled = true; msg.textContent = 'Getting the PDFs...';
    Promise.all([lib(joined ? 'pdf' : 'zip')].concat(f.map(function(x){
      return DB.pdf(x.path).then(function(u){ return fetch(u); }).then(function(r){ if(!r.ok) throw new Error('fetch'); return r.arrayBuffer(); });
    }))).then(function(r){
      var L = r[0], bufs = r.slice(1);
      msg.textContent = joined ? 'Joining them into one file...' : 'Zipping...';
      if(joined){
        return L.PDFDocument.create().then(function(out){
          return bufs.reduce(function(chain, b){
            return chain.then(function(){ return L.PDFDocument.load(b); }).then(function(src){ return out.copyPages(src, src.getPageIndices()); }).then(function(pages){ pages.forEach(function(pg){ out.addPage(pg); }); });
          }, Promise.resolve()).then(function(){ return out.save(); });
        }).then(function(bytes){ saveBlob(new Blob([bytes], {type: 'application/pdf'}), base + '.pdf'); });
      }
      var z = new L();
      f.forEach(function(x, i){ z.file(pack + '-paper-' + String(x.P.n).padStart(2, '0') + (x.k === 'pdf_student' ? '-student' : '-answer-key') + '.pdf', bufs[i]); });
      return z.generateAsync({type: 'blob'}).then(function(b){ saveBlob(b, base + '.zip'); });
    }).then(function(){ msg.textContent = 'Done. Check your downloads.'; }).catch(function(e){ console.error(e); msg.textContent = 'Something went wrong. Try fewer papers, or try again in a moment.'; }).then(function(){ sync(); });
  });
  sync();
  return box;
}
function levelPanel(S, acc, attempts){
  var pack = S.pack, panel = el('div', 'stack');
  panel.appendChild(progressView(S, attempts));
  var sec = el('section'); sec.setAttribute('aria-label', PACKS[pack].name + ' papers');
  var ph = el('div', 'sheet-head'); ph.style.borderColor = 'var(--ink)';
  ph.appendChild(el('h2', null, 'Papers')); ph.appendChild(el('span', 'lv', 'Access until ' + fmtDate(acc[pack].expires))); sec.appendChild(ph);
  var list = el('div', 'paperlist');
  if(!S.papers.length) list.appendChild(el('p', 'empty', 'Your papers will appear here.'));
  S.papers.forEach(function(P){ list.appendChild(paperCard(P)); });
  sec.appendChild(list); panel.appendChild(sec);
  if(S.papers.some(function(P){ return P.row.pdf_student || P.row.pdf_teacher; })){
    var det = el('details', 'sheet pdfs'); det.appendChild(el('summary', null, 'PDFs to print (' + PACKS[pack].level + ')'));
    det.appendChild(el('p', 'muted small', 'One part per A4 page. The answer key PDF has the explanations.'));
    det.appendChild(pdfBatch(S)); det.appendChild(el('h3', 'one-by-one', 'One at a time')); det.appendChild(pdfRows(S)); panel.appendChild(det);
  }
  return panel;
}
function home(user){
  $('dash').hidden = false; $('who').textContent = user.email;
  $('signout').addEventListener('click', function(){ DB.signOut().then(function(){ location.href = '/'; }); });
  Promise.all([DB.entitlements(), DB.attempts(), DB.allMistakes()]).then(function(r){
    var acc = access(r[0]), attempts = r[1], all = r[2], bp = best(attempts);
    var open = all.filter(function(m){ return !m.resolved; }).length;
    $('mcount').textContent = open ? '(' + open + ')' : '';
    var owned = Object.keys(PACKS).filter(function(p){ return acc[p]; });
    if(!owned.length){ $('noaccess').hidden = false; return; }
    return Promise.all(owned.map(function(p){ return DB.index(p); })).then(function(lists){
      var sums = {}, tabs = $('lvtabs'), panel = $('lvpanel'), btns = {};
      owned.forEach(function(p, n){ sums[p] = summarise(p, lists[n], bp, all); });
      function show(pack, focus){
        owned.forEach(function(p){ btns[p].setAttribute('aria-selected', p === pack ? 'true' : 'false'); btns[p].tabIndex = p === pack ? 0 : -1; });
        panel.textContent = ''; panel.setAttribute('aria-labelledby', 'lvtab-' + pack); tipHide(); panel.appendChild(levelPanel(sums[pack], acc, attempts));
        try{ localStorage.setItem('jpx-level', pack); }catch(e){}
        if(focus) btns[pack].focus();
      }
      owned.forEach(function(p, n){
        var S = sums[p], b = el('button', 'lvtab'); b.type = 'button'; b.id = 'lvtab-' + p; b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'lvpanel');
        b.appendChild(el('b', null, PACKS[p].level)); b.appendChild(el('span', 'nm', PACKS[p].name.split(' · ')[0].replace(PACKS[p].level + ' ', '')));
        b.appendChild(el('span', 'pr', S.papers.length ? S.done + ' of ' + S.papers.length + ' done' : 'Coming soon'));
        var tr = el('i'); var f = el('u'); f.style.width = (S.papers.length ? 100 * S.done / S.papers.length : 0) + '%'; tr.appendChild(f); b.appendChild(tr);
        b.addEventListener('click', function(){ show(p); });
        b.addEventListener('keydown', function(e){
          var d = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0); if(!d) return;
          e.preventDefault(); show(owned[(n + d + owned.length) % owned.length], true);
        });
        btns[p] = b; tabs.appendChild(b);
      });
      tabs.hidden = owned.length < 2; $('lvwrap').hidden = false;
      var saved = null; try{ saved = localStorage.getItem('jpx-level'); }catch(e){}
      var last = attempts.length ? packOf(attempts[attempts.length - 1].paper_id) : null;
      show(owned.indexOf(saved) >= 0 ? saved : (owned.indexOf(last) >= 0 ? last : owned[0]));
    });
  }).catch(function(e){ $('lvwrap').hidden = false; $('lvpanel').appendChild(el('p', 'msg err', 'Your papers could not be loaded. Check your connection and refresh.')); console.error(e); });
}
function alertMsg(t){ var m = el('p', 'msg err', t); document.querySelector('main').prepend(m); setTimeout(function(){ m.remove(); }, 5000); }

/* ---------- paper reader ---------- */
function reader(user){
  var id = qs('id'), gate = $('gate');
  if(!user){ gate.innerHTML = ''; gate.appendChild(document.createTextNode('Sign in to open this paper. ')); var a = el('a', null, 'Sign in'); a.href = '/app/'; gate.appendChild(a); return; }
  DB.paper(id).then(function(data){
    var pk = PACKS[packOf(id)] || {};
    data.slug = 'jpx-' + id;
    data.level = data.level || pk.level || packOf(id).toUpperCase();
    window.__PAPER__ = data;
    document.title = (data.tests[0] && data.tests[0].name ? data.tests[0].name + ' · ' : '') + (pk.short || 'Use of English') + ' · johnplusexams';
    gate.textContent = '';
    window.addEventListener('uoe:part-checked', function(e){
      var d = e.detail, items = d.test[d.pk].items;
      var any = d.marks.some(function(m){ return m && String(m.v || '').trim(); });
      if(!any) return; /* a part left blank is not an attempt */
      DB.saveAttempt({paper_id: id, part: d.pk, score: d.sub, max: d.max});
      var rows = [];
      items.forEach(function(it, i){
        var m = d.marks[i]; if(!m) return;
        if(!m.full && !String(m.v || '').trim()) return; /* left blank: not a mistake, just not done */
        rows.push({q: it.q, part: d.pk, given: d.pk === 'part1' ? ((it.options || {})[m.v] || String(m.v || '')) : String(m.v || ''), ok: !!m.full});
      });
      DB.saveMarks(id, rows);
    });
    var s = document.createElement('script'); s.src = '/assets/paper-engine.js?v=320a1ee6'; document.body.appendChild(s);
  }).catch(function(){
    gate.innerHTML = '';
    gate.appendChild(document.createTextNode('This paper is part of a pack your account does not have yet. '));
    var pk = PACKS[packOf(id)] || PACKS.c1;
    var a = el('a', null, 'See the ' + pk.level + ' pack'); a.href = pk.page + '#pricing'; gate.appendChild(a);
  });
}

/* ---------- My Mistakes ---------- */
var CONTR = [[/\bcan't\b/g, 'cannot'], [/\bwon't\b/g, 'will not'], [/n't\b/g, ' not'], [/'d\b/g, ' had'], [/'ll\b/g, ' will'], [/'ve\b/g, ' have'], [/'re\b/g, ' are'], [/'m\b/g, ' am']];
function norm(s){ s = String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\|/g, ' '); CONTR.forEach(function(c){ s = s.replace(c[0], c[1]); }); return s.replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim(); }
function accepted(pk, it){
  if(pk === 'part1') return [it.options[it.answer]];
  if(pk === 'part4') return [it.answer].concat(it.alts || []);
  return Array.isArray(it.answer) ? it.answer : [it.answer];
}
function sentenceFor(text, q, items, pk){
  var paras = text.split(/\n\n/), tag = '{{' + q + '}}', para = paras.find(function(p){ return p.indexOf(tag) >= 0; }) || '';
  var parts = para.split(/(?<=[.!?])\s+(?=[A-Z'"])/), s = parts.find(function(x){ return x.indexOf(tag) >= 0; }) || para;
  return s.replace(/\{\{(\d+)\}\}/g, function(m, n){
    if(String(n) === String(q)) return m;
    var o = items.find(function(x){ return String(x.q) === n; });
    if(!o) return '';
    return pk === 'part1' ? o.options[o.answer] : (Array.isArray(o.answer) ? o.answer[0] : o.answer);
  });
}
/* What a mistake was testing, in a few words, so repeated slips of one kind show up as a weak spot. */
function topicOf(pk, it){
  var t = pk === 'part3' ? String(it.change || '').split(',')[0] : (pk === 'part4' ? 'transformations' : String(it.category || ''));
  t = t.trim() || 'other';
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function mistakesPage(user){
  var list = $('mlist');
  if(!user){ list.innerHTML = ''; var p = el('p', 'empty'); p.appendChild(document.createTextNode('Sign in to see your mistakes. ')); var a = el('a', null, 'Sign in'); a.href = '/app/'; p.appendChild(a); list.appendChild(p); return; }
  DB.allMistakes().then(function(all){
    var ms = all.filter(function(m){ return !m.resolved; }), fixed = all.length - ms.length;
    if(!all.length){ list.innerHTML = ''; list.appendChild(el('p', 'empty', 'No mistakes to fix. Check a part of any paper and anything you get wrong will appear here.')); return; }
    var ids = Array.from(new Set(ms.map(function(m){ return m.paper_id; })));
    return Promise.all(ids.map(function(i){ return DB.paper(i).then(function(d){ return [i, d]; }).catch(function(){ return [i, null]; }); })).then(function(pairs){
      var papers = {}; pairs.forEach(function(p){ papers[p[0]] = p[1]; });
      /* keep only mistakes whose paper and question can still be opened */
      var rows = [];
      ms.forEach(function(m){
        var paper = papers[m.paper_id]; if(!paper) return;
        var t = paper.tests[0], p = t[m.part], it = p && p.items.find(function(x){ return x.q === m.q; }); if(!it) return;
        rows.push({m: m, t: t, p: p, it: it, level: packOf(m.paper_id), topic: topicOf(m.part, it), done: false});
      });
      var want = (qs('level') || '').toLowerCase();
      var F = {level: rows.some(function(r){ return r.level === want; }) ? want : 'all', part: 'all', topic: 'all'};
      var sum = $('msum'), weak = $('mweak'), filt = $('mfilter');
      function left(){ return rows.filter(function(r){ return !r.done; }); }
      function match(r, skip){
        return !r.done && (skip === 'level' || F.level === 'all' || r.level === F.level) && (skip === 'part' || F.part === 'all' || r.m.part === F.part)
          && (skip === 'topic' || F.topic === 'all' || r.m.part + '|' + r.topic === F.topic);
      }
      function chip(label, n, on, fn){
        var b = el('button', 'btn small' + (on ? ' main' : ''), label + ' (' + n + ')'); b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.addEventListener('click', fn); return b;
      }
      function summary(){
        var todo = left().length, got = fixed + rows.length - todo, total = todo + got;
        sum.textContent = ''; sum.hidden = false;
        var line = el('p', 'msum-line'); line.appendChild(el('b', null, String(todo))); line.appendChild(document.createTextNode(todo === 1 ? ' mistake to fix' : ' mistakes to fix'));
        line.appendChild(el('span', 'muted', '  ·  ' + got + ' fixed so far'));
        sum.appendChild(line);
        var tr = el('div', 'track'); tr.setAttribute('role', 'img'); tr.setAttribute('aria-label', got + ' of ' + total + ' mistakes fixed');
        var f = el('b'); f.style.width = (total ? 100 * got / total : 0) + '%'; tr.appendChild(f); sum.appendChild(tr);
      }
      function weakSpots(){
        weak.textContent = '';
        var c = {}; left().forEach(function(r){ if(r.m.part === 'part4' || (F.level !== 'all' && r.level !== F.level)) return; var k = r.m.part + '|' + r.topic; c[k] = (c[k] || 0) + 1; });
        var top = Object.keys(c).filter(function(k){ return c[k] > 1 || k === F.topic; }).sort(function(x, y){ return c[y] - c[x]; }).slice(0, 6);
        weak.hidden = !top.length; if(!top.length){ F.topic = 'all'; return; }
        weak.appendChild(el('h2', null, 'Your weak spots'));
        weak.appendChild(el('p', 'muted small', 'The kinds of question you miss most often. Pick one to practise just those.'));
        var row = el('div', 'cta');
        top.forEach(function(k){
          var bits = k.split('|');
          row.appendChild(chip(bits[1] + ' · ' + bits[0].replace('part', 'Part '), c[k], F.topic === k, function(){ F.topic = F.topic === k ? 'all' : k; draw(); }));
        });
        weak.appendChild(row);
      }
      function filters(){
        filt.textContent = '';
        var levels = Array.from(new Set(left().map(function(r){ return r.level; }))).sort();
        if(levels.length > 1){
          var g = el('div', 'cta'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Level');
          g.appendChild(chip('All levels', left().filter(function(r){ return match(r, 'level'); }).length, F.level === 'all', function(){ F.level = 'all'; F.topic = 'all'; draw(); }));
          levels.forEach(function(L){ g.appendChild(chip(L.toUpperCase(), left().filter(function(r){ return r.level === L && match(r, 'level'); }).length, F.level === L, function(){ F.level = L; F.topic = 'all'; draw(); })); });
          filt.appendChild(g);
        }
        var g2 = el('div', 'cta'); g2.setAttribute('role', 'group'); g2.setAttribute('aria-label', 'Part');
        g2.appendChild(chip('All parts', left().filter(function(r){ return match(r, 'part'); }).length, F.part === 'all', function(){ F.part = 'all'; draw(); }));
        PKS.forEach(function(pk, j){
          var n = left().filter(function(r){ return r.m.part === pk && match(r, 'part'); }).length; if(!n && F.part !== pk) return;
          g2.appendChild(chip('Part ' + (j + 1), n, F.part === pk, function(){ F.part = pk; draw(); }));
        });
        filt.appendChild(g2);
      }
      function draw(){
        $('mreview').hidden = false; summary(); weakSpots(); filters();
        list.innerHTML = ''; var shown = 0;
        rows.forEach(function(r){
          if(!match(r)) return;
          list.appendChild(card(r.m, r.t, r.p, r.it, function(){ r.done = true; summary(); })); shown++;
        });
        if(!shown) list.appendChild(el('p', 'empty', left().length ? 'Nothing here. Try another filter.' : 'All fixed. Nothing left to review.'));
      }
      draw();
    });
  }).catch(function(e){ list.innerHTML = ''; list.appendChild(el('p', 'msg err', 'Your mistakes could not be loaded. Check your connection and refresh.')); console.error(e); });
}
function card(m, t, p, it, onFixed){
  var pk = m.part, box = el('div', 'mist');
  box.appendChild(el('div', 'meta', packOf(m.paper_id).toUpperCase() + ' ' + (t.name || 'Paper') + ' · ' + pk.replace('part', 'Part ') + ' · question ' + it.q + (p.title ? ' · ' + p.title : '')));
  var ctx = el('div', 'ctx'), input = null, choice = null;
  if(pk === 'part4'){
    ctx.appendChild(el('p', null, it.lead));
    var k = el('p'); k.style.margin = '8px 0'; k.appendChild(el('span', 'keyword', it.key)); ctx.appendChild(k);
    var g = it.gapped.split(/_{3,}/); var sp = el('p'); sp.appendChild(document.createTextNode(g[0]));
    input = el('input'); input.type = 'text'; input.style.width = '14em'; input.setAttribute('aria-label', 'Your answer, using ' + it.key); sp.appendChild(input);
    sp.appendChild(document.createTextNode(g[1] || '')); ctx.appendChild(sp);
  } else {
    var s = sentenceFor(p.text, it.q, p.items, pk).split('{{' + it.q + '}}');
    ctx.appendChild(document.createTextNode(s[0]));
    if(pk === 'part1'){ var span = el('span', 'gapline', '?'); span.id = 'mg-' + m.paper_id + it.q; ctx.appendChild(span); choice = span; }
    else { input = el('input'); input.type = 'text'; input.setAttribute('aria-label', 'Your answer' + (it.stem ? ', from ' + it.stem : '')); ctx.appendChild(input); }
    if(pk === 'part3'){ ctx.appendChild(document.createTextNode(' ')); ctx.appendChild(el('span', 'keyword', it.stem)); }
    ctx.appendChild(document.createTextNode(s[1] || ''));
  }
  box.appendChild(ctx);
  box.appendChild(el('p', 'was', 'You wrote: ' + (m.given || '(blank)')));
  var fb = el('p', 'fix'); fb.hidden = true;
  var row = el('div', 'row'), picked = null;
  if(pk === 'part1'){
    var opts = el('div', 'opts'); opts.style.width = '100%';
    ['A', 'B', 'C', 'D'].forEach(function(L){
      var b = el('button', 'opt'); b.type = 'button'; b.appendChild(el('b', null, L)); b.appendChild(document.createTextNode(it.options[L]));
      b.addEventListener('click', function(){ picked = L; choice.textContent = it.options[L]; Array.prototype.forEach.call(opts.children, function(x){ x.classList.remove('on'); }); b.classList.add('on'); });
      opts.appendChild(b);
    });
    box.appendChild(opts);
  }
  var chk = el('button', 'btn small main', 'Check'); chk.type = 'button';
  var show = el('button', 'btn small', 'Show answer'); show.type = 'button';
  function reveal(ok){
    fb.hidden = false; fb.className = ok ? 'fix' : 'was';
    var ans = accepted(pk, it)[0].replace(/\s*\|\s*/g, ' ');
    fb.textContent = (ok ? 'Correct. ' : 'Answer: ' + ans + '. ') + (it.explain ? it.explain.replace(/\*\*/g, '') : '');
  }
  chk.addEventListener('click', function(){
    var v = pk === 'part1' ? (picked ? it.options[picked] : '') : (input ? input.value : '');
    if(!String(v).trim()){ if(input) input.focus(); return; }
    var ok = accepted(pk, it).some(function(a){ return norm(a) === norm(v); });
    reveal(ok);
    if(ok){ DB.resolve(m.paper_id, it.q); chk.disabled = true; box.style.opacity = '.6'; if(onFixed) onFixed(); }
  });
  show.addEventListener('click', function(){ reveal(false); });
  if(input) input.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); chk.click(); } });
  row.appendChild(chk); row.appendChild(show); box.appendChild(row); box.appendChild(fb);
  return box;
}

/* ---------- boot ---------- */
function boot(){
  showDemo();
  if(LIVE){ sb.auth.onAuthStateChange(function(ev){ if(ev === 'SIGNED_IN' && PAGE === 'app-home' && $('signin') && !$('signin').hidden) location.reload(); }); }
  DB.user().then(function(user){
    var acc = document.querySelector('[data-account]'); if(acc && user){ acc.textContent = 'My papers'; acc.href = '/app/'; }
    if(PAGE === 'app-home'){ if(user) home(user); else showSignIn(); }
    else if(PAGE === 'app-paper') reader(user);
    else if(PAGE === 'app-mistakes') mistakesPage(user);
  });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
