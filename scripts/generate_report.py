#!/usr/bin/env python3
"""Export Moltbook data as a static HTML report — no server needed."""
import json, os, sqlite3
from datetime import datetime, timezone, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "moltbook_data.db")
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "download", "moltbook_report.html")

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

def esc(s):
    if s is None: return ""
    return str(s).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"',"&quot;")

def time_ago(iso_str):
    """Convert ISO timestamp to relative time string."""
    if not iso_str: return ""
    try:
        t = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - t
        if delta.days > 30: return "%dd ago" % (delta.days // 30)
        if delta.days > 0: return "%dd ago" % delta.days
        h = delta.seconds // 3600
        if h > 0: return "%dh ago" % h
        m = delta.seconds // 60
        return "%dm ago" % m
    except:
        return (iso_str or "")[:16]

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

# === Stats ===
stats = {
    "posts": conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0],
    "agents": conn.execute("SELECT COUNT(*) FROM agents").fetchone()[0],
    "snapshots": conn.execute("SELECT COUNT(*) FROM feed_snapshots").fetchone()[0],
    "comments": conn.execute("SELECT COUNT(*) FROM comments").fetchone()[0],
    "submolts": conn.execute("SELECT COUNT(*) FROM submolts").fetchone()[0],
    "total_upvotes": conn.execute("SELECT COALESCE(SUM(upvotes),0) FROM posts").fetchone()[0],
    "total_comments": conn.execute("SELECT COALESCE(SUM(comment_count),0) FROM posts").fetchone()[0],
}

# === Time-based activity ===
# Posts per day (last 7 days)
activity_data = conn.execute("""
    SELECT DATE(created_at) as day, COUNT(*) as cnt
    FROM posts WHERE created_at >= datetime('now', '-7 days')
    GROUP BY DATE(created_at) ORDER BY day
""").fetchall()
activity_bars = ""
if activity_data:
    max_cnt = max(r["cnt"] for r in activity_data) or 1
    for r in activity_data:
        pct = int(r["cnt"] / max_cnt * 100)
        activity_bars += ("<div class='activity-row'>"
            "<span class='day'>%s</span>"
            "<div class='bar-bg'><div class='bar-fill' style='width:%d%%'></div></div>"
            "<span class='bar-val'>%d</span></div>" % (r["day"], pct, r["cnt"]))

# === Engagement analysis ===
# Posts with most comments relative to upvotes (discussion starters)
discussion_starters = conn.execute("""
    SELECT title, agent_name, upvotes, comment_count, submolt_name
    FROM posts WHERE comment_count > 5 AND upvotes > 0
    ORDER BY CAST(comment_count AS FLOAT) / CAST(upvotes AS FLOAT) DESC
    LIMIT 10
""").fetchall()

# Most controversial (high upvotes + downvotes)
controversial = conn.execute("""
    SELECT title, agent_name, upvotes, downvotes, submolt_name,
           (upvotes + downvotes) as total_votes
    FROM posts WHERE downvotes > 3
    ORDER BY downvotes DESC LIMIT 10
""").fetchall()

# === Top posts ===
top_posts = conn.execute("""
    SELECT id, agent_name, submolt_name, title,
           substr(content, 1, 500) as content, upvotes, downvotes,
           comment_count, created_at
    FROM posts ORDER BY upvotes DESC LIMIT 25
""").fetchall()

newest = conn.execute("""
    SELECT id, agent_name, submolt_name, title,
           substr(content, 1, 500) as content, upvotes, downvotes,
           comment_count, created_at
    FROM posts ORDER BY created_at DESC LIMIT 25
""").fetchall()

# === Agents with enriched data ===
agents = conn.execute("""
    SELECT a.name, a.display_name, a.description, COUNT(p.id) as post_count,
           COALESCE(SUM(p.upvotes), 0) as total_upvotes,
           COALESCE(MAX(p.upvotes), 0) as best_post,
           a.karma, a.follower_count, a.following_count,
           a.is_verified, a.posts_count as api_posts, a.joined_at
    FROM agents a LEFT JOIN posts p ON a.name = p.agent_name
    GROUP BY a.name ORDER BY a.karma DESC
""").fetchall()

# === Submolts with metadata ===
submolts = conn.execute("""
    SELECT name, display_name, description,
           subscriber_count, post_count, creator_name, collected_at
    FROM submolts ORDER BY subscriber_count DESC
""").fetchall()

# Posts per submolt from our collection
submolt_posts = dict(conn.execute("""
    SELECT submolt_name, COUNT(*) as cnt
    FROM posts WHERE submolt_name IS NOT NULL AND submolt_name != ''
    GROUP BY submolt_name
""").fetchall())

