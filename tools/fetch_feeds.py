#!/usr/bin/env python3
"""CyberDigest feed builder.

Pulls cyber-security news from RSS/Atom feeds (global + GCC), tags each story
with topics and GCC countries, splits the summary into short "idea" cards and
writes data/feed.json for the web app.

Standard library only, so it runs on any GitHub Actions runner or a laptop:
    python3 tools/fetch_feeds.py

If the `anthropic` package and an ANTHROPIC_API_KEY are available, new stories
also get AI-written key ideas and a "why it matters" line (see ai_summaries.py).
"""
import hashlib
import html
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import ai_summaries

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "feed.json")
KEEP_DAYS = 14
MAX_ITEMS = 600
UA = "Mozilla/5.0 (CyberDigest news reader; +https://github.com/maqboolkowdu/cyberdigest)"


def gnews(q):
    return "https://news.google.com/rss/search?q=" + urllib.request.quote(q) + "+when:7d&hl=en-US&gl=US&ceid=US:en"


# (name, url, region hint). "gcc" sources are boosted and always shown under the GCC filter.
FEEDS = [
    ("The Hacker News", "https://feeds.feedburner.com/TheHackersNews", "global"),
    ("BleepingComputer", "https://www.bleepingcomputer.com/feed/", "global"),
    ("Krebs on Security", "https://krebsonsecurity.com/feed/", "global"),
    ("Dark Reading", "https://www.darkreading.com/rss.xml", "global"),
    ("SecurityWeek", "https://www.securityweek.com/feed/", "global"),
    ("The Record", "https://therecord.media/feed", "global"),
    ("Help Net Security", "https://www.helpnetsecurity.com/feed/", "global"),
    ("Infosecurity Magazine", "https://www.infosecurity-magazine.com/rss/news/", "global"),
    ("SANS ISC", "https://isc.sans.edu/rssfeed_full.xml", "global"),
    ("The Cyber Express", "https://thecyberexpress.com/feed/", "global"),
    ("Industrial Cyber", "https://industrialcyber.co/feed/", "global"),
    ("Security Middle East", "https://securitymiddleeastmag.com/feed/", "gcc"),
    ("Tahawul Tech", "https://www.tahawultech.com/feed/", "gcc"),  # general tech: cyber filter applies
    ("Google News · GCC", gnews('cybersecurity (GCC OR "Gulf region" OR "Middle East")'), "gcc"),
    ("Google News · UAE", gnews('(cybersecurity OR cyberattack OR "data breach") UAE'), "gcc"),
    ("Google News · Saudi", gnews('(cybersecurity OR cyberattack OR "data breach") Saudi'), "gcc"),
    ("Google News · Qatar", gnews('(cybersecurity OR cyberattack OR "data breach") Qatar'), "gcc"),
    ("Google News · Oman", gnews('(cybersecurity OR cyberattack OR "data breach") Oman'), "gcc"),
    ("Google News · Bahrain", gnews('(cybersecurity OR cyberattack OR "data breach") Bahrain'), "gcc"),
    ("Google News · Kuwait", gnews('(cybersecurity OR cyberattack OR "data breach") Kuwait'), "gcc"),
]

# Country detection: names, cities, regulators and national CERTs.
COUNTRIES = {
    "AE": ["uae", "united arab emirates", "emirati", "dubai", "abu dhabi", "sharjah", "tdra", "uae cybersecurity council", "aecert", "dewa", "adnoc", "etisalat", "e&", "du telecom"],
    "SA": ["saudi", "ksa", "riyadh", "jeddah", "dammam", "neom", "aramco", "nca saudi", "national cybersecurity authority", "sama", "stc"],
    "QA": ["qatar", "qatari", "doha", "ncsa qatar", "qcert", "ooredoo"],
    "OM": ["oman", "omani", "muscat", "salalah", "ocert", "mtcit", "omantel"],
    "BH": ["bahrain", "bahraini", "manama", "batelco"],
    "KW": ["kuwait", "citra"],
}
GCC_WORDS = ["gcc", "gulf cooperation council", "gulf region", "gulf states", "middle east", "mena", "arab world", "gitex"]

