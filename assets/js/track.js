/* CyberDigest — privacy-friendly usage stats (only with the visitor's OK).
   Sends a few allow-listed events (e.g. "byte_read", "welcome_step") to the site owner's Supabase
   table, tagged with a random browser id. No story titles, search text or other personal content.
   Off when the backend is not configured, when the visitor says no, and by default when the
   browser sends Do Not Track or Global Privacy Control. */
(function () {
  const cfg = window.CD_CONFIG || {};
  const base = (cfg.supabaseUrl || '').replace(/\/+$/, '');
  const anonKey = cfg.supabaseAnonKey || '';
  const VERSION = '2.0';
  const EVENTS = new Set([
    'welcome_step', 'welcome_done', 'welcome_skip', 'otp_requested', 'otp_failed', 'signed_in', 'signed_out',
    'page_view', 'byte_read', 'byte_saved', 'story_opened', 'explore_filter', 'search', 'design_changed',
    'theme_changed', 'goal_reached', 'export',
  ]);
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  const idFrom = (store, key) => { let v = store.getItem(key); if (!/^[0-9a-f-]{36}$/.test(v || '')) { v = uuid(); store.setItem(key, v); } return v; };

  const enabled = !!(window.Auth && window.Auth.enabled);
  const browserSaysNo = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  let queue = [];
  let timer = null;

  // Keep props tiny and flat: up to 8 keys, short strings, numbers or booleans.
  function clean(props) {
    const out = {};
    Object.entries(props || {}).slice(0, 8).forEach(([k, v]) => {
      if (!/^[a-z_]{1,24}$/.test(k)) return;
      if (typeof v === 'number' && isFinite(v)) out[k] = Math.round(v * 100) / 100;
      else if (typeof v === 'boolean') out[k] = v;
      else if (typeof v === 'string') out[k] = v.slice(0, 40);
    });
    return out;
  }

  const consent = () => (window.Store ? Store.state.prefs.tracking : undefined); // 'on' | 'off' | undefined (not asked yet)

  async function flush(closing) {
    clearTimeout(timer); timer = null;
    if (!enabled || consent() !== 'on' || !queue.length) return;
    const rows = queue.splice(0, 50);
    const token = closing ? window.Auth.peekToken() : await window.Auth.getAccessToken();
    try {
      await fetch(`${base}/rest/v1/events`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: anonKey, Authorization: `Bearer ${token || anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(rows),
      });
    } catch (e) { /* offline: drop quietly, stats are best-effort */ }
    if (queue.length) flush(closing);
  }

  const Track = {
    enabled,
    // Default position of the "Help improve CyberDigest" switch.
    defaultOn: !browserSaysNo,
    consent,
    setConsent(on) {
      if (!window.Store) return;
      Store.setPref('tracking', on ? 'on' : 'off');
      if (on) flush(); else queue = [];
    },
    event(name, props) {
      if (!enabled || !EVENTS.has(name) || consent() === 'off') return;
      queue.push({
        anon_id: idFrom(localStorage, 'cyberdigest:anon'),
        session_id: idFrom(sessionStorage, 'cyberdigest:visit'),
        event: name,
        props: clean(props),
        route: (location.hash.slice(2).split('?')[0] || 'today').slice(0, 40),
        app_version: VERSION,
      });
      if (queue.length > 100) queue = queue.slice(-100); // before consent: keep only the latest
      if (consent() === 'on' && !timer) timer = setTimeout(flush, 4000);
    },
    flush,
  };

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
  window.Track = Track;
})();
