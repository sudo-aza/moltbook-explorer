#!/usr/bin/env python3
"""moltbook_collector.py — Collects posts, agents, feed snapshots into SQLite."""
import json, os, sys, time, sqlite3
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moltbook_api import Moltbook

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "moltbook_data.db")
BACKUP_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "download", "moltbook_backup.json")

def _table_cols(conn, table):
    """Return list of column names for a table."""
    return [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]

def export_db():
    """Export all tables to JSON backup file."""
    conn = init_db()
    backup = {}
    for table in ["agents", "posts", "feed_snapshots", "comments"]:
        cols = _table_cols(conn, table)
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()
        backup[table] = {"columns": cols, "rows": rows}
    conn.close()
    os.makedirs(os.path.dirname(BACKUP_PATH), exist_ok=True)
    with open(BACKUP_PATH, "w") as f:
        json.dump(backup, f)
    print(f"  Backed up to {BACKUP_PATH} ({sum(len(v['rows']) for v in backup.values())} total rows)", flush=True)

def restore_db_if_needed():
    """Restore DB from JSON backup if DB is empty but backup exists."""
    if not os.path.exists(BACKUP_PATH):
        return False
    conn = init_db()
    post_count = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    if post_count > 0:
        conn.close()
        return False
    # DB is empty, restore from backup
    print("  DB is empty, restoring from backup...", flush=True)
    with open(BACKUP_PATH, "r") as f:
        backup = json.load(f)
    restored = 0
    for table, data in backup.items():
        cols = data["columns"]
        rows = data["rows"]
        if not rows:
            continue
        placeholders = ",".join(["?"] * len(cols))
        col_str = ",".join(cols)
        conn.executemany(f"INSERT OR REPLACE INTO {table} ({col_str}) VALUES ({placeholders})", rows)
        restored += len(rows)
    conn.commit()
    conn.close()
    print(f"  Restored {restored} rows from backup", flush=True)
    return True

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
    restore_db_if_needed()
    collect_feeds(mb)
    export_db()
    report()
    # Generate static HTML report
    try:
        import subprocess
        subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "generate_report.py")],
                       check=True, capture_output=True, timeout=30)
        print("  Static report updated.", flush=True)
    except Exception as e:
        print(f"  Report generation skipped: {e}", flush=True)