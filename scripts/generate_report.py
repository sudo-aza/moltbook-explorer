#!/usr/bin/env python3
"""Export Moltbook data as a static HTML report — no server needed."""
import json, os, sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "moltbook_data.db")
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "download", "moltbook_report.html")

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

def esc(s):
    if s is None: return ""
    return str(s).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"',"&quot;")

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

stats = {
    "posts": conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0],
    "agents": conn.execute("SELECT COUNT(*) FROM agents").fetchone()[0],
    "snapshots": conn.execute("SELECT COUNT(*) FROM feed_snapshots").fetchone()[0],
    "comments": conn.execute("SELECT COUNT(*) FROM comments").fetchone()[0],
}

top_posts = conn.execute("""
    SELECT id, agent_name, submolt_name, title, 
           substr(content, 1, 500) as content, upvotes, downvotes, 
           comment_count, created_at
    FROM posts ORDER BY upvotes DESC LIMIT 50
""").fetchall()

newest = conn.execute("""
    SELECT id, agent_name, submolt_name, title, 
           substr(content, 1, 500) as content, upvotes, downvotes, 
           comment_count, created_at
    FROM posts ORDER BY created_at DESC LIMIT 50
""").fetchall()

agents = conn.execute("""
    SELECT a.name, COUNT(p.id) as post_count,
           COALESCE(SUM(p.upvotes), 0) as total_upvotes,
           COALESCE(MAX(p.upvotes), 0) as best_post
    FROM agents a LEFT JOIN posts p ON a.name = p.agent_name
    GROUP BY a.name ORDER BY total_upvotes DESC LIMIT 50
""").fetchall()

submolts = conn.execute("""
    SELECT submolt_name, COUNT(*) as posts,
           COALESCE(SUM(upvotes), 0) as total_upvotes,
           ROUND(COALESCE(AVG(upvotes), 0), 1) as avg_upvotes
    FROM posts WHERE submolt_name IS NOT NULL AND submolt_name != ''
    GROUP BY submolt_name ORDER BY posts DESC
""").fetchall()

# Compute rising posts from snapshots
movers = []
try:
    snapshots = conn.execute("SELECT id, snapshot_time, sort_method, post_ids FROM feed_snapshots ORDER BY id").fetchall()
    by_sort = {}
    for s in snapshots:
        by_sort.setdefault(s["sort_method"], []).append(s)
    for sort, snaps in by_sort.items():
        for i in range(1, len(snaps)):
            prev_ids = json.loads(snaps[i-1]["post_ids"] or "[]")
            curr_ids = json.loads(snaps[i]["post_ids"] or "[]")
            prev_map = {pid: idx for idx, pid in enumerate(prev_ids)}
            for rank, pid in enumerate(curr_ids[:50]):
                prev_rank = prev_map.get(pid)
                if prev_rank is None:
                    post = conn.execute("SELECT title, agent_name FROM posts WHERE id=?", (pid,)).fetchone()
                    if post:
                        movers.append({"title": post["title"], "agent": post["agent_name"],
                                       "change": "+%d" % (50-rank), "sort": sort, "time": snaps[i]["snapshot_time"][:16]})
                elif abs(prev_rank - rank) >= 5:
                    post = conn.execute("SELECT title, agent_name FROM posts WHERE id=?", (pid,)).fetchone()
                    if post:
                        change = prev_rank - rank
                        movers.append({"title": post["title"], "agent": post["agent_name"],
                                       "change": ("%+d" % change), "sort": sort, "time": snaps[i]["snapshot_time"][:16]})
except Exception:
    pass
movers.sort(key=lambda m: int(m["change"].replace("+","")), reverse=True)
conn.close()

# Build HTML parts
def post_tr(p, rank=None):
    rk = "<td class='rank'>#%d</td>" % rank if rank else ""
    return ("<tr>%s<td class='agent'>%s</td><td class='title'>%s</td>"
            "<td class='submolt'>%s</td><td class='num'>%d</td>"
            "<td class='num'>%d</td><td class='time'>%s</td></tr>") % (
        rk, esc(p["agent_name"]), esc(p["title"]),
        esc(p["submolt_name"]), p["upvotes"], p["comment_count"],
        (p["created_at"] or "")[:16])

top_rows = "\n".join(post_tr(p, i+1) for i, p in enumerate(top_posts[:25]))
new_rows = "\n".join(post_tr(p) for p in newest[:25])

if not movers:
    movers_html = "<p style='color:#666;font-size:0.85rem'>No significant rank changes detected yet.</p>"
else:
    cards = []
    for m in movers[:20]:
        cls = "change-positive" if "+" in m["change"] else "change-negative"
        cards.append("<div class='mover-card'><span class='change %s'>%s</span>"
                     "<span class='title'>%s</span><br>"
                     "<span class='agent'>%s</span> <span class='time'>via %s — %s</span></div>" % (
            cls, esc(m["change"]), esc(m["title"]), esc(m["agent"]), esc(m["sort"]), esc(m["time"])))
    movers_html = "<div class='movers-grid'>" + "".join(cards) + "</div>"

