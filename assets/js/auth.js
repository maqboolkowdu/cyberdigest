/* CyberDigest — passwordless sign-in with a one-time code sent by email (Supabase Auth REST API).
   No SDK and no third-party script: four small fetch calls.
   "Keep me signed in" stores the session in localStorage; otherwise in sessionStorage, which the
   browser clears when the tab or window closes. */
(function () {
  const cfg = window.CD_CONFIG || {};
  const KEY = 'cyberdigest:session';

  // Only talk to an https backend (http is allowed for localhost testing).
  function validBase(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname));
    } catch (e) { return false; }
  }
  const base = (cfg.supabaseUrl || '').replace(/\/+$/, '');
  const anonKey = cfg.supabaseAnonKey || '';
  const enabled = validBase(base) && anonKey.length > 20;

  const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
  const listeners = new Set();
  let refreshing = null;

  function read() {
    for (const store of [localStorage, sessionStorage]) {
      try {
        const s = JSON.parse(store.getItem(KEY) || 'null');
        if (s && s.access_token && s.refresh_token && s.user && s.user.email) return s;
      } catch (e) { store.removeItem(KEY); }
    }
    return null;
  }
  let session = enabled ? read() : null;

  function write(s) {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    session = s;
    if (s) (s.remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s));
    listeners.forEach((fn) => { try { fn(session); } catch (e) { /* listener error */ } });
  }

  async function call(path, body, token) {
    const res = await fetch(`${base}/auth/v1${path}`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${token || anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.msg || data.error_description || data.message || `Request failed (${res.status})`);
      err.status = res.status;
      err.code = data.error_code || data.code || '';
      throw err;
    }
    return data;
  }

  function fromTokens(data, remember) {
    if (!data.access_token || !data.refresh_token || !data.user) throw new Error('Unexpected sign-in response');
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600),
      user: { id: String(data.user.id), email: String(data.user.email || '') },
      remember: !!remember,
    };
  }

  // Friendly messages for the common failures.
  function explain(err) {
    if (err.status === 429 || /rate_limit/i.test(err.code)) {
      // Supabase says exactly how long to wait for the per-person cooldown ("…after 37 seconds").
      const wait = /after (\d+) seconds?/i.exec(err.message);
      if (wait) return `Please wait ${wait[1]} seconds before asking for another code.`;
      // Project-wide email limit (only a few per hour until custom SMTP is set up).
      if (/email/i.test(`${err.code} ${err.message}`)) return 'Too many sign-in emails were sent recently. Please try again later (this can take up to an hour). If you already have a code, you can still enter it.';
      return 'Too many attempts. Please wait a few minutes and try again.';
    }
    if (/otp_expired|expired/i.test(err.code + err.message)) return 'That code has expired or is not correct. Ask for a new one.';
    if (err.status === 400 || err.status === 403 || err.status === 422) return 'That code is not correct. Check the email and try again.';
    if (err instanceof TypeError) return 'Could not reach the sign-in service. Check your connection.';
    return 'Something went wrong. Please try again.';
  }

  // Sign-in links: if the email holds a link instead of a code, clicking it returns here with the
  // session (or an error) in the address. Take it, then wipe it from the address bar and history.
  async function completeFromUrl() {
    const hash = location.hash || '';
    if (!/(^|[#&])(access_token|error_code|error)=/.test(hash)) return null;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    history.replaceState(null, '', location.pathname + location.search + '#/today');
    if (params.get('error') || params.get('error_code')) {
      return { error: /expired|invalid/i.test(params.get('error_code') + params.get('error_description'))
        ? 'That sign-in link has expired or was already used. Ask for a new code and use the newest email.'
        : 'Sign-in did not complete. Please try again.' };
    }
    if (!enabled) return null;
    const access = params.get('access_token'), refresh = params.get('refresh_token');
    if (!access || !refresh) return null;
    try {
      // Never trust tokens from the address bar blindly: ask the server who they belong to.
      const res = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${access}` } });
      if (!res.ok) throw new Error('rejected');
      const user = await res.json();
      write(fromTokens({ access_token: access, refresh_token: refresh, expires_in: params.get('expires_in'), user }, true));
      return { user: session.user };
    } catch (e) {
      return { error: 'That sign-in link could not be used. Ask for a new code.' };
    }
  }

  const Auth = {
    enabled,
    sender: typeof cfg.emailSender === 'string' && cfg.emailSender.trim() ? cfg.emailSender.trim().slice(0, 120) : '',
    completeFromUrl,
    validEmail: (e) => typeof e === 'string' && e.length <= 254 && EMAIL_RE.test(e.trim()),
    get user() { return session ? session.user : null; },
    get remembered() { return !!(session && session.remember); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    explain,

    // Step 1: email a one-time code. Creates the account on first use.
    async requestCode(email) {
      if (!enabled) throw new Error('Sign-in is not set up');
      email = String(email || '').trim().toLowerCase();
      if (!Auth.validEmail(email)) throw Object.assign(new Error('Please enter a valid email address.'), { status: 0, friendly: true });
      await call('/otp', { email, create_user: true });
      return email;
    },

    // Step 2: check the code and start a session.
    async verifyCode(email, code, remember) {
      if (!enabled) throw new Error('Sign-in is not set up');
      code = String(code || '').replace(/\s+/g, '');
      if (!/^\d{6,10}$/.test(code)) throw Object.assign(new Error('Enter the code from the email (6 digits).'), { status: 0, friendly: true });
      const data = await call('/verify', { type: 'email', email: String(email).trim().toLowerCase(), token: code });
      write(fromTokens(data, remember));
      return session.user;
    },

    // A valid access token for API calls, refreshing it when it is about to expire.
    async getAccessToken() {
      if (!session) return null;
      if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
      if (!refreshing) {
        const remember = session.remember;
        refreshing = call('/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
          .then((data) => { write(fromTokens(data, remember)); return session.access_token; })
          .catch((err) => { if (err.status >= 400 && err.status < 500) write(null); return null; })
          .finally(() => { refreshing = null; });
      }
      return refreshing;
    },

    // Current token without a network round-trip (used when the page is closing).
    peekToken() { return session && session.expires_at - 10 > Date.now() / 1000 ? session.access_token : null; },

    async signOut() {
      const token = session && session.access_token;
      write(null);
      if (token) { try { await call('/logout?scope=local', {}, token); } catch (e) { /* already signed out on this device */ } }
    },
  };

  window.Auth = Auth;
})();