TOPICS = {
    "ransomware": ["ransomware", "lockbit", "blackcat", "alphv", "akira", "clop", "extortion", "encryptor"],
    "vulnerabilities": ["cve-", "vulnerability", "vulnerabilities", "zero-day", "0-day", "patch", "exploit", "rce", "flaw", "advisory", "kev"],
    "breaches": ["breach", "leak", "leaked", "exposed", "stolen data", "data theft", "compromised"],
    "threat-intel": ["apt", "threat actor", "nation-state", "state-sponsored", "espionage", "campaign", "hacktivist", "botnet", "ddos"],
    "malware": ["malware", "trojan", "infostealer", "stealer", "backdoor", "loader", "rat ", "spyware", "wiper"],
    "phishing": ["phishing", "smishing", "vishing", "scam", "fraud", "social engineering", "bec", "impersonat"],
    "identity": ["identity", "mfa", "password", "credential", "entra", "active directory", "okta", "sso", "authentication", "passkey"],
    "cloud": ["cloud", "aws", "azure", "google cloud", "saas", "kubernetes", "m365", "microsoft 365", "s3 bucket"],
    "network": ["firewall", "vpn", "fortinet", "fortigate", "palo alto", "cisco", "router", "ivanti", "citrix", "netscaler", "sonicwall", "edge device"],
    "ot-ics": ["ics", "scada", "ot security", "operational technology", "industrial", "critical infrastructure", "utility", "oil and gas", "energy sector"],
    "ai": ["ai ", "artificial intelligence", "llm", "genai", "deepfake", "chatgpt", "machine learning", "agentic"],
    "policy": ["regulation", "law", "policy", "compliance", "framework", "strategy", "authority", "ministry", "government", "sanction", "indict", "arrest", "pdpl", "gdpr", "fine"],
    "education": ["university", "universities", "school", "college", "education", "student", "campus"],
}

# General-news sources (Google News, regional tech titles) must mention at least one of these.
CYBER_WORDS = ["cyber", "infosec", "information security", "data security", "it security", "network security",
               "security operations", "hacker", "hacked", "hacking", "breach", "ransomware", "malware", "phishing",
               "vulnerab", "threat actor", "threat intel", "privacy", "data protection", "fraud", "scam", "leak", "ddos", "encrypt", "zero trust",
               "soc", "siem", "cert", "incident", "spyware", "exploit"]
NEEDS_FILTER = ("Google News", "Tahawul Tech")

NS = {"atom": "http://www.w3.org/2005/Atom", "media": "http://search.yahoo.com/mrss/", "content": "http://purl.org/rss/1.0/modules/content/"}
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def clean(text):
    if not text:
        return ""
    text = html.unescape(TAG_RE.sub(" ", html.unescape(text)))
    text = WS_RE.sub(" ", text).strip()
    text = re.sub(r"\s*(The post .*? appeared first on .*|Continue reading.*|Read more.*|\[…\]|\[\.\.\.\])$", "", text, flags=re.I)
    return text.strip()


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = parsedate_to_datetime(s)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)


def first_image(el, raw_html):
    for path in ("media:content", "media:thumbnail"):
        m = el.find(path, NS)
        if m is not None and m.get("url") and (m.get("medium", "image") == "image"):
            return m.get("url")
    enc = el.find("enclosure")
    if enc is not None and (enc.get("type") or "").startswith("image"):
        return enc.get("url")
    m = re.search(r'<img[^>]+src="([^"]+)"', raw_html or "")
    return m.group(1) if m else ""


def sentences(text):
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"“])", text)
    return [p.strip() for p in parts if len(p.strip()) > 25]


def make_ideas(title, summary):
    """Split a summary into up to 3 bite-size idea cards (~45 words each)."""
    if not summary or summary.lower().startswith(title.lower()[:40]) and len(summary) < len(title) + 20:
        return []
    ideas, cur = [], ""
    for s in sentences(summary):
        if len((cur + " " + s).split()) > 45 and cur:
            ideas.append(cur.strip())
            cur = s
        else:
            cur = (cur + " " + s).strip()
        if len(ideas) == 3:
            break
    if cur and len(ideas) < 3:
        ideas.append(cur.strip())
    out = []
    for i in ideas:
        words = i.split()
        out.append(" ".join(words[:70]) + ("…" if len(words) > 70 else ""))
    return out


def has(t, word, whole=False):
    """Word-start match; short words (<=4 chars) must also end on a boundary ("ai" must not hit "said")."""
    w = word.strip()
    tail = r"(?![a-z])" if whole or len(w) <= 4 or word.endswith(" ") else ""
    return re.search(r"(?<![a-z0-9])" + re.escape(w) + tail, t) is not None


def tag(text):
    t = text.lower()
    countries = [c for c, words in COUNTRIES.items() if any(has(t, w, True) for w in words)]
    gcc = bool(countries) or any(has(t, w) for w in GCC_WORDS)
    topics = [k for k, words in TOPICS.items() if any(has(t, w) for w in words)]
    cyber = any(has(t, w) for w in CYBER_WORDS)
    return countries, gcc, topics or ["general"], cyber


