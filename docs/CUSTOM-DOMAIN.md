# Putting CyberDigest on Your Own Domain

> Move CyberDigest from `maqboolkowdu.github.io/cyberdigest` to an address you own, such as `cyber.yourdomain.com`, with free HTTPS from GitHub Pages. No server, no hosting bill.

---

## 1. Description

GitHub Pages already hosts CyberDigest. A **custom domain** is just a sign on the door: you add one or two DNS records at the company where you bought the domain (your *registrar*), tell GitHub the name, and GitHub serves the same site under your address. It also issues a free Let's Encrypt certificate.

Nothing in the app needs to change. Every file path in CyberDigest is relative, so it works at any address.

## 2. Purpose

| Need | What this gives you |
|---|---|
| A professional address to share or put on a CV | `https://cyber.yourdomain.com` instead of a GitHub URL |
| No hosting cost or server to patch | GitHub Pages stays the host; you only pay for the domain (about $10–15 a year) |
| HTTPS without managing certificates | GitHub issues and renews the certificate automatically |
| Freedom to move later | Change the DNS records and the site follows |

## 3. Scenario

> *You own `maqbool.tech` and want CyberDigest at `cyber.maqbool.tech`.*
>
> 1. In your registrar's DNS panel you add one record: **CNAME** `cyber` → `maqboolkowdu.github.io`.
> 2. In GitHub you open **cyberdigest → Settings → Pages**, type `cyber.maqbool.tech` and press **Save**.
> 3. Twenty minutes later the DNS check is green. You tick **Enforce HTTPS**.
> 4. On your phone you open `https://cyber.maqbool.tech`, restore your stash backup and install the app again from the new address.

---

## 4. Before you start

- **Pick the address.** A **subdomain** (`cyber.yourdomain.com`) is the easiest: one DNS record. A **root domain** (`yourdomain.com`) works too but needs eight records (section 5B).
- **Back up your data.** Your stashes, notes and streak are stored in the browser *per web address*, so the new domain starts empty. In the current app, go to **Settings → Backup (JSON)** and keep the file.
- **Cloudflare users:** set the new records to **DNS only** (grey cloud) until HTTPS is issued, then you can switch the proxy on if you want.

## 5. Step by step

### Step 1: Verify the domain in GitHub (recommended)

Verifying stops anyone else from pointing your domain at their own GitHub site.

1. On GitHub, click your **profile picture → Settings → Pages** (your *account* settings, not the repo).
2. Click **Add a domain**, type the root domain (`yourdomain.com`) and click **Add domain**.
3. GitHub shows a **TXT** record like `_github-pages-challenge-maqboolkowdu.yourdomain.com` with a random value. Add it at your registrar.
4. Wait a few minutes and click **Verify**.

### Step 2: Add the DNS records

#### 5A. Subdomain (recommended), for example `cyber.yourdomain.com`

| Type | Name / Host | Value / Target | TTL |
|---|---|---|---|
| CNAME | `cyber` | `maqboolkowdu.github.io` | Auto or 3600 |

> Point it at `maqboolkowdu.github.io` only, **without** `/cyberdigest`. GitHub works out the rest.

#### 5B. Root domain, for example `yourdomain.com`

| Type | Name / Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `maqboolkowdu.github.io` |

Remove any old A, AAAA or CNAME records for the same name first, for example a registrar "parking" page.

### Step 3: Check the records from your PC

DNS changes can take from a few minutes to a few hours to spread. Check from PowerShell:

```powershell
# Subdomain: should return maqboolkowdu.github.io
Resolve-DnsName cyber.yourdomain.com -Type CNAME

# Root domain: should return the four 185.199.x.153 addresses
Resolve-DnsName yourdomain.com -Type A

# Ask a public resolver too, to rule out your local cache
Resolve-DnsName cyber.yourdomain.com -Server 1.1.1.1
```

### Step 4: Tell GitHub the domain

1. Open **github.com/maqboolkowdu/cyberdigest → Settings → Pages**.
2. Under **Custom domain**, type `cyber.yourdomain.com` (or the root domain) and click **Save**.
3. Wait for **DNS check successful** (refresh the page now and then).
4. Tick **Enforce HTTPS**. If the box is greyed out, the certificate is still being issued. This usually takes 15–60 minutes and occasionally up to 24 hours.

> This repo publishes with GitHub Actions, so **you don't need a `CNAME` file**. The setting above is all GitHub needs.

### Step 5: Move in

1. Open `https://cyber.yourdomain.com` and check that the padlock shows.
2. Go to **Settings → Restore** and pick the backup file from section 4.
3. Install the app again from the new address: the install icon in Edge/Chrome, *Add to Home screen* on Android, or *Share → Add to Home Screen* in Safari. Then remove the old installed copy.

The old address, `maqboolkowdu.github.io/cyberdigest`, automatically redirects to your domain once it's set.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "DNS check unsuccessful" in GitHub | Record not visible yet, or a typo | Run the `Resolve-DnsName` checks; wait up to a few hours; compare with the tables above |
| **Enforce HTTPS** stays greyed out | Certificate not issued yet, or Cloudflare proxy on | Wait up to 24 h; set Cloudflare to *DNS only*; remove and re-add the domain to retry |
| `404 There isn't a GitHub Pages site here` | Domain saved in the wrong repo, or Pages not enabled | Check **Settings → Pages** in `cyberdigest` shows the domain and *Source: GitHub Actions* |
| Site shows but stashes are empty | Browser data is per address | **Settings → Restore** with your backup |
| Old look after the move | The installed app is serving its offline copy | Close the app fully and reopen it, or reinstall from the new address |

## 7. Undoing it

Go to **Settings → Pages**, clear **Custom domain** and click **Save**, then delete the DNS records. The site returns to `maqboolkowdu.github.io/cyberdigest`.
