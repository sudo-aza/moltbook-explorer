#!/usr/bin/env python3
"""moltbook_heartbeat.py — Moltbook heartbeat check-in."""
import json, os, sys, time
from datetime import datetime, timezone
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
from moltbook_api import Moltbook

LOG_FILE = os.path.join(SCRIPT_DIR, ".moltbook_heartbeat.log")
STATE_FILE = os.path.join(SCRIPT_DIR, ".moltbook_heartbeat_state.json")

def log(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f: f.write(line + "\n")

def load_state():
    if os.path.isfile(STATE_FILE):
        with open(STATE_FILE) as f: return json.load(f)
    return {"last_check": None}

def save_state(state):
    with open(STATE_FILE, "w") as f: json.dump(state, f, indent=2)

def run_heartbeat(check_only=False):
    log("=== Heartbeat start ===")
    mb = Moltbook()
    state = load_state()
    try:
        home = mb.home()
    except Exception as e:
        log(f"ERROR: Failed to fetch /home: {e}")
        return
    account = home.get("your_account", {})
    log(f"Agent: {account.get('name')} | Karma: {account.get('karma')} | Unread: {account.get('unread_notification_count')}")
    activity = home.get("activity_on_your_posts", [])
    if activity:
        for item in activity:
            pid, title = item["post_id"], item["post_title"]
            count, commenters = item["new_notification_count"], item.get("latest_commenters", [])
            log(f"  📬 {count} new notification(s) on \"{title[:60]}\" from {commenters}")
            if not check_only:
                try:
                    comments = mb.get_comments(pid, sort="new", limit=10)
                    for c in comments.get("comments", []):
                        author = c.get("author", {}).get("name", "?")
                        content = c.get("content", "")[:150]
                        log(f"    ↳ [{author}] (↑{c.get('upvotes', 0)}): {content}")
                        try: mb.upvote_comment(c["id"]); log(f"    ✅ Upvoted {author}'s comment")
                        except: pass
                except Exception as e: log(f"    ERROR: {e}")
    dm_info = home.get("your_direct_messages", {})
    if int(dm_info.get("pending_request_count", 0)) > 0: log(f"  📨 {dm_info['pending_request_count']} pending DM request(s)")
    if int(dm_info.get("unread_message_count", 0)) > 0: log(f"  📨 {dm_info['unread_message_count']} unread DM(s)")
    try:
        feed = mb.feed(sort="hot", limit=5)
        for p in feed.get("posts", [])[:3]:
            log(f"  🔥 [{p.get('submolt', {}).get('name', '?')}] {p.get('title', '')[:70]} (↑{p.get('upvotes', 0)})")
    except Exception as e: log(f"  ERROR fetching feed: {e}")
    if not check_only:
        try:
            r = mb.mark_notifs_read()
            if r.get("success"):
                cleared = r.get("marked_count", "all")
                log(f"  🧹 Notifications cleared ({cleared})")
        except Exception as e: log(f"  ERROR clearing notifs: {e}")
    state["last_check"] = datetime.now(timezone.utc).isoformat()
    state["last_karma"] = account.get("karma", 0)
    save_state(state)
    log("=== Heartbeat complete ===\n")

if __name__ == "__main__":
    run_heartbeat("--check-only" in sys.argv)
