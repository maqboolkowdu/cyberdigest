/* CyberDigest — local state (preferences, reading history, stashes). Everything stays in this browser. */
(function () {
  const KEY = 'cyberdigest:v1';
  const DEFAULT = {
    prefs: { topics: [], countries: ['AE', 'SA', 'QA', 'OM', 'BH', 'KW'], goal: 8, theme: 'system', skin: 'immersive', skinChosen: false, onboarded: false },
    read: {},        // storyId -> timestamp
    days: {},        // 'YYYY-MM-DD' -> stories read that day
    saved: {},       // storyId -> { stash, note, savedAt, item }
    stashes: [
      { id: 'later', name: 'Read later', emoji: '🔖' },
      { id: 'gcc', name: 'GCC watch', emoji: '🌍' },
      { id: 'blog', name: 'Bytes for my website', emoji: '✍️' },
    ],
    stack: { day: '', ids: [] },
  };

  let state;
  try { state = Object.assign(structuredClone(DEFAULT), JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { state = structuredClone(DEFAULT); }
  state.prefs = Object.assign({}, DEFAULT.prefs, state.prefs);
  const blog = state.stashes.find((s) => s.id === 'blog' && s.name === 'Ideas for my website');
  if (blog) blog.name = 'Bytes for my website'; // renamed when "ideas" became "bytes"
  if (!state.prefs.skinChosen) state.prefs.skin = 'immersive'; // 3D is the default unless the user picked a design

  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  const Store = {
    get state() { return state; },
    save,
    setPref(k, v) { state.prefs[k] = v; save(); },

    isRead: (id) => !!state.read[id],
    markRead(id) {
      if (state.read[id]) return false;
      state.read[id] = Date.now();
      const d = CD.dayKey();
      state.days[d] = (state.days[d] || 0) + 1;
      save();
      return true;
    },
    todayCount: () => state.days[CD.dayKey()] || 0,
    streak() {
      let n = 0; const d = new Date();
      if (!state.days[CD.dayKey(d)]) d.setDate(d.getDate() - 1); // today not started yet doesn't break the streak
      while (state.days[CD.dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },

    savedFor: (id) => state.saved[id],
    saveItem(item, stash, note) {
      state.saved[item.id] = { stash, note: note || '', savedAt: Date.now(), item };
      save();
    },
    unsave(id) { delete state.saved[id]; save(); },
    addStash(name) {
      const id = 's' + Date.now().toString(36);
      state.stashes.push({ id, name, emoji: '📁' });
      save();
      return id;
    },
    removeStash(id) {
      state.stashes = state.stashes.filter((s) => s.id !== id);
      for (const [k, v] of Object.entries(state.saved)) if (v.stash === id) v.stash = 'later';
      if (!state.stashes.some((s) => s.id === 'later')) state.stashes.unshift(structuredClone(DEFAULT.stashes[0]));
      save();
    },

    exportJSON: () => JSON.stringify({ app: 'CyberDigest', version: 1, exported: new Date().toISOString(), state }, null, 2),
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data.state || !data.state.prefs) throw new Error('Not a CyberDigest backup');
      state = Object.assign(structuredClone(DEFAULT), data.state);
      save();
    },
    reset() { state = structuredClone(DEFAULT); save(); },
  };

  window.Store = Store;
})();
