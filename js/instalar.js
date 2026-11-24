// App instalável: registra o service worker e mostra o convite "Instalar app" no celular.
(function () {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  const instalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const celular = ios || /Android|Mobi/.test(ua);
  let fechado = false; try { fechado = localStorage.getItem('app-convite') === 'nao'; } catch (e) { /* ok */ }
  let pedido = null;
  const css = document.createElement('style');
  css.textContent = `.app-conv{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:9999;background:#16181B;color:#fff;border:1px solid #2A2F33;border-radius:14px;padding:12px 12px 12px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.35);font:15px/1.35 Manrope,system-ui,sans-serif;max-width:520px;margin:0 auto}
.app-conv img{width:42px;height:42px;border-radius:10px;flex:none}.app-conv div{flex:1;min-width:0}.app-conv b{display:block;font-family:Sora,system-ui,sans-serif}
.app-conv small{color:#BFD3CB}.app-conv .ok{background:#3DDC97;color:#062B1A;border:0;border-radius:9px;padding:10px 14px;font-weight:800;font:inherit;font-weight:800;cursor:pointer}
.app-conv .x{background:none;border:0;color:#9BA6A2;font-size:22px;line-height:1;padding:4px 6px;cursor:pointer}
.app-ios{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:12px}
.app-ios .cx{background:#fff;color:#16191B;border-radius:16px;padding:20px 20px calc(20px + env(safe-area-inset-bottom,0px));max-width:480px;width:100%;font:16px/1.5 Manrope,system-ui,sans-serif}
.app-ios h3{font-family:Sora,system-ui,sans-serif;margin:0 0 10px;font-size:1.2rem}.app-ios ol{margin:0 0 16px;padding-left:22px;display:grid;gap:8px}
.app-ios .ok{width:100%;background:#16181B;color:#fff;border:0;border-radius:10px;padding:13px;font:inherit;font-weight:800;cursor:pointer}`;
  document.head.appendChild(css);
  function some() { const c = document.querySelector('.app-conv'); if (c) c.remove(); }
  function dicaIOS() {
    const m = document.createElement('div'); m.className = 'app-ios';
    m.innerHTML = `<div class="cx" role="dialog" aria-label="Instalar no iPhone"><h3>Instalar no iPhone</h3><ol>
      <li>Abra esta página no <b>Safari</b>.</li>
      <li>Toque nos <b>três pontinhos (•••)</b>, no canto de baixo à direita, e depois em <b>Compartilhar</b>.<br><small style="color:#5B6461">Em iPhones mais antigos, toque direto no botão <b>Compartilhar</b> (o quadrado com a seta para cima ⬆️).</small></li>
      <li>Role a lista e toque em <b>Adicionar à Tela de Início</b>.</li>
      <li>Toque em <b>Adicionar</b>, no canto de cima.</li></ol>
      <p style="margin:0 0 16px;color:#5B6461">O ícone <b>FS</b> aparece na tela do celular e abre a área do aluno em tela cheia.</p>
      <button class="ok" type="button">Entendi</button></div>`;
    m.addEventListener('click', (e) => { if (e.target === m || e.target.classList.contains('ok')) m.remove(); });
    document.body.appendChild(m);
  }
  function mostra() {
    if (instalado || fechado || !celular || document.querySelector('.app-conv')) return;
    if (!ios && !pedido) return;
    const c = document.createElement('div'); c.className = 'app-conv';
    c.innerHTML = `<img src="img/app/icon-192.png" alt=""><div><b>Instale o app no celular</b><small>Abre direto na área do aluno, em tela cheia.</small></div><button class="ok" type="button">Instalar</button><button class="x" type="button" aria-label="Agora não">×</button>`;
    c.querySelector('.x').onclick = () => { some(); try { localStorage.setItem('app-convite', 'nao'); } catch (e) { /* ok */ } };
    c.querySelector('.ok').onclick = async () => {
      if (pedido) { pedido.prompt(); const r = await pedido.userChoice.catch(() => null); pedido = null; some(); if (r && r.outcome === 'dismissed') { try { localStorage.setItem('app-convite', 'nao'); } catch (e) { /* ok */ } } }
      else dicaIOS();
    };
    document.body.appendChild(c);
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedido = e; mostra(); });
  window.addEventListener('appinstalled', some);
  window.instalarApp = () => (pedido ? (pedido.prompt(), pedido = null) : dicaIOS());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mostra, 1500)); else setTimeout(mostra, 1500);
})();
