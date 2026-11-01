# Switching On Sign-in and Usage Stats (Supabase)

> Connect CyberDigest to a free Supabase project so visitors can sign in with a **one-time code sent to their email** (no password), and so you can see **how people use the site**: where they leave the welcome tour, what they read, and which design they pick.

---

## 1. Description

CyberDigest is a static site on GitHub Pages, so it has no server of its own. **Supabase** fills that gap with two services:

| Supabase part | What CyberDigest uses it for |
|---|---|
| **Auth** | Emails a 6-digit code, checks it, and keeps the visitor signed in (or only for this tab, if they untick *Keep me signed in*). |
| **Database** | Stores small, anonymous usage events (`page_view`, `byte_read`, `welcome_step`, …) in one table that visitors can only *add to*, never read. |

Until you paste your project details into `assets/js/config.js`, the site behaves exactly as before: no sign-in step, no usage stats, no extra network calls.

## 2. Purpose

| You want to know… | Report to open |
|---|---|
| Where visitors give up in the welcome tour | `insights.welcome_funnel` |
| How many people read each day, and how much | `insights.daily_activity` |
| Which features are used or ignored | `insights.feature_usage_30d` |
| Which topics people actually read | `insights.topics_read_30d` |
| Flat or Immersive 3D? Light or dark? | `insights.design_choices` |
| Do people finish signing in? | `insights.signin_daily` |
| Who your signed-in readers are | `insights.readers` (contains emails: keep private) |

## 3. Scenario

> *A week after launch you open Supabase → Table Editor → `insights.welcome_funnel`:*
>
> | step | step_name | visitors |
> |---|---|---|
> | 1 | welcome | 240 |
> | 2 | interests | 198 |
> | 3 | daily goal | 190 |
> | … | … | … |
> | 6 | sign in (optional) | 160 |
> | 99 | finished tour | 152 |
>
> The biggest drop is between steps 1 and 2. You shorten the home page text and check again next week. In `feature_usage_30d` you see that `export` is rarely used but `byte_saved` is popular, so you put your next effort into stashes rather than exports.

---

## 4. Step by step (about 20 minutes)

> Supabase renames dashboard menus now and then. If a menu name below doesn't match exactly, look for the nearest match in the same section.

### Step 1: Create the project

1. Sign up at **https://supabase.com** (free plan) and click **New project**.
2. **Name:** `cyberdigest`. **Database password:** let it generate one and keep it in your password manager. **Region:** the closest one to your readers.
3. Wait about 2 minutes for it to start.

### Step 2: Create the table and reports

1. Open **SQL Editor → New query**.
2. Paste the whole of [`supabase/setup.sql`](../supabase/setup.sql) and click **Run**. You should see *Success. No rows returned*.

This creates the `events` table with row-level security (visitors can only add rows), an allow-list of event names, size and rate limits, and the private `insights` reports.

### Step 3: Set up email sending (required)

Supabase's built-in email sender is only for testing:
- it **only delivers to members of your Supabase team** (you), so visitors never get a code;
- it sends **about 2 emails per hour for the whole project** ("Too many sign-in emails were sent recently");
- **email templates are locked** until you use your own sender, so the email shows a link, not a code.

Use your own SMTP service. **Brevo** is the easiest without a domain:

| Service | Free tier | Notes |
|---|---|---|
| **Brevo** (recommended to start) | 300 emails/day | No domain needed; verify your sender address by email |
| **Resend** | 3,000 emails/month | Needs your own domain (a few DNS records) |
| **Gmail** | ~500/day | Needs an *app password*, which is not available on accounts that use passkeys or Advanced Protection |

**Brevo, step by step**
1. Sign up at **https://www.brevo.com** (free plan).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: name `CyberDigest`, email = your address. Click the confirmation link Brevo emails you.
3. **SMTP & API → SMTP** tab: note the **SMTP server** (`smtp-relay.brevo.com`), **Port** (`587`) and **Login** (looks like `xxxx@smtp-brevo.com`). Click **Generate a new SMTP key**, name it `Supabase`, and copy it (it is shown once).
4. In Supabase, open **Authentication → Emails → SMTP Settings**, switch on **Enable custom SMTP** and fill in:

   | Supabase field | Value |
   |---|---|
   | Sender email | the address you verified in Brevo |
   | Sender name | `CyberDigest` |
   | Host | `smtp-relay.brevo.com` |
   | Port | `587` |
   | Username | the Brevo **Login** (`…@smtp-brevo.com`) |
   | Password | the Brevo **SMTP key** |

5. **Authentication → Rate Limits**: raise **Rate limit for sending emails** to about `30` per hour. This setting is only editable with custom SMTP.
6. Tell the site who sends the codes: in `assets/js/config.js`, set `emailSender` to, for example, `'CyberDigest <you@example.com>'`.

> If you use a free address such as Gmail as the sender, some codes may land in spam, because the email isn't sent by Gmail's own servers. When you have your own domain, verify it in Brevo and send from `no-reply@yourdomain.com` for the best delivery.

### Step 4: Send a code, not a link

By default Supabase emails a clickable "magic link". CyberDigest asks for the **code**, so the email must contain it.

Open **Authentication → Emails → Templates**. Edit **both** *Magic Link* and *Confirm signup* (new readers get the second one). Set:

**Subject:** `Your CyberDigest code: {{ .Token }}`

**Body:**
```html
<h2>Your CyberDigest sign-in code</h2>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Enter this code in CyberDigest. It expires in 10 minutes.</p>
<p>If you didn't ask for it, you can ignore this email. Nobody can sign in without the code.</p>
```

### Step 5: Auth settings

| Where | Setting | Value |
|---|---|---|
| Authentication → Sign In / Providers → Email | Enable Email provider | **On** |
| | Allow new users to sign up | **On** (first sign-in creates the account) |
| | Email OTP expiration | **600** seconds (10 minutes) |
| | Email OTP length | **6** |
| Authentication → URL Configuration | Site URL | `https://maqboolkowdu.github.io/cyberdigest/` (later, your own domain) |
| Authentication → Rate Limits | Emails sent per hour | Keep the default, or around 30 |
| | Token verifications | Keep the default (stops people guessing codes) |
| Authentication → Sessions | Detect and revoke compromised refresh tokens | **On** (default) |

Optional extra protection against bots requesting codes: **Authentication → Attack Protection → CAPTCHA** (Cloudflare Turnstile). This needs a small code change in CyberDigest, so ask before turning it on.

### Step 6: Connect the site

1. In Supabase open **Project Settings → API** and copy the **Project URL** and the **anon public** key. Never use the `service_role` key in the website.
2. On GitHub open **cyberdigest → assets/js/config.js → ✏️ Edit** and fill in:
   ```js
   window.CD_CONFIG = {
     supabaseUrl: 'https://abcdefghijklmnop.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi…',
   };
   ```
3. Recommended: in **index.html**, narrow the security policy to your project. Change `connect-src 'self' https://*.supabase.co` to `connect-src 'self' https://abcdefghijklmnop.supabase.co`.
4. Commit to `main`. The site redeploys in about a minute.

> **Is it safe to publish the anon key?** Yes, that is what it's for. The database rules only let it *add* events. It can't read, change or delete anything, and it can't see other users. The `service_role` key is the secret one and must never go in the site.

### Step 7: Test

1. Open the site in a **private window**. The welcome tour now has **6 steps**, the last one being *Sign in (optional)*.
2. Enter your email, get the code, and sign in.
3. In Supabase: **Authentication → Users** shows you, and **Table Editor → events** shows rows arriving within a few seconds.

---

## 5. Reading your reports

Open **SQL Editor** and run any of these (or browse the `insights` schema in Table Editor):

```sql
select * from insights.welcome_funnel;          -- where the tour loses people
select * from insights.daily_activity limit 30; -- last 30 days
select * from insights.feature_usage_30d;       -- what gets used
select * from insights.topics_read_30d;         -- what people read
select * from insights.design_choices;          -- Flat vs 3D, light vs dark
select * from insights.signin_daily limit 30;   -- codes sent vs sign-ins
select * from insights.readers;                 -- signed-in readers (private: emails)
```

Use the **Export → CSV** button on any result to open it in Excel.

## 6. Privacy duties (please read)

- The welcome tour and Settings tell visitors what is collected, and let them say no. Respect a visitor's request to delete their data:
  ```sql
  delete from public.events where user_id = (select id from auth.users where email = 'person@example.com');
  ```
  then delete the user in **Authentication → Users**.
- Keep data only as long as you need it. To delete events older than 13 months:
  `delete from public.events where created_at < now() - interval '13 months';`
- If you collect emails from readers in the UAE, Saudi Arabia, Oman, Qatar, Bahrain or Kuwait, their data-protection laws (PDPLs) apply. Add a short privacy notice to your site that says who you are, what you collect and how people can contact you.

## 7. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| No email arrives | Custom SMTP not set, or the sender domain isn't verified | Step 3; check the SMTP service's logs; look in spam |
| The email has a link, not a code | Template still the default | Step 4: edit both templates to use `{{ .Token }}` |
| "That code is not correct" with the right code | The code expired, or a newer code was requested | Ask for a new code and use the latest email |
| "Too many sign-in emails were sent recently" | Project-wide email limit (about 2/hour on the built-in sender) | Set up custom SMTP (Step 3), then raise **Rate Limits → emails per hour** |
| "Please wait N seconds…" | Per-person cooldown between codes | Wait the time shown; use the newest email |
| Logs show **504 Context deadline exceeded** on `/otp`, then a 200 a little later | The SMTP server is slow to answer, so Supabase gives up after ~10 s (the email is often still sent) | Try SMTP port `465` (or Brevo's `2525`) instead of `587`; the site now moves visitors to the code screen and asks them to wait instead of clicking again |
| "We couldn't send the email right now (Error sending … email)" | Supabase can't log in to your SMTP server, or the sender isn't allowed | Check **Logs → Auth** in Supabase for the SMTP reply. For Brevo: Username = the SMTP **Login** (`…@smtp-brevo.com`), Password = an **SMTP key** (not the API key `xkeysib-…`, not your account password), Sender email verified in Brevo, SMTP not blocked for new accounts |
| The tour still has 5 steps | `config.js` not filled in, or an old cached copy | Check the two values; close and reopen the app |
| No rows in `events` | Visitor said no to usage stats, browser sends Do Not Track, or CSP blocks the URL | Turn stats on in Settings; check the URL in `index.html` `connect-src` |