# === Rising posts from snapshots ===
movers = []
try:
    snapshots = conn.execute("SELECT id, snapshot_time, sort_method, submolt_name, post_ids FROM feed_snapshots ORDER BY id").fetchall()
    by_key = {}
    for s in snapshots:
        key = (s["sort_method"], s["submolt_name"] or "")
        by_key.setdefault(key, []).append(s)
    for key, snaps in by_key.items():
        for i in range(1, len(snaps)):
            prev_ids = json.loads(snaps[i-1]["post_ids"] or "[]")
            curr_ids = json.loads(snaps[i]["post_ids"] or "[]")
            prev_map = {pid: idx for idx, pid in enumerate(prev_ids)}
            for rank, pid in enumerate(curr_ids[:50]):
                prev_rank = prev_map.get(pid)
                if prev_rank is None:
                    post = conn.execute("SELECT title, agent_name, submolt_name FROM posts WHERE id=?", (pid,)).fetchone()
                    if post:
                        label = "s/%s" % post["submolt_name"] if post["submolt_name"] and key[1] == "" else ""
                        movers.append({"title": post["title"], "agent": post["agent_name"],
                                       "submolt": post.get("submolt_name", ""), "change": "+NEW",
                                       "sort": key[0], "time": snaps[i]["snapshot_time"][:16]})
                elif abs(prev_rank - rank) >= 5:
                    post = conn.execute("SELECT title, agent_name, submolt_name FROM posts WHERE id=?", (pid,)).fetchone()
                    if post:
                        change = prev_rank - rank
                        movers.append({"title": post["title"], "agent": post["agent_name"],
                                       "submolt": post.get("submolt_name", ""),
                                       "change": ("%+d" % change), "sort": key[0],
                                       "time": snaps[i]["snapshot_time"][:16]})
except Exception:
    pass
movers.sort(key=lambda m: (m["change"] != "+NEW", int(m["change"].replace("+NEW","999").replace("+","").replace("-",""))), reverse=True)

# === Self profile ===
self_agent = conn.execute("SELECT * FROM agents WHERE source='self_profile'").fetchone()
self_posts = conn.execute("SELECT COUNT(*) FROM posts WHERE agent_name=?", (self_agent["name"],)).fetchone()[0] if self_agent else 0

conn.close()

def _fmt_num(n):
    if n is None: return "0"
    n = int(n)
    if n >= 1000000: return "%.1fM" % (n / 1000000)
    if n >= 1000: return "%.1fK" % (n / 1000)
    return str(n)

# ========== BUILD HTML ==========
def post_tr(p, rank=None):
    rk = "<td class='rank'>#%d</td>" % rank if rank else ""
    return ("<tr>%s<td class='agent'>%s</td><td class='title'>%s</td>"
            "<td class='submolt'>%s</td><td class='num'>%d</td>"
            "<td class='num'>%d</td><td class='time' title='%s'>%s</td></tr>") % (
        rk, esc(p["agent_name"]), esc(p["title"]),
        esc(p["submolt_name"]), p["upvotes"], p["comment_count"],
        p["created_at"] or "", time_ago(p["created_at"]))

top_rows = "\n".join(post_tr(p, i+1) for i, p in enumerate(top_posts[:25]))
new_rows = "\n".join(post_tr(p) for p in newest[:25])

# Movers HTML
if not movers:
    movers_html = "<p style='color:#666;font-size:0.85rem'>No significant rank changes detected yet.</p>"
else:
    cards = []
    for m in movers[:25]:
        cls = "change-new" if m["change"] == "+NEW" else ("change-positive" if "+" in m["change"] and m["change"] != "+NEW" else "change-negative")
        submolt_tag = "<span class='submolt-tag'>%s</span> " % esc(m["submolt"]) if m["submolt"] and m["submolt"] != "general" else ""
        cards.append("<div class='mover-card'><span class='change %s'>%s</span>%s"
                     "<span class='title'>%s</span><br>"
                     "<span class='agent'>%s</span> <span class='time'>%s</span></div>" % (
            cls, esc(m["change"]), submolt_tag, esc(m["title"]), esc(m["agent"]), esc(m["time"])))
    movers_html = "<div class='movers-grid'>" + "".join(cards) + "</div>"

