/* CyberDigest — views, routing and interactions. */
(function () {
  const { TOPICS, COUNTRIES, esc, dayKey, ago, readMins } = CD;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  let FEED = { generated: null, sources: [], items: [] };
  let BY_ID = new Map();

  const ICONS = {
    today: '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
    explore: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    stashes: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };
  const icon = (name) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  const ROUTES = [
    { id: 'today', label: 'Today', sub: 'Your daily stack of cyber bytes' },
    { id: 'explore', label: 'Explore', sub: 'Every story, filtered by region and topic' },
    { id: 'stashes', label: 'Stashes', sub: 'Bytes you saved, with your notes' },
    { id: 'settings', label: 'Settings', sub: 'Interests, daily goal and data' },
  ];

  /* ---------- helpers ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function parseHash() {
    const [path, qs] = (location.hash.slice(2) || 'today').split('?');
    return { route: ROUTES.some((r) => r.id === path) ? path : 'today', params: new URLSearchParams(qs || '') };
  }

  const primaryTopic = (item) => TOPICS[item.topics[0]] || TOPICS.general;
  const tint = (item) => `--tint:${primaryTopic(item).tint}`;
  const flags = (item) => item.countries.map((c) => `<span title="${esc(COUNTRIES[c].name)}">${COUNTRIES[c].flag}</span>`).join('');
  const gccBadge = (item) => (item.gcc ? `<span class="badge gcc">${item.countries.length ? flags(item) : '🌍'} GCC</span>` : '');
  const topicChip = (item) => { const t = primaryTopic(item); return `<span class="chip-topic">${t.emoji} ${esc(t.label)}</span>`; };
  const aiBadge = (item) => (item.ai && item.ai.ideas ? '<span class="badge ai" title="Key ideas written by Claude from the publisher\'s summary">✨ AI summary</span>' : '');
  const ideasOf = (item) => (item.ideas && item.ideas.length ? item.ideas : [item.summary && item.summary.length > 40 ? item.summary.slice(0, 420) : 'Headline brief. This source only publishes the headline, so open the full story for the details.']);

  function score(item) {
    const p = Store.state.prefs;
    const hrs = (Date.now() - new Date(item.published).getTime()) / 36e5;
    let s = 10 * Math.exp(-hrs / 36);
    if (item.gcc) s += 3;
    s += item.countries.filter((c) => p.countries.includes(c)).length * 2;
    s += item.topics.filter((t) => p.topics.includes(t)).length * 1.5;
    if (item.ideas && item.ideas.length) s += 1;
    return s;
  }

  function rankUnread(exclude = new Set()) {
    return FEED.items.filter((i) => !Store.isRead(i.id) && !exclude.has(i.id)).map((i) => [score(i), i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  }

  // Pick N stories, at most 2 per source so one busy feed can't flood the stack.
  function pick(ranked, n) {
    const perSource = {}, out = [];
    for (const it of ranked) {
      if ((perSource[it.source] || 0) >= 2) continue;
      perSource[it.source] = (perSource[it.source] || 0) + 1;
      out.push(it.id);
      if (out.length >= n) break;
    }
    return out;
  }

  function ensureStack() {
    const st = Store.state;
    if (st.stack.day !== dayKey() || !st.stack.ids.length) {
      st.stack = { day: dayKey(), ids: pick(rankUnread(), st.prefs.goal) };
      Store.save();
    }
    st.stack.ids = st.stack.ids.filter((id) => BY_ID.has(id));
    return st.stack.ids;
  }

  function itemMarkdown(item, note) {
    const date = new Date(item.published).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    const where = item.countries.length ? ` · ${item.countries.map((c) => COUNTRIES[c].name).join(', ')}` : '';
    let md = `### ${item.title}\n*${item.source} · ${date}${where}* · [Read the full story](${item.link})\n\n`;
    md += ideasOf(item).map((i) => `- ${i}`).join('\n') + '\n';
    if (item.takeaway) md += `\n**Why it matters:** ${item.takeaway}\n`;
    if (note) md += `\n> **My take:** ${note}\n`;
    return md;
  }

  function download(name, text, type = 'text/markdown') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- chrome ---------- */
  function renderChrome(route) {
    const links = ROUTES.map((r) => `<a href="#/${r.id}" class="${r.id === route ? 'active' : ''}">${icon(r.id)}<span>${r.label}</span>${r.id === 'stashes' && Object.keys(Store.state.saved).length ? `<em class="count">${Object.keys(Store.state.saved).length}</em>` : ''}</a>`).join('');
    $('#nav').innerHTML = links;
    $('#bottomNav').innerHTML = links;
    document.body.dataset.route = route;
    const r = ROUTES.find((x) => x.id === route);
    $('#pageTitle').textContent = r.label;
    $('#pageSub').textContent = r.sub;
    $('#mastStats').innerHTML = `<span title="Day streak">🔥 ${Store.streak()}</span> · <span title="Read today / daily goal">${Store.todayCount()}/${Store.state.prefs.goal}</span>`;
  }

  // Sustainable-web footer: shows how much this visit actually downloaded.
  function renderFooter() {
    const nav = performance.getEntriesByType('navigation')[0];
    let bytes = nav ? nav.transferSize : 0;
    performance.getEntriesByType('resource').forEach((r) => { bytes += r.transferSize || 0; });
    const weight = bytes ? `<b>${Math.max(1, Math.round(bytes / 1024))} KB</b> downloaded this visit` : '<b>Loaded from cache</b> (nothing downloaded)';
    $('#siteFoot').innerHTML = `<span>🌱 ${weight}</span><span>System fonts only</span><span>No trackers, ads or third-party scripts</span><span>Dark mode saves power on OLED screens</span>
      <span class="muted">${FEED.generated ? `News updated ${ago(FEED.generated)}` : ''}</span>`;
  }

  /* ---------- Today ---------- */
  const viewer = { story: 0, idea: 0 };

  function renderToday() {
    const ids = ensureStack();
    const goal = Store.state.prefs.goal, done = Store.todayCount();
    const pct = Math.min(1, done / goal);
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const gcc = FEED.items.filter((i) => i.gcc).slice(0, 10);
    const topicCounts = {};
    FEED.items.filter((i) => Date.now() - new Date(i.published) < 3 * 864e5).forEach((i) => i.topics.forEach((t) => { topicCounts[t] = (topicCounts[t] || 0) + 1; }));
    const trending = Object.entries(topicCounts).filter(([t]) => t !== 'general').sort((a, b) => b[1] - a[1]).slice(0, 8);

    viewer.story = ids.findIndex((id) => !Store.isRead(id));
    viewer.idea = 0;

    const gccWeek = FEED.items.filter((i) => i.gcc && Date.now() - new Date(i.published) < 7 * 864e5).length;
    $('#view').innerHTML = `
      <section class="hero3d" aria-label="CyberDigest">
        <h2 class="mega">CYBER DIGEST</h2>
        <div class="hero-tags"><span>■ Daily briefing</span><span>■ GCC first</span><span>■ ${FEED.items.length} stories · ${new Set(FEED.items.map((i) => i.source)).size} sources</span></div>
        <div class="hero-row">
          <div class="hero-cell hero-text">
            <p>Bite-size cyber security news from around the world, with the GCC first. Read a few bytes a day and keep the ones that matter.</p>
            <button class="btn-cta" id="ctaStart">Start today's briefing ↓</button>
          </div>
          <div class="hero-cell hero-obj" aria-hidden="true">
            <div class="cube-scene"><div class="cube">
              <div class="face f-front"><svg viewBox="0 0 24 24" width="46%" height="46%"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z" fill="#ff6a13"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
              <div class="face f-back">0DAY</div><div class="face f-right">CVE</div><div class="face f-left">APT</div><div class="face f-top">GCC</div><div class="face f-bottom">IOC</div>
            </div><div class="cube-shadow"></div></div>
          </div>
          <div class="hero-cell hero-dark" aria-hidden="true">
            <div class="globe"><i></i><i></i><i></i><i></i></div>
            <span class="hero-dark-label">GCC · 7 days <b>${gccWeek}</b></span>
          </div>
        </div>
      </section>
      <section class="split">
        <div class="brief">
          <p class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h2>${hello}</h2>
          <p>${ids.length ? `Your briefing has <b>${ids.length}</b> bytes, picked from ${FEED.items.length} stories across ${new Set(FEED.items.map((i) => i.source)).size} sources.` : 'No stories yet. The news feed may still be loading.'}</p>
          <div class="kpis">
            <div class="kpi"><b id="kpiDone">${done}/${goal}</b><small>Read today</small></div>
            <div class="kpi"><b>🔥 ${Store.streak()}</b><small>Day streak</small></div>
            <div class="kpi"><b>${gccWeek}</b><small>GCC this week</small></div>
          </div>
          <div class="meter" aria-hidden="true"><i id="meter" style="width:${pct * 100}%"></i></div>
          <p class="brief-hint">Click the card or press <kbd>→</kbd> for the next point, <kbd>←</kbd> to go back, <kbd>S</kbd> to save.</p>
        </div>
        <div class="stack-wrap" id="stackWrap"></div>
      </section>
      ${gcc.length ? `<section class="section"><div class="section-head"><h3>GCC spotlight</h3><a href="#/explore?region=gcc">See all →</a></div>
        <div class="tiles">${gcc.slice(0, 8).map(miniCard).join('')}</div></section>` : ''}
      ${trending.length ? `<section class="section"><div class="section-head"><h3>Trending this week</h3><a href="#/explore">Explore →</a></div>
        <div class="chips">${trending.map(([t, n]) => `<a class="chip" href="#/explore?topic=${t}">${TOPICS[t].emoji} ${esc(TOPICS[t].label)} <em>${n}</em></a>`).join('')}</div></section>` : ''}`;
    renderCard();
    bindMini();
    $('#ctaStart').addEventListener('click', () => $('#stackWrap').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  }

  function miniCard(item) {
    const t = primaryTopic(item);
    return `<button class="mini" data-open="${item.id}" style="${tint(item)}">
      <span class="mini-top">${t.emoji} ${esc(t.label)} <span class="spacer"></span>${item.countries.length ? flags(item) : ''}</span>
      <span class="mini-title">${esc(item.title)}</span>
      <span class="mini-meta">${esc(item.source)} · ${ago(item.published)}${Store.isRead(item.id) ? ' · ✓' : ''}</span>
    </button>`;
  }

  function bindMini() { $$('[data-open]').forEach((b) => b.addEventListener('click', () => openReader(b.dataset.open))); }

  function renderCard() {
    const wrap = $('#stackWrap');
    if (!wrap) return;
    const ids = Store.state.stack.ids;
    if (viewer.story < 0 || viewer.story >= ids.length) {
      wrap.innerHTML = `<div class="done-card">
        <div class="done-emoji">🎉</div>
        <h3>${ids.length ? 'Stack complete!' : 'Nothing to read yet'}</h3>
        <p class="muted">${ids.length ? `You read ${Store.todayCount()} bytes today. Streak: 🔥 ${Store.streak()} day${Store.streak() === 1 ? '' : 's'}.` : 'Check back after the next news refresh.'}</p>
        <div class="row center"><button class="btn btn-primary" id="more">Give me 5 more bytes</button><a class="btn" href="#/explore">Browse everything</a></div>
      </div>`;
      $('#more').addEventListener('click', () => {
        const extra = pick(rankUnread(new Set(ids)), 5);
        if (!extra.length) return toast("You've read everything. Impressive!");
        Store.state.stack.ids.push(...extra);
        Store.save();
        renderToday();
      });
      return;
    }
    const item = BY_ID.get(ids[viewer.story]);
    const ideas = ideasOf(item);
    const saved = Store.savedFor(item.id);
    wrap.innerHTML = `
      <div class="stack-progress">${ids.map((id, i) => `<i class="${Store.isRead(id) ? 'read' : ''} ${i === viewer.story ? 'cur' : ''}"></i>`).join('')}</div>
      <div class="card-stage"><div class="card-3d" id="card3d">
      <article class="idea-card" id="card" style="${tint(item)}" tabindex="0" aria-label="Story ${viewer.story + 1} of ${ids.length}">
        <div class="card-top">${topicChip(item)} ${gccBadge(item)} ${aiBadge(item)}<span class="spacer"></span><span class="card-mins">${readMins(item)} min</span></div>
        <h2 class="card-title">${esc(item.title)}</h2>
        <div class="card-meta">${esc(item.source)} · ${ago(item.published)}</div>
        <p class="card-idea">${esc(ideas[viewer.idea])}</p>
        ${item.takeaway && viewer.idea === ideas.length - 1 ? `<p class="takeaway"><b>Why it matters</b> ${esc(item.takeaway)}</p>` : ''}
        <div class="card-foot">
          ${ideas.length > 1 ? `<span class="dots">${ideas.map((_, i) => `<i class="${i === viewer.idea ? 'on' : ''}"></i>`).join('')}</span>` : '<span></span>'}
          <a href="${esc(item.link)}" target="_blank" rel="noopener" class="read-link">Full story ↗</a>
        </div>
      </article></div></div>
      <div class="card-actions">
        <button class="btn" id="prev" ${viewer.story === 0 && viewer.idea === 0 ? 'disabled' : ''} aria-label="Previous">←</button>
        <button class="btn ${saved ? 'btn-saved' : ''}" id="save">${saved ? '★ Saved' : '☆ Save'}</button>
        <button class="btn" id="share">Share</button>
        <button class="btn btn-primary grow" id="next">${viewer.idea < ideas.length - 1 ? 'Next point →' : 'Got it ✓'}</button>
      </div>
      <p class="hint muted small">Tip: swipe left for next, right to save. Keyboard: ← → and S.</p>`;

    $('#next').addEventListener('click', next);
    $('#prev').addEventListener('click', prev);
    $('#save').addEventListener('click', () => openSave(item, renderCard));
    $('#share').addEventListener('click', () => share(item));
    bindSwipe($('#card'));
    bindTilt($('#card3d'));
  }

  // Immersive design: the card tilts towards the mouse (PC only; off when the device asks for less motion).
  function bindTilt(el) {
    if (!el || !matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.addEventListener('pointermove', (e) => {
      if (document.documentElement.dataset.skin !== 'immersive' || e.buttons) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 10}deg`);
      el.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -8}deg`);
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  }

  function next() {
    const ids = Store.state.stack.ids;
    const item = BY_ID.get(ids[viewer.story]);
    if (viewer.idea < ideasOf(item).length - 1) { viewer.idea++; return renderCard(); }
    if (Store.markRead(item.id)) {
      if (Store.todayCount() === Store.state.prefs.goal) toast(`🎯 Daily goal reached! Streak: ${Store.streak()} days`);
    }
    viewer.story = ids.findIndex((id, i) => i > viewer.story && !Store.isRead(id));
    viewer.idea = 0;
    renderChrome('today');
    const goal = Store.state.prefs.goal;
    if ($('#kpiDone')) $('#kpiDone').textContent = `${Store.todayCount()}/${goal}`;
    if ($('#meter')) $('#meter').style.width = `${Math.min(100, (Store.todayCount() / goal) * 100)}%`;
    renderCard();
  }

  function prev() {
    if (viewer.idea > 0) { viewer.idea--; return renderCard(); }
    if (viewer.story > 0) { viewer.story--; viewer.idea = ideasOf(BY_ID.get(Store.state.stack.ids[viewer.story])).length - 1; renderCard(); }
  }

  function bindSwipe(el) {
    let x0 = null, dx = 0;
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('a')) return; x0 = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      el.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
      el.dataset.swipe = dx > 60 ? 'save' : dx < -60 ? 'next' : '';
    });
    const end = () => {
      if (x0 === null) return;
      x0 = null;
      el.style.transform = '';
      el.dataset.swipe = '';
      if (dx < -90) next();
      else if (dx > 90) $('#save').click();
      else if (Math.abs(dx) < 5) next(); // a tap advances like turning a page
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { x0 = null; el.style.transform = ''; });
  }

  document.addEventListener('keydown', (e) => {
    if (parseHash().route !== 'today' || document.querySelector('dialog[open]') || /input|textarea|select|button|^a$/i.test(e.target.tagName)) return;
    if (!$('#card')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key.toLowerCase() === 's') $('#save').click();
  });

  /* ---------- Explore ---------- */
  const explore = { limit: 40 };

  function renderExplore(params) {
    const region = params.get('region') || 'all';
    const topic = params.get('topic') || 'all';
    const q = (params.get('q') || '').toLowerCase();
    const unread = params.get('unread') === '1';

    let items = FEED.items.filter((i) => {
      if (region === 'gcc' && !i.gcc) return false;
      if (region === 'global' && i.gcc) return false;
      if (COUNTRIES[region] && !i.countries.includes(region)) return false;
      if (topic !== 'all' && !i.topics.includes(topic)) return false;
      if (unread && Store.isRead(i.id)) return false;
      if (q && !(i.title + ' ' + i.summary + ' ' + i.source).toLowerCase().includes(q)) return false;
      return true;
    });
    const total = items.length;
    items = items.slice(0, explore.limit);

    const link = (k, v) => { const p = new URLSearchParams(params); if (v === 'all' || v === '') p.delete(k); else p.set(k, v); const s = p.toString(); return `#/explore${s ? '?' + s : ''}`; };
    const regions = [['all', '🌐 All'], ['gcc', '🌍 GCC'], ...Object.entries(COUNTRIES).map(([c, v]) => [c, `${v.flag} ${v.name}`]), ['global', '🗺️ Rest of world']];
    const topics = [['all', 'All topics'], ...Object.entries(TOPICS).map(([k, v]) => [k, `${v.emoji} ${v.label}`])];

    const days = [];
    items.forEach((i) => {
      const d = new Date(i.published), dk = dayKey(d);
      if (!days.length || days[days.length - 1].key !== dk) {
        const label = dk === dayKey() ? 'Today' : dk === dayKey(new Date(Date.now() - 864e5)) ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
        days.push({ key: dk, label, items: [] });
      }
      days[days.length - 1].items.push(i);
    });
    const row = (i) => {
      const t = primaryTopic(i);
      return `<button class="row-item ${Store.isRead(i.id) ? 'is-read' : ''}" data-open="${i.id}" style="${tint(i)}">
        <span class="row-swatch" aria-hidden="true">${t.emoji}</span>
        <span class="row-main"><span class="row-title">${esc(i.title)}</span>
          <span class="row-meta">${esc(i.source)} · ${ago(i.published)} ${i.countries.length ? '· ' + flags(i) : i.gcc ? '· 🌍 GCC' : ''}</span></span>
        <span class="row-side">${Store.savedFor(i.id) ? '★' : ''}${Store.isRead(i.id) ? '<small>✓</small>' : ''}</span>
      </button>`;
    };
    const rows = days.map((d) => `<section class="day"><h4 class="day-head">${d.label}</h4><div class="list">${d.items.map(row).join('')}</div></section>`).join('');

    const opts = (list, cur) => list.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('');
    $('#view').innerHTML = `
      <form class="filterbar" role="search" onsubmit="return false">
        <label class="search"><span class="skip">Search stories</span><input id="q" type="search" placeholder="Search stories, e.g. Fortinet, NCA…" value="${esc(params.get('q') || '')}" /></label>
        <div class="filter-row">
          <span class="filter-label">Filter</span>
          <select id="fRegion" aria-label="Region">${opts(regions, region)}</select>
          <select id="fTopic" aria-label="Topic">${opts(topics, topic)}</select>
        </div>
        <div class="filter-tail">
          <label class="toggle"><input type="checkbox" id="unread" ${unread ? 'checked' : ''}/> Unread only</label>
          <a class="clear-link" href="#/explore">Clear</a>
        </div>
      </form>
      <p class="count-line">${total} ${total === 1 ? 'story' : 'stories'}</p>
      <div class="days">${rows || '<div class="empty">No stories match these filters.</div>'}</div>
      ${total > items.length ? '<div class="row center" style="margin-top:16px"><button class="btn" id="moreRows">Show more</button></div>' : ''}`;

    bindMini();
    let tmr;
    $('#q').addEventListener('input', (e) => {
      clearTimeout(tmr);
      tmr = setTimeout(() => { history.replaceState(null, '', link('q', e.target.value.trim())); explore.limit = 40; render(true); }, 300);
    });
    $('#unread').addEventListener('change', (e) => { location.hash = link('unread', e.target.checked ? '1' : ''); });
    $('#fRegion').addEventListener('change', (e) => { location.hash = link('region', e.target.value); });
    $('#fTopic').addEventListener('change', (e) => { location.hash = link('topic', e.target.value); });
    const more = $('#moreRows');
    if (more) more.addEventListener('click', () => { explore.limit += 40; render(); });
  }

  /* ---------- Reader ---------- */
  function openReader(id) {
    const item = BY_ID.get(id) || (Store.savedFor(id) || {}).item;
    if (!item) return;
    const saved = Store.savedFor(id);
    $('#readerBody').innerHTML = `
      <header class="reader-head" style="${tint(item)}">
        <div class="card-top">${item.topics.map((k) => `<span class="chip-topic">${TOPICS[k].emoji} ${esc(TOPICS[k].label)}</span>`).join('')} ${gccBadge(item)} ${aiBadge(item)}<button class="reader-close" data-close aria-label="Close">✕</button></div>
        <h2>${esc(item.title)}</h2>
        <div class="card-meta">${esc(item.source)} · ${new Date(item.published).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</div>
      </header>
      <div class="reader-ideas">
        ${ideasOf(item).map((txt, n) => `<div class="idea"><span class="idea-n">Key point ${n + 1}</span><p>${esc(txt)}</p></div>`).join('')}
        ${item.takeaway ? `<div class="idea takeaway-box"><span class="idea-n">Why it matters</span><p>${esc(item.takeaway)}</p></div>` : ''}
        ${saved && saved.note ? `<div class="idea note"><span class="idea-n">Your note</span><p>${esc(saved.note)}</p></div>` : ''}
      </div>
      <footer class="row wrap">
        <a class="btn btn-primary" href="${esc(item.link)}" target="_blank" rel="noopener">Read full story ↗</a>
        <button class="btn ${saved ? 'btn-saved' : ''}" id="rSave">${saved ? '★ Saved' : '☆ Save'}</button>
        <button class="btn" id="rShare">Share</button>
        <button class="btn" id="rMd">Copy as Markdown</button>
      </footer>`;
    const dlg = $('#reader');
    dlg.showModal();
    if (Store.markRead(item.id)) renderChrome(parseHash().route);
    $('[data-close]', dlg).addEventListener('click', () => dlg.close());
    $('#rSave').addEventListener('click', () => openSave(item, () => openReader(id)));
    $('#rShare').addEventListener('click', () => share(item));
    $('#rMd').addEventListener('click', () => copy(itemMarkdown(item, saved && saved.note), 'Markdown copied — paste it into your post'));
  }
  $('#reader').addEventListener('click', (e) => { if (e.target.id === 'reader') e.target.close(); });
  $('#reader').addEventListener('close', () => { if (parseHash().route !== 'today') render(); });

  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || 'Copied'); }
    catch (e) { toast('Copy failed — your browser blocked clipboard access'); }
  }

  async function share(item) {
    const text = `${item.title}\n\n${ideasOf(item)[0]}`;
    if (navigator.share) { try { await navigator.share({ title: item.title, text, url: item.link }); } catch (e) { /* cancelled */ } }
    else copy(`${text}\n${item.link}`, 'Link and summary copied');
  }

  /* ---------- Save dialog ---------- */
  function openSave(item, after) {
    const existing = Store.savedFor(item.id);
    const dlg = $('#saveDlg');
    const current = existing ? existing.stash : item.gcc ? 'gcc' : 'later';
    $('#stashPick').innerHTML = Store.state.stashes.map((s) => `<label class="stash-opt"><input type="radio" name="stash" value="${s.id}" ${s.id === current ? 'checked' : ''}/><span>${s.emoji} ${esc(s.name)}</span></label>`).join('')
      + (existing ? '<label class="stash-opt remove"><input type="radio" name="stash" value="__remove"/><span>🗑️ Remove from stashes</span></label>' : '');
    $('#newStash').value = '';
    $('#saveNote').value = existing ? existing.note : '';
    dlg.returnValue = '';
    dlg.showModal();
    dlg.addEventListener('close', function onClose() {
      dlg.removeEventListener('close', onClose);
      if (dlg.returnValue !== 'ok') return;
      const name = $('#newStash').value.trim();
      let stash = ($('input[name=stash]:checked', dlg) || {}).value || 'later';
      if (stash === '__remove') { Store.unsave(item.id); toast('Removed from stashes'); }
      else {
        if (name) stash = Store.addStash(name);
        Store.saveItem(item, stash, $('#saveNote').value.trim());
        toast(`Saved to ${Store.state.stashes.find((s) => s.id === stash).name}`);
      }
      renderChrome(parseHash().route);
      if (after) after();
    });
  }

  /* ---------- Stashes ---------- */
  function renderStashes(params) {
    const st = Store.state;
    const counts = {};
    Object.values(st.saved).forEach((v) => { counts[v.stash] = (counts[v.stash] || 0) + 1; });
    const sel = st.stashes.some((s) => s.id === params.get('s')) ? params.get('s') : (st.stashes.find((s) => counts[s.id]) || st.stashes[0]).id;
    const list = Object.values(st.saved).filter((v) => v.stash === sel).sort((a, b) => b.savedAt - a.savedAt);
    const stash = st.stashes.find((s) => s.id === sel);
    const builtIn = ['later', 'gcc', 'blog'].includes(sel);

    $('#view').innerHTML = `
      <div class="chips scroll">${st.stashes.map((s) => `<a class="chip ${s.id === sel ? 'on' : ''}" href="#/stashes?s=${s.id}">${s.emoji} ${esc(s.name)} <em>${counts[s.id] || 0}</em></a>`).join('')}</div>
      <div class="row wrap stash-tools">
        <button class="btn" id="mdExport" ${list.length ? '' : 'disabled'}>⬇ Export as Markdown</button>
        <button class="btn" id="mdCopy" ${list.length ? '' : 'disabled'}>Copy as Markdown</button>
        ${builtIn ? '' : '<button class="btn danger" id="delStash">Delete stash</button>'}
      </div>
      <div class="saved-list">${list.length ? list.map((v) => {
        const i = v.item, t = primaryTopic(i);
        return `<article class="saved" style="${tint(i)}">
          <div class="saved-head"><button class="saved-title" data-open="${i.id}">${t.emoji} ${esc(i.title)}</button></div>
          <div class="saved-body">
            <div class="row-meta">${esc(i.source)} · ${ago(i.published)} ${i.countries.length ? '· ' + flags(i) : ''} · saved ${ago(new Date(v.savedAt).toISOString())}</div>
            <textarea class="note" data-note="${i.id}" rows="2" placeholder="Add your take: why does it matter, what would you do?">${esc(v.note)}</textarea>
            <div class="row wrap">
              <select data-move="${i.id}" aria-label="Move to stash">${st.stashes.map((s) => `<option value="${s.id}" ${s.id === v.stash ? 'selected' : ''}>${s.emoji} ${esc(s.name)}</option>`).join('')}</select>
              <a class="btn sm" href="${esc(i.link)}" target="_blank" rel="noopener">Source ↗</a>
              <button class="btn sm danger" data-unsave="${i.id}">Remove</button>
            </div>
          </div>
        </article>`;
      }).join('') : `<div class="empty">Nothing in <b>${esc(stash.name)}</b> yet. Tap <b>☆ Save</b> on any story to stash it here.</div>`}</div>`;

    bindMini();
    $$('[data-note]').forEach((ta) => ta.addEventListener('change', () => { st.saved[ta.dataset.note].note = ta.value.trim(); Store.save(); toast('Note saved'); }));
    $$('[data-move]').forEach((s) => s.addEventListener('change', () => { st.saved[s.dataset.move].stash = s.value; Store.save(); render(); }));
    $$('[data-unsave]').forEach((b) => b.addEventListener('click', () => { Store.unsave(b.dataset.unsave); renderChrome('stashes'); render(); }));
    const md = () => `# ${stash.name}\n\n_Curated with CyberDigest on ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}_\n\n` + list.map((v) => itemMarkdown(v.item, v.note)).join('\n');
    $('#mdExport').addEventListener('click', () => download(`${stash.name.replace(/[^\w-]+/g, '-').toLowerCase()}-${dayKey()}.md`, md()));
    $('#mdCopy').addEventListener('click', () => copy(md(), 'Stash copied as Markdown'));
    const del = $('#delStash');
    if (del) del.addEventListener('click', () => { if (confirm(`Delete "${stash.name}"? Saved stories move to Read later.`)) { Store.removeStash(sel); location.hash = '#/stashes'; } });
  }

  /* ---------- Settings & onboarding ---------- */
  function interestsHTML() {
    const p = Store.state.prefs;
    return `
      <h3>Regions to prioritise</h3>
      <div class="chips">${Object.entries(COUNTRIES).map(([c, v]) => `<label class="chip toggle-chip"><input type="checkbox" name="country" value="${c}" ${p.countries.includes(c) ? 'checked' : ''}/>${v.flag} ${v.name}</label>`).join('')}</div>
      <h3>Topics you care about</h3>
      <div class="chips">${Object.entries(TOPICS).filter(([k]) => k !== 'general').map(([k, v]) => `<label class="chip toggle-chip"><input type="checkbox" name="topic" value="${k}" ${p.topics.includes(k) ? 'checked' : ''}/>${v.emoji} ${v.label}</label>`).join('')}</div>
      <h3>Daily goal</h3>
      <div class="chips">${[5, 8, 10, 15, 20].map((n) => `<label class="chip toggle-chip"><input type="radio" name="goal" value="${n}" ${p.goal === n ? 'checked' : ''}/>${n} bytes</label>`).join('')}</div>`;
  }

  function readInterests(root) {
    Store.setPref('countries', $$('input[name=country]:checked', root).map((i) => i.value));
    Store.setPref('topics', $$('input[name=topic]:checked', root).map((i) => i.value));
    const g = $('input[name=goal]:checked', root);
    if (g) Store.setPref('goal', +g.value);
    Store.state.stack = { day: '', ids: [] }; // rebuild today's stack with the new interests
    Store.save();
  }

  function renderSettings() {
    const p = Store.state.prefs;
    const bySource = {};
    FEED.items.forEach((i) => { bySource[i.feed] = (bySource[i.feed] || 0) + 1; });
    const readTotal = Object.keys(Store.state.read).length;
    $('#view').innerHTML = `<div class="settings-grid">
      <section class="panel full" id="interests">${interestsHTML()}
        <div class="row end"><button class="btn btn-primary" id="saveInterests">Save interests</button></div></section>
      <section class="panel">
        <h3>Design</h3>
        <div class="chips">${[['immersive', 'Immersive 3D (default)'], ['flat', 'Flat (sustainable)']].map(([v, l]) => `<label class="chip toggle-chip"><input type="radio" name="skin" value="${v}" ${(p.skin || 'immersive') === v ? 'checked' : ''}/>${l}</label>`).join('')}</div>
        <h3>Appearance</h3>
        <div class="chips">${['system', 'light', 'dark'].map((t) => `<label class="chip toggle-chip"><input type="radio" name="theme" value="${t}" ${p.theme === t ? 'checked' : ''}/>${t[0].toUpperCase() + t.slice(1)}</label>`).join('')}</div>
      </section>
      <section class="panel">
        <h3>Your data</h3>
        <p class="muted small">Everything (reading history, stashes, notes) is stored only in this browser. ${readTotal} stories read, ${Object.keys(Store.state.saved).length} saved.</p>
        <div class="row wrap">
          <button class="btn" id="backup">⬇ Backup (JSON)</button>
          <label class="btn">⬆ Restore<input type="file" id="restore" accept="application/json" hidden /></label>
          <button class="btn danger" id="resetRead">Reset history</button>
        </div>
      </section>
      <section class="panel full">
        <h3>News sources</h3>
        <p class="muted small">Refreshed automatically every few hours by a GitHub Action. Last update: ${FEED.generated ? new Date(FEED.generated).toLocaleString() : 'never'}.</p>
        <ul class="sources">${FEED.sources.map((s) => `<li><span>${s.region === 'gcc' ? '🌍' : '🌐'} ${esc(s.name)}</span><em>${bySource[s.name] || 0}</em></li>`).join('')}</ul>
      </section></div>`;
    $('#saveInterests').addEventListener('click', () => { readInterests($('#interests')); toast("Interests saved. Today's stack was rebuilt."); renderChrome('settings'); });
    $$('input[name=theme]').forEach((r) => r.addEventListener('change', () => { Store.setPref('theme', r.value); applyTheme(); }));
    $$('input[name=skin]').forEach((r) => r.addEventListener('change', () => { Store.setPref('skin', r.value); Store.setPref('skinChosen', true); applyTheme(); toast(r.value === 'immersive' ? 'Immersive 3D design on' : 'Flat design on'); }));
    $('#backup').addEventListener('click', () => download(`cyberdigest-backup-${dayKey()}.json`, Store.exportJSON(), 'application/json'));
    $('#restore').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { Store.importJSON(await f.text()); applyTheme(); toast('Backup restored'); render(); }
      catch (err) { toast(`Restore failed: ${err.message}`); }
    });
    $('#resetRead').addEventListener('click', () => {
      if (!confirm('Clear reading history and streak? Stashes are kept.')) return;
      Object.assign(Store.state, { read: {}, days: {}, stack: { day: '', ids: [] } });
      Store.save();
      toast('Reading history cleared');
      render();
    });
  }

  function showOnboarding() {
    const form = $('#onboardForm');
    form.innerHTML = `
      <div class="onboard-hero">
        <h2>Welcome to CyberDigest</h2>
        <p>Every day you get a short stack of cyber security bytes: news stories cut down to 2–3 key points each. GCC news is boosted by default. Pick what you care about. You can change it later in Settings.</p></div>
      ${interestsHTML()}
      <div class="row end"><button class="btn btn-primary" value="ok">Start reading →</button></div>`;
    const dlg = $('#onboard');
    dlg.showModal();
    dlg.addEventListener('close', () => { readInterests(form); Store.setPref('onboarded', true); render(); }, { once: true });
  }

  function applyTheme() {
    const { theme, skin } = Store.state.prefs;
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    if (skin === 'flat') delete root.dataset.skin;
    else root.dataset.skin = 'immersive';
  }

  // A ?skin=flat or ?skin=immersive link switches design (handy for comparing the two).
  const skinParam = new URLSearchParams(location.search).get('skin');
  if (skinParam === 'flat' || skinParam === 'immersive') { Store.setPref('skin', skinParam); Store.setPref('skinChosen', true); }

  $('#btnTheme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    Store.setPref('theme', dark ? 'light' : 'dark');
    applyTheme();
  });

  /* ---------- router ---------- */
  function render(keepFocus) {
    const { route, params } = parseHash();
    renderChrome(route);
    ({ today: renderToday, explore: renderExplore, stashes: renderStashes, settings: renderSettings })[route](params);
    if (!keepFocus) window.scrollTo(0, 0);
    if (keepFocus) { const q = $('#q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }
  window.addEventListener('hashchange', () => { explore.limit = 40; render(); });

  async function load() {
    $('#view').innerHTML = '<div class="empty">Loading today\'s news…</div>';
    try {
      const res = await fetch('data/feed.json', { cache: 'no-cache' });
      FEED = await res.json();
    } catch (e) {
      toast('Could not load the news feed. Showing saved stories only.');
    }
    BY_ID = new Map(FEED.items.map((i) => [i.id, i]));
    render();
    renderFooter();
    if (!Store.state.prefs.onboarded) showOnboarding();
  }

  applyTheme();
  load();
})();