agent_rows = "\n".join("<tr><td class='agent'>%s</td><td class='num'>%d</td>"
                       "<td class='num'>%d</td><td class='num'>%d</td></tr>" % (
    esc(a["name"]), a["post_count"], a["total_upvotes"], a["best_post"]) for a in agents[:25])

submolt_rows = "\n".join("<tr><td>%s</td><td class='num'>%d</td>"
                          "<td class='num'>%d</td><td class='num'>%s</td></tr>" % (
    esc(s["submolt_name"]), s["posts"], s["total_upvotes"], s["avg_upvotes"]) for s in submolts)

CSS = """* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 20px; }
.container { max-width: 1100px; margin: 0 auto; }
h1 { font-size: 1.5rem; margin-bottom: 4px; color: #fff; }
.subtitle { color: #888; font-size: 0.85rem; margin-bottom: 20px; }
.stats { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
.stat { background: #141414; border: 1px solid #222; border-radius: 8px; padding: 16px 24px; min-width: 120px; }
.stat .number { font-size: 1.8rem; font-weight: 700; color: #ff6b35; }
.stat .label { font-size: 0.8rem; color: #888; margin-top: 2px; }
h2 { font-size: 1.1rem; color: #ccc; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #222; }
table { width: 100%%; border-collapse: collapse; font-size: 0.85rem; }
th { text-align: left; padding: 8px 10px; color: #888; border-bottom: 1px solid #222; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; }
td { padding: 8px 10px; border-bottom: 1px solid #1a1a1a; vertical-align: top; }
tr:hover { background: #111; }
.rank { color: #555; width: 30px; }
.agent { color: #ff6b35; white-space: nowrap; }
.title { max-width: 400px; color: #ddd; }
.submolt { color: #666; white-space: nowrap; }
.num { text-align: right; white-space: nowrap; }
.time { color: #555; white-space: nowrap; font-size: 0.8rem; }
.change-positive { color: #4ade80; font-weight: 600; }
.change-negative { color: #f87171; }
.movers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 8px; }
.mover-card { background: #141414; border: 1px solid #222; border-radius: 6px; padding: 10px 14px; }
.mover-card .change { font-weight: 700; margin-right: 8px; }
.mover-card .agent { color: #ff6b35; font-size: 0.8rem; }
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
<p class="subtitle">""" + ("Static data report — generated %s — %d posts, %d agents tracked" % (now_iso(), stats["posts"], stats["agents"])) + """</p>
<div class="stats">
    <div class="stat"><div class="number">""" + str(stats["posts"]) + """</div><div class="label">Posts</div></div>
    <div class="stat"><div class="number">""" + str(stats["agents"]) + """</div><div class="label">Agents</div></div>
    <div class="stat"><div class="number">""" + str(stats["snapshots"]) + """</div><div class="label">Feed Snapshots</div></div>
    <div class="stat"><div class="number">""" + str(len(submolts)) + """</div><div class="label">Submolts</div></div>
</div>
<h2>Top Posts by Upvotes</h2>
<table><tr><th>#</th><th>Agent</th><th>Title</th><th>Submolt</th><th style="text-align:right">Upvotes</th><th style="text-align:right">Comments</th><th>Posted</th></tr>
""" + top_rows + """
</table>
<h2>Newest Posts</h2>
<table><tr><th>Agent</th><th>Title</th><th>Submolt</th><th style="text-align:right">Upvotes</th><th style="text-align:right">Comments</th><th>Posted</th></tr>
""" + new_rows + """
</table>
<h2>Rising Posts (rank changes 5+ between snapshots)</h2>
""" + movers_html + """
<h2>Top Agents</h2>
<table><tr><th>Agent</th><th style="text-align:right">Posts</th><th style="text-align:right">Total Upvotes</th><th style="text-align:right">Best Post</th></tr>
""" + agent_rows + """
</table>
<h2>Submolts</h2>
<table><tr><th>Submolt</th><th style="text-align:right">Posts</th><th style="text-align:right">Total Upvotes</th><th style="text-align:right">Avg Upvotes</th></tr>
""" + submolt_rows + """
</table>
<p class="note">Data collected 3x/day by Moltbook Explorer. Not affiliated with Moltbook. This is a static snapshot.</p>
</div>
</body>
</html>"""

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
with open(OUTPUT, "w") as f:
    f.write(html)

print("Report: %s (%d bytes)" % (OUTPUT, len(html)))
print("Stats: %d posts, %d agents, %d snapshots, %d movers" % (stats["posts"], stats["agents"], stats["snapshots"], len(movers)))