def fetch(name, url, region):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"})
        with urllib.request.urlopen(req, timeout=25) as r:
            root = ET.fromstring(r.read())
    except Exception as e:  # noqa: BLE001 — one bad feed must not break the build
        print(f"  ! {name}: {e}", file=sys.stderr)
        return []
    items = []
    entries = root.findall(".//item") or root.findall(".//atom:entry", NS)
    for el in entries[:60]:
        title = clean(el.findtext("title") or el.findtext("atom:title", namespaces=NS))
        link = (el.findtext("link") or "").strip()
        if not link:
            a = el.find("atom:link", NS)
            link = a.get("href") if a is not None else ""
        raw = el.findtext("content:encoded", namespaces=NS) or el.findtext("description") or el.findtext("atom:summary", namespaces=NS) or el.findtext("atom:content", namespaces=NS) or ""
        when = parse_date(el.findtext("pubDate") or el.findtext("atom:published", namespaces=NS) or el.findtext("atom:updated", namespaces=NS) or el.findtext("{http://purl.org/dc/elements/1.1/}date"))
        if not title or not link:
            continue
        source = name
        if name.startswith("Google News"):
            # Google titles look like "Headline - Publisher"; the description is just a link list.
            src_el = el.find("source")
            if src_el is not None and src_el.text:
                source = src_el.text.strip()
                title = re.sub(r"\s+-\s+" + re.escape(source) + r"$", "", title)
            raw = ""
        summary = clean(raw)
        if len(summary) > 1400:
            summary = summary[:1400].rsplit(" ", 1)[0] + "…"
        countries, gcc, topics, cyber = tag(title + " " + summary)
        if name.startswith(NEEDS_FILTER) and not cyber:
            continue  # general business/tech story, not security
        if region == "gcc" and name.startswith("Google News") and not gcc:
            continue  # search hit that doesn't actually mention the region
        items.append({
            "id": hashlib.sha1(link.encode()).hexdigest()[:12],
            "title": title,
            "link": link,
            "source": source,
            "feed": name,
            "published": (when or datetime.now(timezone.utc)).isoformat(timespec="seconds"),
            "summary": summary,
            "ideas": make_ideas(title, summary),
            "image": first_image(el, raw),
            "topics": topics,
            "countries": countries,
            "gcc": gcc or (region == "gcc" and not name.startswith("Google News")),
        })
    print(f"  ✓ {name}: {len(items)}", file=sys.stderr)
    return items


def norm_title(t):
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()[:80]


def main():
    print("Fetching feeds…", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=8) as pool:
        batches = list(pool.map(lambda f: fetch(*f), FEEDS))
    fresh = [i for b in batches for i in b]

    old, skipped = [], set()
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding="utf-8") as f:
                prev = json.load(f)
            old, skipped = prev.get("items", []), set(prev.get("ai_skipped", []))
        except (OSError, ValueError):
            pass

    # Carry AI results over to the fresh copy of a story so it's only summarised once.
    old_by_id = {i["id"]: i for i in old}
    for it in fresh:
        prev_it = old_by_id.get(it["id"])
        if prev_it and "ai" in prev_it:
            for k in ("ai", "ideas", "takeaway", "gcc", "countries"):
                if k in prev_it:
                    it[k] = prev_it[k]
    fetched_ids = {i["id"] for i in fresh}
    fresh = [i for i in fresh if i["id"] not in skipped]  # already judged off-topic

    cutoff = datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)
    seen_ids, seen_titles, merged = set(), set(), []
    for it in fresh + old:  # fresh first so updated copies win
        key = norm_title(it["title"])
        if it["id"] in seen_ids or key in seen_titles:
            continue
        if datetime.fromisoformat(it["published"]) < cutoff:
            continue
        seen_ids.add(it["id"])
        seen_titles.add(key)
        merged.append(it)
    merged.sort(key=lambda i: i["published"], reverse=True)
    merged = merged[:MAX_ITEMS]

    before = {i["id"] for i in merged}
    merged = ai_summaries.enrich(merged)
    # Remember off-topic stories while they are still in the source feeds, so they aren't re-checked every run.
    skipped = (skipped & fetched_ids) | (before - {i["id"] for i in merged})

    if not merged:
        print("No items fetched and no previous feed — leaving file untouched.", file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "sources": [{"name": n, "region": r} for n, _, r in FEEDS],
            "items": merged,
            "ai_skipped": sorted(skipped),
        }, f, ensure_ascii=False, separators=(",", ":"))
    gcc = sum(1 for i in merged if i["gcc"])
    ai = sum(1 for i in merged if "ai" in i)
    print(f"Wrote {len(merged)} stories ({gcc} GCC, {ai} with AI summaries) → {os.path.relpath(OUT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
