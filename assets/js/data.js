/* CyberDigest — static reference data: topics, GCC countries, helpers.
   `tint` is the flat block colour used on cards (always paired with dark ink text). */
(function () {
  const TOPICS = {
    ransomware:      { label: 'Ransomware',          emoji: '🔐', tint: '#ff7a59' },
    vulnerabilities: { label: 'Vulnerabilities',     emoji: '🩹', tint: '#ffc93c' },
    breaches:        { label: 'Data breaches',       emoji: '💧', tint: '#f4a7c0' },
    'threat-intel':  { label: 'Threat intel & APT',  emoji: '🎯', tint: '#b9a6ff' },
    malware:         { label: 'Malware',             emoji: '🦠', tint: '#7ed957' },
    phishing:        { label: 'Phishing & fraud',    emoji: '🎣', tint: '#5fd3e0' },
    identity:        { label: 'Identity & access',   emoji: '🪪', tint: '#7fb2ff' },
    cloud:           { label: 'Cloud & SaaS',        emoji: '☁️', tint: '#a8dcff' },
    network:         { label: 'Network & edge',      emoji: '🛜', tint: '#3ec5a8' },
    'ot-ics':        { label: 'OT & critical infra', emoji: '🏭', tint: '#e3b77c' },
    ai:              { label: 'AI security',         emoji: '🤖', tint: '#c9c2ff' },
    policy:          { label: 'Policy & regulation', emoji: '⚖️', tint: '#cfd4dc' },
    education:       { label: 'Education sector',    emoji: '🎓', tint: '#c6ec6b' },
    general:         { label: 'General',             emoji: '📰', tint: '#2aa8e0' },
  };

  const COUNTRIES = {
    AE: { name: 'UAE',          flag: '🇦🇪' },
    SA: { name: 'Saudi Arabia', flag: '🇸🇦' },
    QA: { name: 'Qatar',        flag: '🇶🇦' },
    OM: { name: 'Oman',         flag: '🇴🇲' },
    BH: { name: 'Bahrain',      flag: '🇧🇭' },
    KW: { name: 'Kuwait',       flag: '🇰🇼' },
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function ago(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  const readMins = (item) => Math.max(1, Math.round(((item.ideas || []).join(' ').split(/\s+/).length + 15) / 200));

  window.CD = { TOPICS, COUNTRIES, esc, dayKey, ago, readMins };
})();