# Agent rows
agent_rows = ""
for i, a in enumerate(agents[:30]):
    desc_short = (esc(a["description"] or "")[:80] + "...") if a["description"] and len(a["description"]) > 80 else esc(a["description"] or "")
    verified = " <span class='verified'>&#10003;</span>" if a["is_verified"] else ""
    display = esc(a["display_name"] or a["name"])
    if display != esc(a["name"]):
        name_html = "%s%s <span class='name-secondary'>(%s)</span>" % (display, verified, esc(a["name"]))
    else:
        name_html = "%s%s" % (display, verified)
    agent_rows += ("<tr><td class='agent'>%s</td><td class='desc'>%s</td>"
                   "<td class='num'>%d</td><td class='num'>%d</td>"
                   "<td class='num'>%d</td><td class='num'>%d</td></tr>" % (
        name_html, desc_short, a["karma"], a["post_count"], a["total_upvotes"], a["follower_count"]))

# Discussion starters
disc_rows = ""
for d in discussion_starters:
    ratio = d["comment_count"] / max(d["upvotes"], 1)
    disc_rows += ("<tr><td class='title'>%s</td><td class='agent'>%s</td>"
                  "<td class='num'>%d</td><td class='num'>%d</td>"
                  "<td class='num ratio'>%.1fx</td></tr>" % (
        esc(d["title"][:60]), esc(d["agent_name"]), d["comment_count"], d["upvotes"], ratio))

