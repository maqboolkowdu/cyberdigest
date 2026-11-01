"""Optional AI summaries for CyberDigest, written by Claude.

fetch_feeds.py calls enrich() after it has collected the stories. Each new
story gets:
  * 2-3 key ideas written from the article text (replacing the sentence split)
  * a one-line "why it matters" takeaway for IT / security teams
  * a GCC relevance rating that corrects the keyword tagging
  * a cyber-relevance check that drops off-topic stories

Stories that already have a summary from an earlier run are skipped, so each
story is only sent once. Without the `anthropic` package or credentials,
enrich() does nothing and the keyword-based feed is used as before.

Settings (environment variables):
  ANTHROPIC_API_KEY        API key (GitHub secret in CI)
  CYBERDIGEST_AI           set to 0 to switch AI summaries off
  CYBERDIGEST_AI_MODEL     model ID, default claude-opus-5-5
  CYBERDIGEST_AI_MAX       most new stories to summarise per run, default 60
"""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

MODEL = os.environ.get("CYBERDIGEST_AI_MODEL", "claude-opus-5-5")
MAX_NEW = int(os.environ.get("CYBERDIGEST_AI_MAX", "60"))
BATCH = 8  # stories per request

SYSTEM = """You write short briefings for CyberDigest, a daily cyber security news reader for IT, network and security engineers in the GCC (UAE, Saudi Arabia, Qatar, Oman, Bahrain, Kuwait).

For each story you receive (id, source, title and the publisher's summary), return:

- ideas: 2 or 3 key ideas, each one or two plain sentences and at most 45 words. Each idea must stand on its own when read on a card: say who was affected, what happened, and what is known about the cause or impact. Use only facts stated in the provided text. Do not add details, numbers, CVE IDs or attributions that are not in it. If the text is only a headline with no summary, return an empty list.
- takeaway: one sentence (at most 30 words) on what a defender should check or do, or why it matters to organisations in the GCC. Keep it practical, for example patching, hunting for indicators, reviewing exposure or user awareness. Return an empty string if the text gives too little to go on.
- gcc_relevance: "high" if the story is about a GCC country, government, company or incident; "medium" if it explicitly concerns the Middle East or Gulf region more broadly; "low" for global news with no regional angle; "none" if it has nothing to do with the region.
- cyber_relevant: false if the story is not about cyber security, privacy or digital fraud (for example a physical attack, an oil price story or a general business announcement), otherwise true.

Write in clear, neutral English for a technical reader. Return one entry per story, using the same id."""

SCHEMA = {
    "type": "object",
    "properties": {
        "stories": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "ideas": {"type": "array", "items": {"type": "string"}},
                    "takeaway": {"type": "string"},
                    "gcc_relevance": {"type": "string", "enum": ["high", "medium", "low", "none"]},
                    "cyber_relevant": {"type": "boolean"},
                },
                "required": ["id", "ideas", "takeaway", "gcc_relevance", "cyber_relevant"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["stories"],
    "additionalProperties": False,
}


def log(msg):
    print(msg, file=sys.stderr)


def available():
    if os.environ.get("CYBERDIGEST_AI", "1") == "0":
        return False
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN") or os.environ.get("CYBERDIGEST_AI") == "1"):
        log("AI summaries: no ANTHROPIC_API_KEY set, using keyword tagging only.")
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        log("AI summaries: `anthropic` package not installed (pip install anthropic), using keyword tagging only.")
        return False
    return True


def _summarise(client, batch):
    import anthropic

    payload = [{"id": i["id"], "source": i["source"], "title": i["title"], "summary": i["summary"][:1400]} for i in batch]
    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM,
            messages=[{"role": "user", "content": "Stories:\n" + json.dumps(payload, ensure_ascii=False, indent=1)}],
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
            # Security news can trip the cyber safety classifier; let the API re-run a declined request on its recommended fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.RateLimitError:
        log("  ! AI batch rate-limited after retries, skipped")
        return {}
    except anthropic.APIStatusError as e:
        log(f"  ! AI batch failed: HTTP {e.status_code} {e.message}")
        return {}
    except anthropic.APIConnectionError:
        log("  ! AI batch failed: network error")
        return {}

    if response.stop_reason == "refusal":
        category = response.stop_details.category if response.stop_details else None
        log(f"  ! AI batch declined (category: {category}), keeping keyword summaries")
        return {}
    if response.stop_reason == "max_tokens":
        log("  ! AI batch hit max_tokens, skipped")
        return {}
    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        stories = json.loads(text)["stories"]
    except (ValueError, KeyError):
        log("  ! AI batch returned unreadable JSON, skipped")
        return {}
    return {s["id"]: s for s in stories}


def enrich(items):
    """Add AI summaries to items that don't have one yet. Returns the items to keep."""
    if not available():
        return items
    import anthropic

    todo = [i for i in items if "ai" not in i][:MAX_NEW]
    if not todo:
        log("AI summaries: nothing new to summarise.")
        return items
    log(f"AI summaries: {len(todo)} new stories with {MODEL}…")
    client = anthropic.Anthropic(max_retries=3)
    batches = [todo[n:n + BATCH] for n in range(0, len(todo), BATCH)]
    results = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for part in pool.map(lambda b: _summarise(client, b), batches):
            results.update(part)

    keep, dropped = [], 0
    for item in items:
        r = results.get(item["id"])
        if r:
            if not r["cyber_relevant"]:
                dropped += 1
                continue
            ideas = [s.strip() for s in r["ideas"] if s.strip()][:3]
            item["ai"] = {"model": MODEL, "gcc_relevance": r["gcc_relevance"]}
            if ideas:
                item["ideas"] = ideas
                item["ai"]["ideas"] = True
            item["takeaway"] = r["takeaway"].strip()
            item["gcc"] = r["gcc_relevance"] in ("high", "medium")
            if not item["gcc"]:
                item["countries"] = []
        keep.append(item)
    log(f"AI summaries: {len(results)} summarised, {dropped} off-topic stories dropped.")
    return keep
