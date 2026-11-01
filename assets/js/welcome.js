/* CyberDigest — welcome tour: a short, full-screen walk-through with a progress bar.
   Steps: what the site is → interests → daily goal → design → theme → optional sign-in.
   Every choice is applied live, so the page changes behind the tour as you pick.
   Also used on its own (mode "account") for the Sign in button in Settings. */
(function () {
  const { TOPICS, COUNTRIES, esc, ago } = CD;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = () => window.CDApp;

  const NAMES = { home: 'Welcome', interests: 'Your interests', goal: 'Daily goal', design: 'Design', theme: 'Theme', account: 'Sign in (optional)' };
  const GOALS = [[5, 'Coffee break', '~3 min'], [8, 'Recommended', '~5 min'], [10, 'Commute', '~6 min'], [15, 'Analyst', '~9 min'], [20, 'Deep dive', '~12 min']];

  let root, steps = [], step = 0, mode = 'tour';
  const acct = { phase: 'email', email: '', busy: false, resendAt: 0, timer: null };

  /* ---------- open / close ---------- */
  function open(opts = {}) {
    mode = opts.only === 'account' ? 'account' : 'tour';
    steps = mode === 'account' ? ['account'] : ['home', 'interests', 'goal', 'design', 'theme'].concat(Auth.enabled ? ['account'] : []);
    step = 0;
    Object.assign(acct, { phase: Auth.user ? 'done' : 'email', busy: false });
    root = $('#welcome');
    root.hidden = false;
    document.body.classList.add('welcome-open');
    show();
  }

  function close() {
    clearInterval(acct.timer);
    root.hidden = true;
    root.innerHTML = '';
    document.body.classList.remove('welcome-open');
  }

  function consentFromSwitch() {
    const sw = $('#wTrack');
    if (sw) Track.setConsent(sw.checked);
    else if (Track.consent() === undefined) Track.setConsent(Track.defaultOn);
  }

  function finish(skipped) {
    consentFromSwitch();
    const p = Store.state.prefs;
    if (skipped) Track.event('welcome_skip', { at_step: step + 1, name: steps[step] });
    Track.event('welcome_done', { skin: p.skin, theme: p.theme, goal: p.goal, topics: p.topics.length, regions: p.countries.length, signed_in: !!Auth.user, skipped: !!skipped });
    Store.setPref('onboarded', true);
    Store.state.stack = { day: '', ids: [] }; // build today's stack from the new interests
    Store.save();
    close();
    app().render();
    app().toast(Auth.user ? `You're all set, ${Auth.user.email}` : "You're all set. Enjoy today's bytes!");
  }

  /* ---------- frame: progress bar, step, back/next ---------- */
  function show() {
    const name = steps[step];
    const total = steps.length;
    const last = step === total - 1;
    const signedIn = !!Auth.user;
    let nextLabel = step === 0 ? 'Get started →' : 'Next →';
    if (last) nextLabel = mode === 'account' ? (signedIn ? 'Done' : 'Close') : (name === 'account' && !signedIn ? 'Continue as guest →' : 'Enter CyberDigest →');

    root.innerHTML = `
      <header class="w-top">
        <span class="w-brand">CYBER<br />DIGEST</span>
        ${mode === 'tour' ? `<div class="w-progress-wrap">
          <div class="w-progress" role="progressbar" aria-label="Setup progress" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${step + 1}">
            ${steps.map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'cur' : ''}"></i>`).join('')}
          </div>
          <span class="w-steplabel">Step ${step + 1} of ${total} · ${NAMES[name]}</span>
        </div>
        <button class="w-skip" id="wSkip" type="button">Skip setup</button>` : '<span class="spacer"></span><button class="w-skip" id="wSkip" type="button">Close</button>'}
      </header>
      <div class="w-body" id="wBody">${STEPS[name]()}</div>
      <footer class="w-foot">
        ${step > 0 ? '<button class="btn" id="wBack" type="button">← Back</button>' : '<span></span>'}
        <button class="btn btn-primary w-next" id="wNext" type="button">${nextLabel}</button>
      </footer>`;

    $('#wSkip').addEventListener('click', () => (mode === 'tour' ? finish(true) : close()));
    $('#wNext').addEventListener('click', next);
    if ($('#wBack')) $('#wBack').addEventListener('click', () => { step--; show(); });
    (BIND[name] || (() => {}))();
    const h = $('.w-h', root);
    if (h) h.focus({ preventScroll: true });
    root.scrollTop = 0;
    if (mode === 'tour') Track.event('welcome_step', { step: step + 1, name });
  }

  function next() {
    if (steps[step] === 'home') consentFromSwitch();
    if (step < steps.length - 1) { step++; show(); return; }
    if (mode === 'account') { close(); app().render(); return; }
    finish(false);
  }

  /* ---------- the steps ---------- */
  function trackSwitch() {
    if (!Track.enabled) return '';
    const on = Track.consent() === undefined ? Track.defaultOn : Track.consent() === 'on';
    return `<div class="w-consent">
      <label class="w-switch"><input type="checkbox" id="wTrack" ${on ? 'checked' : ''} /><span class="w-switch-ui" aria-hidden="true"></span>
        <span>Help improve CyberDigest with anonymous usage stats</span></label>
      <details class="w-privacy"><summary>What is collected?</summary>
        <p>Which steps and pages you use, how many bytes you read and save, and the design you pick, tied to a random ID.
        Never story titles, search text or your notes. If you sign in, your email is linked to these stats.
        You can switch this off any time in Settings.</p></details>
    </div>`;
  }

  const STEPS = {
    home() {
      const feed = app().feed();
      const week = feed.items.filter((i) => Date.now() - new Date(i.published) < 7 * 864e5).length;
      const sources = new Set(feed.items.map((i) => i.source)).size;
      const titles = feed.items.slice(0, 8).map((i) => `<span>${i.gcc ? '🌍' : '⚡'} ${esc(i.title)}</span>`).join('');
      return `
        <p class="w-eyebrow">⏱ 30-second setup · Free · No ads</p>
        <h1 class="w-h w-title" tabindex="-1">Stay ahead of cyber threats in <span class="hl">5 minutes</span> a day.</h1>
        <p class="w-lead">CyberDigest turns today's security news from ${sources || 'trusted'} sources into short, swipeable <b>bytes</b>, with stories from the UAE, Saudi Arabia, Qatar, Oman, Bahrain and Kuwait first.</p>
        ${titles ? `<div class="w-ticker" role="region" aria-label="Latest headlines"><div class="w-ticker-track">${titles}<span aria-hidden="true" class="w-dup">${titles}</span></div></div>` : ''}
        <div class="w-cards">
          <div class="w-card"><b>⚡ Bytes, not essays</b><span>Each story cut down to 2–3 key points and a "why it matters" line.</span></div>
          <div class="w-card"><b>🌍 GCC first</b><span>Regional incidents, regulators and CERT news, ahead of the global noise.</span></div>
          <div class="w-card"><b>🔖 Save &amp; share</b><span>Stash the important ones and export them for your blog or team briefing.</span></div>
        </div>
        ${feed.items.length ? `<p class="w-stats"><b>${week}</b> stories this week · <b>${sources}</b> sources · updated ${feed.generated ? ago(feed.generated) : 'recently'}</p>` : ''}
        ${trackSwitch()}`;
    },

    interests() {
      const p = Store.state.prefs;
      return `
        <h2 class="w-h" tabindex="-1">What should we watch for you?</h2>
        <p class="w-lead">Pick the regions and topics you care about. Your daily stack puts these first. Tip: 3–5 topics works well.</p>
        <h3 class="w-sub">Regions</h3>
        <div class="chips">${Object.entries(COUNTRIES).map(([c, v]) => `<label class="chip toggle-chip"><input type="checkbox" name="wCountry" value="${c}" ${p.countries.includes(c) ? 'checked' : ''}/>${v.flag} ${esc(v.name)}</label>`).join('')}</div>
        <h3 class="w-sub">Topics <small id="wTopicCount" class="muted"></small></h3>
        <div class="chips">${Object.entries(TOPICS).filter(([k]) => k !== 'general').map(([k, v]) => `<label class="chip toggle-chip"><input type="checkbox" name="wTopic" value="${k}" ${p.topics.includes(k) ? 'checked' : ''}/>${v.emoji} ${esc(v.label)}</label>`).join('')}</div>`;
    },

    goal() {
      const g = Store.state.prefs.goal;
      return `
        <h2 class="w-h" tabindex="-1">How much time do you have each day?</h2>
        <p class="w-lead">Your daily goal is the number of bytes in today's stack. Reach it to keep your 🔥 streak going.</p>
        <div class="w-options w-goals">${GOALS.map(([n, label, time]) => `
          <label class="w-option"><input type="radio" name="wGoal" value="${n}" ${g === n ? 'checked' : ''}/>
            <b class="w-big">${n}</b><span>bytes</span><small>${label} · ${time}</small></label>`).join('')}</div>`;
    },

    design() {
      const s = Store.state.prefs.skin;
      return `
        <h2 class="w-h" tabindex="-1">Pick your look</h2>
        <p class="w-lead">The page behind this tour changes as you choose. You can switch any time in Settings.</p>
        <div class="w-options w-two">
          <label class="w-option"><input type="radio" name="wSkin" value="immersive" ${s !== 'flat' ? 'checked' : ''}/>
            <span class="pv pv-immersive" aria-hidden="true"><span class="pv-mega">CYBER</span><span class="pv-cube"></span><span class="pv-bar"></span></span>
            <b>Immersive 3D</b><small>Rotating 3D objects, a tilting card stack, blueprint grid.</small></label>
          <label class="w-option"><input type="radio" name="wSkin" value="flat" ${s === 'flat' ? 'checked' : ''}/>
            <span class="pv pv-flat" aria-hidden="true"><span class="pv-block"></span><span class="pv-card"></span></span>
            <b>Flat &amp; sustainable</b><small>Bold colour blocks, minimal motion, lightest on data and battery.</small></label>
        </div>`;
    },

    theme() {
      const t = Store.state.prefs.theme;
      const opts = [['light', '☀️', 'Light', 'Bright and clear in daylight.'], ['dark', '🌙', 'Dark', 'Easy on the eyes; saves battery on OLED phones.'], ['system', '🖥️', 'Match my device', 'Follows your phone or PC setting.']];
      return `
        <h2 class="w-h" tabindex="-1">Light or dark?</h2>
        <p class="w-lead">Try each one: the page behind updates straight away.</p>
        <div class="w-options w-three">${opts.map(([v, icon, label, note]) => `
          <label class="w-option"><input type="radio" name="wTheme" value="${v}" ${t === v ? 'checked' : ''}/>
            <span class="w-icon" aria-hidden="true">${icon}</span><b>${label}</b><small>${note}</small></label>`).join('')}</div>`;
    },

    account() {
      const u = Auth.user;
      let inner;
      if (u) {
        inner = `<div class="w-done">✅ Signed in as <b>${esc(u.email)}</b>${Auth.remembered ? ' · kept signed in on this device' : ' · until you close this tab'}</div>
          <button class="btn" id="wSignOut" type="button">Sign out</button>`;
      } else if (acct.phase === 'code') {
        inner = `<p>We sent a code to <b>${esc(acct.email)}</b>. It's valid for a few minutes. Check your spam folder if you don't see it.</p>
          <form class="w-form" id="wCodeForm" novalidate>
            <label class="field"><span>One-time code</span>
              <input id="wCode" class="w-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" placeholder="••••••" required /></label>
            <label class="w-check"><input type="checkbox" id="wRemember" checked /> Keep me signed in on this device <small class="muted">(untick on a shared computer)</small></label>
            <div class="row wrap"><button class="btn btn-primary" id="wVerify" type="submit">Verify &amp; sign in</button>
              <button class="btn" id="wResend" type="button">Resend code</button>
              <button class="btn" id="wChange" type="button">Use a different email</button></div>
          </form>`;
      } else {
        inner = `<form class="w-form" id="wEmailForm" novalidate>
            <label class="field"><span>Email</span>
              <input id="wEmail" type="email" autocomplete="email" inputmode="email" maxlength="254" placeholder="you@example.com" value="${esc(acct.email)}" required /></label>
            <button class="btn btn-primary" id="wSend" type="submit">Email me a code</button>
          </form>`;
      }
      return `
        <h2 class="w-h" tabindex="-1">${u ? "You're signed in" : 'Sign in with your email'}</h2>
        <p class="w-lead">${u ? 'Your reading progress is linked to your account.' : 'No password: we email you a one-time code. This is optional, so you can continue as a guest.'}</p>
        <div class="w-account">${inner}<p class="w-msg" id="wMsg" role="alert" aria-live="assertive"></p></div>
        ${mode === 'tour' ? trackSwitch() : ''}`;
    },
  };

  /* ---------- step behaviour ---------- */
  const BIND = {
    interests() {
      const sync = () => {
        Store.setPref('countries', $$('input[name=wCountry]:checked').map((i) => i.value));
        Store.setPref('topics', $$('input[name=wTopic]:checked').map((i) => i.value));
        const n = Store.state.prefs.topics.length;
        $('#wTopicCount').textContent = n ? `· ${n} selected` : '';
      };
      $$('input[name=wCountry], input[name=wTopic]').forEach((i) => i.addEventListener('change', sync));
      sync();
    },
    goal() {
      $$('input[name=wGoal]').forEach((r) => r.addEventListener('change', () => Store.setPref('goal', +r.value)));
    },
    design() {
      $$('input[name=wSkin]').forEach((r) => r.addEventListener('change', () => {
        Store.setPref('skin', r.value); Store.setPref('skinChosen', true); app().applyTheme();
      }));
    },
    theme() {
      $$('input[name=wTheme]').forEach((r) => r.addEventListener('change', () => { Store.setPref('theme', r.value); app().applyTheme(); }));
    },
    account() {
      const msg = (text, ok) => { const m = $('#wMsg'); if (m) { m.textContent = text || ''; m.classList.toggle('ok', !!ok); } };
      const busy = (btn, on, label) => { if (btn) { btn.disabled = on; if (label) btn.textContent = label; } };

      if ($('#wSignOut')) $('#wSignOut').addEventListener('click', async () => {
        await Auth.signOut(); Track.event('signed_out'); acct.phase = 'email'; show();
      });

      const emailForm = $('#wEmailForm');
      if (emailForm) {
        $('#wEmail').focus();
        emailForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (acct.busy) return;
          const btn = $('#wSend');
          acct.busy = true; busy(btn, true, 'Sending…'); msg('');
          try {
            acct.email = await Auth.requestCode($('#wEmail').value);
            acct.phase = 'code'; acct.resendAt = Date.now() + 60000;
            Track.event('otp_requested');
            show();
          } catch (err) {
            msg(err.friendly ? err.message : Auth.explain(err));
            Track.event('otp_failed', { stage: 'send', status: err.status || 0 });
            busy(btn, false, 'Email me a code');
          } finally { acct.busy = false; }
        });
      }

      const codeForm = $('#wCodeForm');
      if (codeForm) {
        const code = $('#wCode');
        code.focus();
        code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 10); });
        const resend = $('#wResend');
        const tick = () => {
          const left = Math.ceil((acct.resendAt - Date.now()) / 1000);
          resend.disabled = left > 0;
          resend.textContent = left > 0 ? `Resend in ${left}s` : 'Resend code';
        };
        clearInterval(acct.timer); acct.timer = setInterval(tick, 1000); tick();
        resend.addEventListener('click', async () => {
          resend.disabled = true; msg('');
          try { await Auth.requestCode(acct.email); acct.resendAt = Date.now() + 60000; msg('A new code is on its way.', true); Track.event('otp_requested', { resend: true }); }
          catch (err) { msg(Auth.explain(err)); Track.event('otp_failed', { stage: 'resend', status: err.status || 0 }); }
          tick();
        });
        $('#wChange').addEventListener('click', () => { acct.phase = 'email'; show(); });
        codeForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (acct.busy) return;
          const btn = $('#wVerify');
          acct.busy = true; busy(btn, true, 'Checking…'); msg('');
          try {
            const remember = $('#wRemember').checked;
            await Auth.verifyCode(acct.email, code.value, remember);
            clearInterval(acct.timer);
            acct.phase = 'done';
            Track.event('signed_in', { remember });
            show();
          } catch (err) {
            msg(err.friendly ? err.message : Auth.explain(err));
            Track.event('otp_failed', { stage: 'verify', status: err.status || 0 });
            busy(btn, false, 'Verify & sign in');
            code.select();
          } finally { acct.busy = false; }
        });
      }
    },
  };

  // Enter moves on (except inside forms and text fields).
  document.addEventListener('keydown', (e) => {
    if (!root || root.hidden || e.key !== 'Enter' || e.target.closest('form, input, textarea, select, button, a, summary')) return;
    e.preventDefault();
    next();
  });

  window.Welcome = { open };
})();
