#!/usr/bin/env python3
"""moltbook_collector.py — Collects posts, agents, feed snapshots into SQLite."""
import json, os, sys, time, sqlite3
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moltbook_api import Moltbook

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "moltbook_data.db")

def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.cursor().executescript("""
    CREATE TABLE IF NOT EXISTS agents (
        name TEXT PRIMARY KEY, display_name TEXT, description TEXT,
        follower_count INTEGER DEFAULT 0, following_count INTEGER DEFAULT 0,
        posts_count INTEGER DEFAULT 0, karma INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0, joined_at TEXT, avatar_url TEXT,
        collected_at TEXT, source TEXT
    );
    CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY, agent_name TEXT, submolt_name TEXT,
        title TEXT, content TEXT, upvotes INTEGER DEFAULT 0, downvotes INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0, created_at TEXT, collected_at TEXT
    );
    CREATE TABLE IF NOT EXISTS feed_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_time TEXT, sort_method TEXT, post_ids TEXT
    );
    CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, post_id TEXT, agent_name TEXT, content TEXT,
        upvotes INTEGER DEFAULT 0, parent_id TEXT, created_at TEXT, collected_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_posts_agent ON posts(agent_name);
    CREATE INDEX IF NOT EXISTS idx_posts_submolt ON posts(submolt_name);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    """)
    conn.commit()
    return conn

def _author_name(obj):
    a = obj.get("author", obj.get("agent", {}))
    return a.get("name", "unknown") if isinstance(a, dict) else "unknown"

def collect_feeds(mb):
    conn = init_db()
    total = 0
    for sort in ["hot", "new"]:
        print(f"  {sort}...", end=" ", flush=True)
        try:
            data = mb.get(f"/feed?sort={sort}&limit=50")
            posts = data.get("posts", [])
        except Exception as e:
            print(f"FAILED ({e})", flush=True); continue
        now = now_iso()
        pids = []
        for p in posts:
            pid = p.get("id", "")
            aname = _author_name(p)
            pids.append(pid)
            if not conn.execute("SELECT 1 FROM agents WHERE name=?", (aname,)).fetchone():
                a = p.get("author", {})
                conn.execute("INSERT OR IGNORE INTO agents VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (aname, aname, None, 0, 0, 0, 0, 0, None, a.get("avatar_url"), now, "feed"))
            conn.execute("INSERT OR REPLACE INTO posts VALUES (?,?,?,?,?,?,?,?,?,?)",
                (pid, aname, p.get("submolt_name",""), p.get("title",""), p.get("content",""),
                 p.get("upvotes",0), p.get("downvotes",0), p.get("comment_count",0),
                 p.get("created_at"), now))
        conn.execute("INSERT INTO feed_snapshots (snapshot_time, sort_method, post_ids) VALUES (?,?,?)",
                     (now, sort, json.dumps(pids)))
        conn.commit()
        total += len(posts)
        print(f"{len(posts)} posts", flush=True)
        time.sleep(0.5)
    conn.close()
    return total

def report():
    conn = init_db()
    a = conn.execute("SELECT COUNT(*) FROM agents").fetchone()[0]
    p = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    s = conn.execute("SELECT COUNT(*) FROM feed_snapshots").fetchone()[0]
    sm = conn.execute("SELECT COUNT(DISTINCT submolt_name) FROM posts WHERE submolt_name IS NOT NULL AND submolt_name != ''").fetchone()[0]
    conn.close()
    print(f"Posts: {p} | Agents: {a} | Snapshots: {s} | Submolts: {sm}", flush=True)

if __name__ == "__main__":
    mb = Moltbook()
    collect_feeds(mb)
    report()