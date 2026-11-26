/* Public pages: show "My papers" instead of "Sign in" when a session exists, and point buy buttons at checkout. */
(function(){
  try{
    for(var i = 0; i < localStorage.length; i++){
      var k = localStorage.key(i);
      if(/^sb-.*-auth-token$/.test(k) || k === 'jpx-demo-user'){
        var a = document.querySelector('[data-account]'); if(a) a.textContent = 'My papers';
        break;
      }
    }
  }catch(e){}
  var cfg = window.JPX || {};
  function wire(){
    var c = (window.JPX && window.JPX.checkout) || {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-buy]'), function(b){
      var url = c[b.getAttribute('data-buy')];
      if(url){ b.href = url; b.removeAttribute('aria-disabled'); if(/Opening soon/.test(b.textContent)) b.textContent = 'Buy now'; }
    });
  }
  if(cfg.checkout) wire();
  else{ var s = document.createElement('script'); s.src = '/assets/config.js'; s.onload = wire; document.head.appendChild(s); }
})();