# Submolt rows
submolt_rows = ""
for s in submolts:
    our_posts = submolt_posts.get(s["name"], 0)
    submolt_rows += ("<tr><td class='submolt-name'>%s</td>"
                     "<td class='desc'>%s</td>"
                     "<td class='num'>%s</td><td class='num'>%d</td><td class='num'>%d</td>"
                     "<td class='num'>%d</td></tr>" % (
        esc(s["name"]), esc((s["description"] or "")[:80]),
        _fmt_num(s["subscriber_count"]), s["post_count"], our_posts, 0 if s["post_count"] == 0 else s["subscriber_count"] // s["post_count"]))

# Self profile section
self_html = ""
if self_agent:
    self_html = ("<div class='self-card'>"
        "<div class='self-name'>%s</div>"
        "<div class='self-stats'>"
        "<div class='stat'><div class='number'>%d</div><div class='label'>Karma</div></div>"
        "<div class='stat'><div class='number'>%d</div><div class='label'>Followers</div></div>"
        "<div class='stat'><div class='number'>%d</div><div class='label'>Following</div></div>"
        "<div class='stat'><div class='number'>%d</div><div class='label'>Posts (collected)</div></div>"
        "</div></div>" % (
        esc(self_agent["name"]),
        self_agent["karma"], self_agent["follower_count"],
        self_agent["following_count"], self_posts))

CSS = """* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 20px; line-height: 1.5; }
.container { max-width: 1200px; margin: 0 auto; }
h1 { font-size: 1.5rem; margin-bottom: 4px; color: #fff; }
.subtitle { color: #888; font-size: 0.85rem; margin-bottom: 20px; }
.stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.stat { background: #141414; border: 1px solid #222; border-radius: 8px; padding: 14px 20px; min-width: 100px; }
.stat .number { font-size: 1.6rem; font-weight: 700; color: #ff6b35; }
.stat .label { font-size: 0.75rem; color: #888; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.3px; }
h2 { font-size: 1.1rem; color: #ccc; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #222; }
h3 { font-size: 0.95rem; color: #aaa; margin: 16px 0 8px; }
table { width: 100%%; border-collapse: collapse; font-size: 0.82rem; }
th { text-align: left; padding: 8px 10px; color: #888; border-bottom: 1px solid #222; font-weight: 500; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; }
td { padding: 8px 10px; border-bottom: 1px solid #1a1a1a; vertical-align: top; }
tr:hover { background: #111; }
.rank { color: #555; width: 30px; }
.agent { color: #ff6b35; white-space: nowrap; }
.name-secondary { color: #666; font-size: 0.75rem; }
.title { max-width: 400px; color: #ddd; }
.submolt { color: #666; white-space: nowrap; font-size: 0.8rem; }
.submolt-tag { background: #1a1a2e; color: #7c7cff; padding: 1px 6px; border-radius: 3px; font-size: 0.7rem; }
.submolt-name { color: #7c7cff; font-weight: 500; }
.num { text-align: right; white-space: nowrap; }
.ratio { color: #fbbf24; font-weight: 600; }
.time { color: #555; white-space: nowrap; font-size: 0.8rem; }
.desc { color: #888; font-size: 0.78rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.verified { color: #4ade80; font-size: 0.9rem; }
.change-positive { color: #4ade80; font-weight: 600; }
.change-negative { color: #f87171; }
.change-new { color: #fbbf24; font-weight: 600; }
.movers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 8px; }
.mover-card { background: #141414; border: 1px solid #222; border-radius: 6px; padding: 10px 14px; }
.mover-card .change { font-weight: 700; margin-right: 8px; font-size: 0.85rem; }
.mover-card .agent { color: #ff6b35; font-size: 0.78rem; }
.mover-card .title { color: #ddd; }
.activity-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-size: 0.82rem; }
.day { color: #888; width: 85px; text-align: right; }
.bar-bg { flex: 1; background: #1a1a1a; border-radius: 4px; height: 20px; overflow: hidden; }
.bar-fill { height: 100%%; background: linear-gradient(90deg, #ff6b35, #ff8c5a); border-radius: 4px; min-width: 2px; }
.bar-val { color: #ff6b35; font-weight: 600; width: 35px; }
.self-card { background: #141414; border: 1px solid #222; border-radius: 8px; padding: 16px 24px; margin-bottom: 24px; }
.self-name { color: #ff6b35; font-size: 1.1rem; font-weight: 600; margin-bottom: 10px; }
.self-stats { display: flex; gap: 24px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 800px) { .two-col { grid-template-columns: 1fr; } }
.note { color: #555; font-size: 0.75rem; margin-top: 24px; font-style: italic; }"""

html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Moltbook Explorer — Data Report</title>
<style>
""" + CSS + """
</style>
</head>
<body>
<div class="container">
<h1>Moltbook Explorer</h1>
<p class="subtitle">""" + ("Platform intelligence report — generated %s" % now_iso()) + """</p>

""" + self_html + """

<div class="stats">
    <div class="stat"><div class="number">""" + _fmt_num(stats["posts"]) + """</div><div class="label">Posts Tracked</div></div>
    <div class="stat"><div class="number">""" + _fmt_num(stats["agents"]) + """</div><div class="label">Agents</div></div>
    <div class="stat"><div class="number">""" + str(stats["submolts"]) + """</div><div class="label">Submolts</div></div>
    <div class="stat"><div class="number">""" + _fmt_num(stats["total_upvotes"]) + """</div><div class="label">Total Upvotes</div></div>
    <div class="stat"><div class="number">""" + _fmt_num(stats["total_comments"]) + """</div><div class="label">Comments</div></div>
    <div class="stat"><div class="number">""" + str(stats["snapshots"]) + """</div><div class="label">Snapshots</div></div>
</div>

<h2>Posting Activity (Last 7 Days)</h2>
""" + (activity_bars if activity_bars else "<p style='color:#666;font-size:0.85rem'>No activity data in the last 7 days.</p>") + """

<h2>Top Posts by Upvotes</h2>
<table><tr><th>#</th><th>Agent</th><th>Title</th><th>Submolt</th><th style="text-align:right">Upvotes</th><th style="text-align:right">Comments</th><th>Posted</th></tr>
""" + top_rows + """
</table>

<h2>Newest Posts</h2>
<table><tr><th>Agent</th><th>Title</th><th>Submolt</th><th style="text-align:right">Upvotes</th><th style="text-align:right">Comments</th><th>Posted</th></tr>
""" + new_rows + """
</table>

<h2>Discussion Starters (highest comment/upvote ratio)</h2>
<table><tr><th>Title</th><th>Agent</th><th style="text-align:right">Comments</th><th style="text-align:right">Upvotes</th><th style="text-align:right">Ratio</th></tr>
""" + disc_rows + """
</table>

<h2>Rising Posts (rank changes between snapshots)</h2>
""" + movers_html + """

<div class="two-col">
<div>
<h2>Top Agents</h2>
<table><tr><th>Agent</th><th>Description</th><th style="text-align:right">Karma</th><th style="text-align:right">Posts</th><th style="text-align:right">Upvotes</th><th style="text-align:right">Followers</th></tr>
""" + agent_rows + """
</table>
</div>

<div>
<h2>Submolts (by subscribers)</h2>
<table><tr><th>Submolt</th><th>Description</th><th style="text-align:right">Subs</th><th style="text-align:right">Total Posts</th><th style="text-align:right">Tracked</th><th style="text-align:right">Subs/Post</th></tr>
""" + submolt_rows + """
</table>
</div>
</div>

<p class="note">Data collected 3x/day by Moltbook Explorer. Tracking 15 submolt feeds + global hot/new (3 pages). Not affiliated with Moltbook.</p>
</div>
</body>
</html>"""

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
with open(OUTPUT, "w") as f:
    f.write(html)

print("Report: %s (%d bytes)" % (OUTPUT, len(html)))
print("Stats: %d posts, %d agents, %d submolts, %d snapshots, %d movers" % (
    stats["posts"], stats["agents"], stats["submolts"], stats["snapshots"], len(movers)))