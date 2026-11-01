# CyberDigest — Daily Cyber Security Bytes, with a GCC Focus

> A free, installable reading app that turns the day's cyber security news into **short, swipeable cards called bytes**. Global headlines are included, and stories from **the UAE, Saudi Arabia, Qatar, Oman, Bahrain and Kuwait** are boosted. Read a few every morning, save the important ones into **stashes**, and export them as Markdown for your blog or team briefing.

![Platform](https://img.shields.io/badge/platform-any%20browser-2563eb) ![Backend](https://img.shields.io/badge/backend-none-0ea5a4) ![Refresh](https://img.shields.io/badge/news-every%203%20hours-7c3aed)

**Live app:** https://maqboolkowdu.github.io/cyberdigest/ · **Own domain:** see [docs/CUSTOM-DOMAIN.md](docs/CUSTOM-DOMAIN.md)

---

## 1. Description

CyberDigest is a micro-learning reader for security news. Long articles are hard to fit into a busy day, so each news story becomes a **byte**: a card with one to three short **key points** (about 45 words each). Tap or swipe to move on.

It has two parts:

| Part | What it does | Where it runs |
|---|---|---|
| **Feed builder** (`tools/fetch_feeds.py`) | Downloads 20 RSS feeds, removes duplicates, tags each story with **topics** (ransomware, vulnerabilities, OT, AI security, policy…) and **GCC countries**, splits summaries into key points, and writes `data/feed.json`. | GitHub Actions, every 3 hours. Python standard library only. |
| **AI summaries** (`tools/ai_summaries.py`, optional) | Sends each *new* story to Claude, which writes 2–3 key points, a **"Why it matters"** line for defenders, and a GCC relevance rating. It also drops stories that aren't really about cyber security. | Same GitHub Action, only when an `ANTHROPIC_API_KEY` secret is set. |
| **Web app** (`index.html`) | The daily stack, Explore filters, stashes, notes, streaks and settings. | Your browser. It's an installable PWA and works offline. |

No server, database or account is needed. Your reading history, stashes and notes stay in your browser.

## 2. Purpose

| Problem | How CyberDigest solves it |
|---|---|
| Security news is spread over dozens of sites, and GCC stories get buried under US/EU coverage. | One feed from 20 sources, with **dedicated GCC sources** and per-country searches. Regional stories get a ranking boost. |
| You don't have time to read 15 full articles before your shift. | A **daily stack** (5–20 bytes, you choose). Each byte is a news story cut down to its key points. Most days take 5 minutes. |
| You read something useful and can't find it again a week later. | **Stashes** (Read later, GCC watch, Bytes for my website, or your own) with a personal note on each story. |
| Writing a weekly "threat briefing" for your team or website takes hours. | **Export a stash as Markdown**: titles, sources, key points, your notes and links, ready to paste into WordPress, Hugo, Teams or an e-mail. |
| Reading habits drop off. | A **daily goal ring** and **streak counter**. |

## 3. Scenario

> *Sunday, 7:40 AM in Muscat. You're a network and systems engineer at a university, with coffee and ten minutes before the first change-window meeting.*
>
> You open **CyberDigest** from your phone's home screen. The ring shows **0 / 8**.
>
> 1. The first card is a **🇸🇦 Saudi** story: *"Saudi Arabia opens drone and cyber centres."* You read the first key point, tap, read the second, then tap **Got it ✓**.
> 2. Next comes a **🛜 Network & edge** story about a new FortiGate SSL-VPN flaw. You run FortiGates on campus, so you **swipe right** to save it to *GCC watch* and add a note: *"Check firmware on HQ and COE edge firewalls today."*
> 3. You work through the rest of the stack: a ransomware group hitting education, a UAE Cybersecurity Council announcement, a Microsoft Entra phishing campaign.
>
> At 7:50 the ring is full: **🎯 Daily goal reached! Streak: 12 days**.
>
> On Thursday afternoon you open **Stashes → Bytes for my website**, click **Export as Markdown**, and paste the file into your blog as *"This week in GCC cyber security."* Each story keeps its sources, key points and your own take.

---

## 4. Features

- **☀️ Today**: a personalised stack of N bytes (default 8), with a progress bar, key-point dots, your daily goal and a streak counter. Tap or swipe left for the next key point, swipe right to save. Keys: `←` `→` `Space` `S`.
- **🌍 GCC spotlight**: the latest regional stories in a horizontal carousel.
- **📈 Trending this week**: topic chips with story counts over the last 3 days.
- **🧭 Explore**: every story from the last 14 days grouped by day. Filter by **region** (All · GCC · 🇦🇪 🇸🇦 🇶🇦 🇴🇲 🇧🇭 🇰🇼 · Rest of world), **topic**, *unread only*, or a free-text search (*Fortinet*, *NCA*, *LockBit*…).
- **✨ AI summaries** (optional): stories summarised by Claude carry an *AI summary* badge. Their last card adds a **Why it matters** line, for example *"Check FortiGate firmware on internet-facing firewalls."*
- **📖 Reader**: all key points of a story, the *Why it matters* line, your note, **Save**, **Share** (native share sheet on mobile), **Copy as Markdown** and a link to the full article.
- **🔖 Stashes**: three built-in stashes plus your own. Edit notes inline, move stories between stashes, and export or copy a whole stash as Markdown.
- **⚙️ Settings**: regions and topics to prioritise, the daily goal, light/dark/system theme, JSON backup and restore, reading-history reset, and the list of sources with story counts.
- **📱 PWA**: install to the home screen or desktop. The last downloaded news is still readable offline.
- **👋 Welcome tour**: a 6-step introduction with a progress bar: what CyberDigest is (with a live headline ticker), interests, daily goal, design, theme, and optional sign-in. Choices apply live. It can be replayed from Settings.
- **🔐 Passwordless sign-in (optional)**: email plus a one-time code, with *Keep me signed in on this device*. Needs Supabase; see [docs/SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md).
- **📊 Usage stats for the owner (with consent)**: anonymous events such as tour steps, bytes read and design chosen feed private reports, so you can see where to improve. Visitors can say no, and Do Not Track is respected.
- **🖥️ Desktop and 📱 mobile layouts**:
  - **Desktop:** a boxed top menu. Today shows your briefing panel next to the byte card, with the GCC spotlight as a 4-column grid below. Explore has a one-line search and filter bar and two columns of results.
  - **Mobile:** the same design stacked in one column, with a bottom menu.

### Two designs: Flat or Immersive 3D

Pick one in **Settings → Design**, or open the app with a link:

| Design | Link | Look |
|---|---|---|
| **Flat (sustainable)** | `…/?skin=flat` | Flat colour blocks with bold outlines |
| **Immersive 3D** | `…/?skin=immersive` | **Default.** Blueprint grid, giant mono headline, a rotating 3D cube and wireframe globe, cards that tilt with the mouse and sit on a 3D stack, flip-in animation |

The 3D effects are built with CSS only (no 3D libraries, images or WebGL), so the immersive design adds only about 10 KB. All animation stops if your device is set to reduce motion.

### Sustainable web design

The look follows the *sustainable web design* trend: flat colour blocks with bold ink outlines, as on the C40 Cities site. It also keeps the page light:

| Choice | Why it saves energy and data |
|---|---|
| **System fonts only** | No web-font downloads. The app uses the fonts already on the device (Segoe UI on Windows, San Francisco on Apple, Roboto on Android). |
| **No images, gradients, shadows or blur** | Less to download and less work for the graphics chip. Colour comes from flat blocks. |
| **True-black dark mode** | On OLED phone screens, black pixels are switched off. |
| **No trackers, ads or third-party scripts** | Every byte comes from the app itself. |
| **Offline cache** | Repeat visits load from the device. The footer shows how many KB the visit actually downloaded. |
| **Reduced motion respected** | Animations turn off when the device asks for less motion. |

### Topics the feed builder detects

Ransomware · Vulnerabilities · Data breaches · Threat intel & APT · Malware · Phishing & fraud · Identity & access · Cloud & SaaS · Network & edge · OT & critical infrastructure · AI security · Policy & regulation · Education sector

### How a story is tagged as GCC

A story is tagged GCC if it comes from a regional source, or if its title or summary mentions a GCC country, city, regulator or national CERT. Examples: *Dubai, Abu Dhabi, TDRA, UAE Cybersecurity Council, Riyadh, NCA, SAMA, Aramco, Doha, NCSA, Muscat, OCERT, MTCIT, Manama, Kuwait, CITRA*, or regional terms such as *GCC, Middle East, GITEX*.

## 5. News sources

| Global | GCC / Middle East |
|---|---|
| The Hacker News · BleepingComputer · Krebs on Security · Dark Reading · SecurityWeek · The Record · Help Net Security · Infosecurity Magazine · SANS ISC · The Cyber Express · Industrial Cyber | Security Middle East · Tahawul Tech (cyber stories only) · Google News searches for **GCC**, **UAE**, **Saudi**, **Qatar**, **Oman**, **Bahrain** and **Kuwait** (cyber stories only) |

To add a source, edit the `FEEDS` list at the top of `tools/fetch_feeds.py`:

```python
("My Regional Blog", "https://example.com/feed/", "gcc"),   # or "global"
```

For a source that covers general news, add its name to `NEEDS_FILTER` so that only cyber-related stories get through.

---

## 6. How to use it

### Option A: Use the hosted app (recommended)

1. Every push to `main` runs the **Deploy CyberDigest** workflow, which publishes the site to GitHub Pages.
2. Open https://maqboolkowdu.github.io/cyberdigest/ (or your own domain once it's set up; see [docs/CUSTOM-DOMAIN.md](docs/CUSTOM-DOMAIN.md)).
3. Pick your regions, topics and daily goal on the welcome screen.
4. **Install it.** In Chrome/Edge on desktop, use the install icon in the address bar. On Android, use *⋮ → Add to Home screen*. On iPhone, use Safari's *Share → Add to Home Screen*.

The workflow runs every 3 hours (`17 */3 * * *` UTC). Each run downloads fresh news and redeploys, so there's nothing to maintain. To refresh right away, go to **GitHub → Actions → Deploy CyberDigest → Run workflow**.

### Option B: Run it on your own PC

```powershell
# Windows PowerShell (Python 3.9+ installed)
git clone https://github.com/maqboolkowdu/cyberdigest.git
cd cyberdigest
python tools\fetch_feeds.py          # pulls the latest news into data\feed.json
python -m http.server 8080           # serve the app
Start-Process "http://localhost:8080"
```

```bash
# Linux / macOS
git clone https://github.com/maqboolkowdu/cyberdigest.git && cd cyberdigest && python3 tools/fetch_feeds.py && python3 -m http.server 8080
```

Sample output of the feed builder:

```
Fetching feeds…
  ✓ The Hacker News: 50
  ✓ Security Middle East: 10
  ✓ Google News · UAE: 21
  ...
Wrote 248 stories (29 GCC) → data/feed.json
```

### Optional: turn on AI summaries with OpenAI

Use this if you have OpenAI API credit. It does the same job as the Claude option below: 2–3 clear key points, a **Why it matters** line, a GCC relevance rating, and dropping off-topic stories. It needs no extra software.

1. Create an API key at **platform.openai.com → API keys** (check that your project has credit under **Billing**).
2. In GitHub, open **cyberdigest → Settings → Secrets and variables → Actions → New repository secret**. Name it `OPENAI_API_KEY` and paste the key.
3. Optional: to choose the model, open the **Variables** tab and add `CYBERDIGEST_AI_MODEL`. The default is `gpt-5.4-mini`; `gpt-5.4-nano` is cheaper and simpler.
4. Run the workflow once (**Actions → Deploy CyberDigest → Run workflow**). The log shows `AI summaries: 60 new stories with openai gpt-5.4-mini…`.

| Model | Price per 1M tokens (input / output) | Rough cost for CyberDigest |
|---|---|---|
| `gpt-5.4-mini` (default) | $0.75 / $4.50 | about $0.25 a day |
| `gpt-5.4-nano` | $0.20 / $1.25 | about $0.07 a day |

Prices are from [OpenAI's pricing page](https://developers.openai.com/api/docs/pricing) (November 2026), and the estimates assume 100–150 new stories a day. If both an OpenAI and an Anthropic key are set, Claude is used unless you add the variable `CYBERDIGEST_AI_PROVIDER` = `openai`.

### Optional: turn on AI summaries with Claude

Without this, key points are cut from the publisher's summary sentence by sentence and GCC tagging uses keywords. With it, Claude rewrites each new story as 2–3 clear key points, adds a practical **Why it matters** line, and rates its GCC relevance. That corrects keyword mistakes, such as a person's surname "Al Kuwaiti" being tagged as Kuwait.

1. Create an API key at **console.anthropic.com → API keys**.
2. In GitHub, open the repo's **Settings → Secrets and variables → Actions → New repository secret**. Name it `ANTHROPIC_API_KEY` and paste the key.
3. Run the workflow once (**Actions → Deploy CyberDigest → Run workflow**), or wait for the next 3-hourly run.

The log shows lines like:

```
AI summaries: 42 new stories with claude-opus-5-5…
AI summaries: 42 summarised, 3 off-topic stories dropped.
Wrote 251 stories (31 GCC, 42 with AI summaries) → data/feed.json
```

How it keeps cost and risk down:

- **Only new stories are sent.** Summaries are saved in `feed.json` and reused on later runs. Stories judged off-topic are remembered too, so they aren't checked again.
- **Batches of 8 stories per request**, at low effort, with a cap of 60 new stories per run (`CYBERDIGEST_AI_MAX`).
- **It can't make up details.** The prompt only allows facts from the publisher's text. Headline-only stories (Google News) keep the headline brief instead of an invented summary.
- **If something fails, the feed still builds.** A missing key, a network error, a rate limit or a declined request means those stories keep their keyword summaries.
- Security news can occasionally trip a model's safety filters. With Claude, the request lets the API retry a declined batch on its recommended fallback model automatically. With OpenAI, a declined batch keeps its keyword summaries.

Rough cost with the default model (`claude-opus-5-5`): about **$0.005–0.01 per story**. A typical 100–150 new stories a day comes to roughly **$0.50–1.50 a day**, and the per-run cap limits the worst case. To use a cheaper model, set a repository **variable** or env value `CYBERDIGEST_AI_MODEL`, for example `claude-haiku-5-5`. Set `CYBERDIGEST_AI=0` to switch summaries off.

To try it locally:

```powershell
pip install -r tools\requirements.txt
$env:ANTHROPIC_API_KEY = "sk-ant-..."     # or run `ant auth login` once and set $env:CYBERDIGEST_AI = "1"
python tools\fetch_feeds.py
```

### Optional: refresh daily with Windows Task Scheduler

If you host the app on an internal IIS or file server, schedule the feed builder:

```powershell
$action  = New-ScheduledTaskAction -Execute "python.exe" -Argument "C:\inetpub\cyberdigest\tools\fetch_feeds.py"
$trigger = New-ScheduledTaskTrigger -Daily -At 6:30am
Register-ScheduledTask -TaskName "CyberDigest feed refresh" -Action $action -Trigger $trigger -Description "Pulls cyber security news for CyberDigest"
```

---

## 7. Privacy & limits

- **No tracking and no accounts.** Reading history, stashes and notes are kept in `localStorage` in your browser. Use **Settings → Backup** to move them to another device.
- The app only stores **headlines, short summaries and links**. "Full story ↗" always opens the original publisher.
- Some sources (Google News) only provide a headline. Those cards show a *headline brief* and a link to the full story.
- With AI summaries on, each story's title and publisher summary (never your reading data) is sent to the Claude API from GitHub Actions.
- Topic and country tagging uses keyword rules, so it sometimes gets it wrong (AI summaries correct most GCC mistakes). A story about a physical attack in the region can occasionally slip through, and a story that only names a local company may be missed.
- News older than **14 days** drops out of the feed, but anything you saved to a stash is kept.

## 8. File layout

```
cyberdigest/
├── .github/workflows/pages.yml  Refresh news every 3 hours and publish to GitHub Pages
├── docs/CUSTOM-DOMAIN.md        Step-by-step guide to using your own domain
├── docs/SUPABASE-SETUP.md       Switch on sign-in and usage stats
├── supabase/setup.sql           Database table, security rules and reports
├── SECURITY.md                  Security assessment of sign-in and usage stats
├── index.html               App shell
├── manifest.webmanifest     PWA install metadata
├── sw.js                    Offline cache (network-first)
├── data/feed.json           Generated news feed (refreshed by CI)
├── tools/fetch_feeds.py     Feed builder: fetch → tag → split into key points
├── tools/ai_summaries.py    Optional Claude summaries: key points, why it matters, GCC relevance
├── tools/requirements.txt   Pinned `anthropic` SDK for AI summaries
└── assets/
    ├── css/app.css          Styles (light/dark, mobile-first)
    ├── css/immersive.css    Immersive 3D design (default)
    ├── css/welcome.css      Welcome tour, sign-in and consent styles
    ├── js/data.js           Topics, GCC countries, helpers
    ├── js/store.js          Local state: prefs, streaks, stashes
    ├── js/app.js            Views: Today, Explore, Reader, Stashes, Settings
    ├── js/welcome.js        Welcome tour and sign-in screens
    ├── js/auth.js           Email one-time-code sign-in (Supabase Auth REST)
    ├── js/track.js          Consent-based usage stats
    ├── js/config.js         Supabase URL and public key (empty = off)
    ├── js/boot.js           Applies theme/design before first paint
    └── icons/               App icons
```
