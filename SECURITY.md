# Security assessment: welcome tour, email sign-in and usage stats

Reviewed before deployment. This covers the browser code (`assets/js/auth.js`, `track.js`, `welcome.js`, `app.js`), the page shell (`index.html`, `sw.js`), the feed builder, and the database rules in `supabase/setup.sql`.

## How it was tested

- **Database rules:** run on a local PostgreSQL 16 set up like Supabase (`anon` and `authenticated` roles, `auth.uid()`, Supabase's default table grants), then attacked as the public key. 16 checks, all as expected.
- **Browser:** 61 automated checks in Chromium against a mock of the Supabase Auth and REST APIs: the site with no backend, the full sign-in flow, "keep me signed in" on and off, token refresh, revoked tokens, consent on and off, Do Not Track, returning visitors, hostile feed content, and phone and PC layouts. All passed.

## Findings and fixes

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Story links from RSS feeds (and from restored backups) were used without checking. A compromised feed could publish a `javascript:` link that runs code when clicked, which matters more now that the browser holds a sign-in session. | High | **Fixed.** The feed builder drops non-http(s) links, and the app re-checks every link with `safeUrl()` before showing, sharing or exporting it. Links also get `rel="noopener noreferrer"`. |
| 2 | Inline scripts and an inline `onsubmit` handler prevented a strict Content Security Policy. | Medium | **Fixed.** The scripts moved to files, and the CSP allows only this site's scripts (`script-src 'self'`) and only Supabase for network calls. |
| 3 | The welcome overlay's `display: flex` overrode `[hidden]`, so after the tour an invisible layer blocked every click. Found by the tests. | High (bug) | **Fixed** (`.welcome[hidden] { display: none }`). |
| 4 | Payload size check used `pg_column_size`, which measures compressed size. | Low | **Fixed.** It now checks the actual text length. |

## Design decisions that keep data safe

- **Insert-only events table.** The public key can only `INSERT` six named columns. There are no `SELECT`, `UPDATE` or `DELETE` grants or policies, so nobody can read other people's events through the API.
- **The database fills in the trusted fields.** A trigger sets `user_id` (from the verified login token) and `created_at`, so the browser can't fake who or when.
- **Allow-listed event names**, flat payloads of at most 2 KB, short route and version strings, and at most 120 events per browser per minute.
- **Private reports.** The `insights` views live in a schema the Data API doesn't expose, and grants are revoked from `anon` and `authenticated`. The `readers` view (emails) is only visible to the project owner in the dashboard.
- **Sign-in.** One-time codes come from Supabase Auth. There are no passwords to leak or store. Supabase's rate limits and short code expiry stop code guessing (see the setup guide). The first sign-in creates the account, so the form doesn't reveal which emails already have accounts.
- **Sessions.** "Keep me signed in" uses `localStorage`; otherwise `sessionStorage`, which is cleared when the tab closes. Tokens refresh automatically. A revoked or reused refresh token signs the visitor out. Sign-out also revokes the session on the server.
- **Privacy by default.**
  - Nothing is sent before the visitor sees the notice.
  - The switch starts off when the browser sends Do Not Track or Global Privacy Control.
  - Events never contain story titles, links, search text, notes or the email address.
  - Returning visitors are asked once.
- **The service worker never caches** Supabase responses (only same-origin files).

## Remaining risks (accepted or for the owner)

| Risk | Why it remains | What to do |
|---|---|---|
| Tokens in `localStorage` could be stolen by an XSS bug | Normal for single-page apps with no server | The strict CSP and escaping make XSS unlikely; keep `script-src 'self'`. |
| Event spam with rotating browser ids | Anyone can call the public insert endpoint | Rate limit per id, size limits and retention; watch `feature_usage_30d` for spikes. |
| Code-request spam (emails to strangers) | Sign-up is open by design | Keep Supabase email rate limits; optionally turn on CAPTCHA (needs a small change). |
| Clickjacking | GitHub Pages can't send `frame-ancestors` headers | Low impact: no one-click sensitive actions. A host with custom headers (for example Cloudflare in front of a custom domain) can add `X-Frame-Options: DENY`. |
| CSP allows any `*.supabase.co` | The project URL isn't known until setup | Narrow it to your project URL (setup guide, Step 6). |
