/* Runs before the page paints: apply the saved theme and design so there is no flash.
   (Kept in its own file so the Content Security Policy can forbid inline scripts.) */
try {
  const s = JSON.parse(localStorage.getItem('cyberdigest:v1') || '{}'), p = s.prefs || {};
  const skin = new URLSearchParams(location.search).get('skin') || (p.skinChosen ? p.skin : 'immersive');
  if (p.theme && p.theme !== 'system') document.documentElement.dataset.theme = p.theme;
  if (skin !== 'flat') document.documentElement.dataset.skin = 'immersive';
} catch (e) { /* first visit or storage blocked: use defaults */ }
