/* johnplusexams app: sign-in, My papers, the paper reader and My Mistakes.
   With Supabase configured in config.js it uses the real database; without it, it runs a local
   demo that keeps everything in this browser (for previewing before launch). */
(function(){
'use strict';
var CFG = window.JPX || {};
var LIVE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
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
function home(user){
  $('dash').hidden = false; $('who').textContent = user.email;
  $('signout').addEventListener('click', function(){ DB.signOut().then(function(){ location.href = '/'; }); });
  Promise.all([DB.entitlements(), DB.attempts(), DB.mistakes()]).then(function(r){
    var acc = access(r[0]), attempts = r[1], mistakes = r[2], bp = best(attempts);
    $('mcount').textContent = mistakes.length ? '(' + mistakes.length + ')' : '';
    var done = {}; attempts.forEach(function(a){ done[a.paper_id] = 1; });
    var tot = 0, mx = 0; Object.keys(bp).forEach(function(k){ tot += bp[k].score; mx += bp[k].max; });
    var stats = $('stats');
    [[Object.keys(done).length, 'papers started'], [mx ? Math.round(100 * tot / mx) + '%' : '-', 'best scores overall'], [mistakes.length, 'mistakes to fix']].forEach(function(s){
      var d = el('div', 'stat'); d.appendChild(el('b', null, String(s[0]))); d.appendChild(el('span', null, s[1])); stats.appendChild(d);
    });
    var owned = Object.keys(PACKS).filter(function(p){ return acc[p]; });
    if(!owned.length){ $('noaccess').hidden = false; return; }
    return Promise.all(owned.map(function(p){ return DB.index(p); })).then(function(lists){
      var packsBox = $('packs'), pl = $('pdflist'), anyPdf = false;
      owned.forEach(function(pack, n){
        var list = lists[n], sec = el('section'), hid = pack + 'h';
        sec.setAttribute('aria-labelledby', hid);
        var hd = el('div', 'sheet-head'); hd.style.borderColor = 'var(--ink)';
        var h2 = el('h2', null, PACKS[pack].name); h2.id = hid; h2.style.fontSize = '1.3rem'; hd.appendChild(h2);
        hd.appendChild(el('span', 'lv', 'Access until ' + fmtDate(acc[pack].expires))); sec.appendChild(hd);
        var box = el('div', 'paperlist'); sec.appendChild(box); packsBox.appendChild(sec);
        if(!list.length){ box.appendChild(el('p', 'empty', 'Your papers will appear here.')); return; }
        list.forEach(function(p, i){
          var a = el('a', 'pcard'); a.href = '/app/paper.html?id=' + encodeURIComponent(p.id);
          a.appendChild(el('span', 'eyebrow', 'Paper ' + (i + 1)));
          a.appendChild(el('span', 't', p.title));
          a.appendChild(el('span', 'topics', p.topics || ''));
          var bars = el('div', 'bars4');
          ['part1', 'part2', 'part3', 'part4'].forEach(function(pk, j){
            var x = bp[p.id + '|' + pk], w = el('div', 'bar4'), lab = 'Part ' + (j + 1) + (x ? ' · ' + x.score + '/' + x.max : '');
            w.appendChild(el('span', null, lab)); var i2 = el('i'); var bb = el('b'); bb.style.width = x ? (100 * x.score / x.max) + '%' : '0'; i2.appendChild(bb); w.appendChild(i2); bars.appendChild(w);
          });
          a.appendChild(bars); box.appendChild(a);
        });
        list.forEach(function(p, i){
          var row = el('div', 'row'), first = !pl.children.length; anyPdf = true;
          row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;border-top:' + (first ? '0' : '1px solid var(--rule)') + ';padding-top:' + (first ? '0' : '8px');
          row.appendChild(el('span', null, (owned.length > 1 ? PACKS[pack].level + ' ' : '') + 'Paper ' + (i + 1) + ' · ' + p.title));
          var btns = el('span'); btns.style.cssText = 'display:flex;gap:8px';
          [['pdf_student', 'Student PDF'], ['pdf_teacher', 'Answer key PDF']].forEach(function(k){
            if(!p[k[0]]) return;
            var b = el('button', 'btn small', k[1]); b.type = 'button';
            b.addEventListener('click', function(){ b.disabled = true; DB.pdf(p[k[0]]).then(function(u){ window.open(u, '_blank', 'noopener'); }).catch(function(){ alertMsg('That PDF could not be opened. Try again in a moment.'); }).then(function(){ b.disabled = false; }); });
            btns.appendChild(b);
          });
          row.appendChild(btns); pl.appendChild(row);
        });
      });
      if(anyPdf) $('pdfsec').hidden = false;
    });
  }).catch(function(e){ $('stats').appendChild(el('p', 'msg err', 'Your papers could not be loaded. Check your connection and refresh.')); console.error(e); });
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
    var s = document.createElement('script'); s.src = '/assets/paper-engine.js'; document.body.appendChild(s);
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
function mistakesPage(user){
  var list = $('mlist');
  if(!user){ list.innerHTML = ''; var p = el('p', 'empty'); p.appendChild(document.createTextNode('Sign in to see your mistakes. ')); var a = el('a', null, 'Sign in'); a.href = '/app/'; p.appendChild(a); list.appendChild(p); return; }
  DB.mistakes().then(function(ms){
    if(!ms.length){ list.innerHTML = ''; list.appendChild(el('p', 'empty', 'No mistakes to fix. Check a part of any paper and anything you get wrong will appear here.')); return; }
    var ids = Array.from(new Set(ms.map(function(m){ return m.paper_id; })));
    return Promise.all(ids.map(function(i){ return DB.paper(i).then(function(d){ return [i, d]; }).catch(function(){ return [i, null]; }); })).then(function(pairs){
      var papers = {}; pairs.forEach(function(p){ papers[p[0]] = p[1]; });
      var filt = $('mfilter'), current = 'all';
      function draw(){
        list.innerHTML = ''; var shown = 0;
        ms.forEach(function(m){
          if(current !== 'all' && m.part !== current) return;
          var paper = papers[m.paper_id]; if(!paper) return;
          var t = paper.tests[0], p = t[m.part], it = p && p.items.find(function(x){ return x.q === m.q; }); if(!it) return;
          list.appendChild(card(m, t, p, it)); shown++;
        });
        if(!shown) list.appendChild(el('p', 'empty', 'Nothing in this part.'));
      }
      [['all', 'All'], ['part1', 'Part 1'], ['part2', 'Part 2'], ['part3', 'Part 3'], ['part4', 'Part 4']].forEach(function(f){
        var n = f[0] === 'all' ? ms.length : ms.filter(function(m){ return m.part === f[0]; }).length;
        if(f[0] !== 'all' && !n) return;
        var b = el('button', 'btn small', f[1] + ' (' + n + ')'); b.type = 'button'; b.setAttribute('aria-pressed', f[0] === current ? 'true' : 'false');
        if(f[0] === current) b.classList.add('main');
        b.addEventListener('click', function(){ current = f[0]; Array.prototype.forEach.call(filt.children, function(x){ x.classList.remove('main'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('main'); b.setAttribute('aria-pressed', 'true'); draw(); });
        filt.appendChild(b);
      });
      draw();
    });
  }).catch(function(e){ list.innerHTML = ''; list.appendChild(el('p', 'msg err', 'Your mistakes could not be loaded. Check your connection and refresh.')); console.error(e); });
}
function card(m, t, p, it){
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
    if(ok){ DB.resolve(m.paper_id, it.q); chk.disabled = true; box.style.opacity = '.6'; }
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
