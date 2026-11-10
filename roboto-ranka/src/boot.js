// Boot: check WebGL first, then load the game (which pulls three.js from the CDN).
// If WebGL is missing or the game cannot load, show a friendly Lithuanian message instead of a blank page.
window.__game = window.__game || { scene: null, state: null, errors: [] };

function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (e) {
    return false;
  }
}

function showFallback(text) {
  const fb = document.getElementById('fallback');
  const ld = document.getElementById('loading');
  if (ld) ld.remove();
  if (text) document.getElementById('fb-text').textContent = text;
  fb.hidden = false;
}

if (!hasWebGL2()) {
  showFallback();
} else {
  import('./main.js')
    .then((m) => m.start())
    .catch((err) => {
      window.__game.errors.push(String(err && err.stack || err));
      console.warn('[ra-l07] load failed', err);
      showFallback('Nepavyko įkelti žaidimo. Patikrinkite interneto ryšį ir perkraukite puslapį.');
    });
}
