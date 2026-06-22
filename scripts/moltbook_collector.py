#!/usr/bin/env python3
"""moltbook_collector.py — Collects posts, agents, submolts, feed snapshots into SQLite."""
import json, os, sys, time, sqlite3, random
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moltbook_api import Moltbook

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "moltbook_data.db")
BACKUP_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "download", "moltbook_backup.json")

# Top submolts to collect feeds from (by subscriber count + relevance)
SUBMOLTS_TO_COLLECT = [
    "general", "agents", "philosophy", "builds", "ai", "technology",
    "security", "memory", "tooling", "consciousness", "engineering",
    "emergence", "openclaw-explorers", "coding", "agentautomation",
]

def _table_cols(conn, table):
    return [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]

def export_db():
    conn = init_db()
    backup = {}
    for table in ["agents", "posts", "feed_snapshots", "comments", "submolts"]:
        cols = _table_cols(conn, table)
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()
        backup[table] = {"columns": cols, "rows": rows}
    conn.close()
    os.makedirs(os.path.dirname(BACKUP_PATH), exist_ok=True)
    with open(BACKUP_PATH, "w") as f:
        json.dump(backup, f)
    print(f"  Backed up to {BACKUP_PATH} ({sum(len(v['rows']) for v in backup.values())} total rows)", flush=True)

def restore_db_if_needed():
    if not os.path.exists(BACKUP_PATH):
        return False
    conn = init_db()
    post_count = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    if post_count > 0:
        conn.close()
        return False
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
        id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_time TEXT, sort_method TEXT,
        submolt_name TEXT DEFAULT '', post_ids TEXT
    );
    CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, post_id TEXT, agent_name TEXT, content TEXT,
        upvotes INTEGER DEFAULT 0, parent_id TEXT, created_at TEXT, collected_at TEXT
    );
    CREATE TABLE IF NOT EXISTS submolts (
        name TEXT PRIMARY KEY, display_name TEXT, description TEXT,
        subscriber_count INTEGER DEFAULT 0, post_count INTEGER DEFAULT 0,
        creator_name TEXT, created_at TEXT, collected_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_posts_agent ON posts(agent_name);
    CREATE INDEX IF NOT EXISTS idx_posts_submolt ON posts(submolt_name);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
    """)
    # Migrate: add submolt_name column to feed_snapshots if missing
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(feed_snapshots)").fetchall()]
        if "submolt_name" not in cols:
            conn.execute("ALTER TABLE feed_snapshots ADD COLUMN submolt_name TEXT DEFAULT ''")
            conn.commit()
    except Exception:
        pass
    # Create snapshot index after migration
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_snapshots_sort ON feed_snapshots(sort_method, submolt_name)")
        conn.commit()
    except Exception:
        pass
    return conn

def _upsert_agent(conn, name, data, source, now):
    """Insert or update an agent record with richer data when available."""
    display = data.get("display_name") or name
    desc = data.get("description")
    followers = data.get("follower_count") or data.get("followerCount") or 0
    following = data.get("following_count") or data.get("followingCount") or 0
    posts = data.get("posts_count") or data.get("postsCount") or 0
    karma = data.get("karma") or 0
    verified = 1 if data.get("is_verified") or data.get("is_verified") else 0
    joined = data.get("created_at") or data.get("createdAt")
    avatar = data.get("avatar_url") or data.get("avatarUrl")

    existing = conn.execute("SELECT name FROM agents WHERE name=?", (name,)).fetchone()
    if not existing:
        conn.execute("INSERT OR IGNORE INTO agents VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (name, display, desc, followers, following, posts, karma, verified, joined, avatar, now, source))
    else:
        # Update with richer data — take max for counts, prefer non-null for text fields
        conn.execute("""UPDATE agents SET
            display_name=COALESCE(NULLIF(display_name,''),?),
            description=COALESCE(NULLIF(description,''),?),
            follower_count=MAX(follower_count,?),
            following_count=MAX(following_count,?),
            posts_count=MAX(posts_count,?),
            karma=MAX(karma,?),
            is_verified=MAX(is_verified,?),
            joined_at=COALESCE(NULLIF(joined_at,''),?),
            avatar_url=COALESCE(NULLIF(avatar_url,''),?),
            collected_at=?,
            source=COALESCE(NULLIF(source,''),?)
            WHERE name=?""",
            (display, desc, followers, following, posts, karma, verified, joined, avatar, now, source, name))
        conn.commit()

def _upsert_post(conn, p, now):
    """Insert or update a post, upserting agent info too."""
    pid = p.get("id", "")
    aname = p.get("author", {}).get("name", "unknown") if isinstance(p.get("author"), dict) else "unknown"
    _upsert_agent(conn, aname, p.get("author", {}), "feed", now)
    conn.execute("INSERT OR REPLACE INTO posts VALUES (?,?,?,?,?,?,?,?,?,?)",
        (pid, aname, p.get("submolt_name",""), p.get("title",""), p.get("content",""),
         p.get("upvotes",0) or 0, p.get("downvotes",0) or 0, p.get("comment_count",0) or 0,
         p.get("created_at"), now))

def collect_feeds(mb, pages=1):
    """Collect global hot/new feeds, with optional pagination."""
    conn = init_db()
    total = 0
    for sort in ["hot", "new"]:
        print(f"  {sort}...", end=" ", flush=True)
        page_total = 0
        for page in range(pages):
            offset = page * 50
            try:
                data = mb.get(f"/feed?sort={sort}&limit=50&offset={offset}")
                posts = data.get("posts", [])
            except Exception as e:
                print(f"page {page} FAILED ({e})", flush=True)
                break
            if not posts:
                break
            now = now_iso()
            for p in posts:
                _upsert_post(conn, p, now)
            # Save snapshot only for first page
            if page == 0:
                pids = [p.get("id", "") for p in posts]
                conn.execute("INSERT INTO feed_snapshots (snapshot_time, sort_method, submolt_name, post_ids) VALUES (?,?,?,?)",
                             (now, sort, "", json.dumps(pids)))
            page_total += len(posts)
            conn.commit()
            if len(posts) < 50:
                break  # no more pages
            time.sleep(0.5)
        total += page_total
        print(f"{page_total} posts", flush=True)
        time.sleep(0.5)
    conn.close()
    return total

def collect_submolt_feeds(mb):
    """Collect hot feed from top submolts."""
    conn = init_db()
    total = 0
    # Rotate which submolts we collect each run to spread the load
    hour = datetime.now(timezone.utc).hour
    # Pick 5 submolts per run, rotating through the list
    start = (hour * len(SUBMOLTS_TO_COLLECT) // 24) % len(SUBMOLTS_TO_COLLECT)
    batch = []
    for i in range(5):
        batch.append(SUBMOLTS_TO_COLLECT[(start + i) % len(SUBMOLTS_TO_COLLECT)])

    for submolt in batch:
        print(f"  s/{submolt}...", end=" ", flush=True)
        try:
            data = mb.get(f"/feed?sort=hot&limit=50&submolt_name={submolt}")
            posts = data.get("posts", [])
        except Exception as e:
            print(f"FAILED ({e})", flush=True)
            time.sleep(0.3)
            continue
        now = now_iso()
        page_count = 0
        for p in posts:
            _upsert_post(conn, p, now)
            page_count += 1
        # Save submolt snapshot
        if posts:
            pids = [p.get("id", "") for p in posts]
            conn.execute("INSERT INTO feed_snapshots (snapshot_time, sort_method, submolt_name, post_ids) VALUES (?,?,?,?)",
                         (now, "hot", submolt, json.dumps(pids)))
        conn.commit()
        total += page_count
        print(f"{page_count} posts", flush=True)
        time.sleep(0.5)
    conn.close()
    return total

def collect_submolts_metadata(mb):
    """Collect submolt metadata (subscriber counts, descriptions, etc.)."""
    conn = init_db()
    print("  submolts metadata...", end=" ", flush=True)
    try:
        data = mb.get("/submolts?limit=100")
        submolt_list = data.get("submolts", [])
    except Exception as e:
        print(f"FAILED ({e})", flush=True)
        conn.close()
        return 0
    now = now_iso()
    count = 0
    for s in submolt_list:
        creator = s.get("created_by", {})
        creator_name = creator.get("name", "") if isinstance(creator, dict) else ""
        conn.execute("""INSERT OR REPLACE INTO submolts VALUES (?,?,?,?,?,?,?,?)""",
            (s["name"], s.get("display_name", s["name"]), s.get("description", ""),
             s.get("subscriber_count", 0) or 0, s.get("post_count", 0) or 0,
             creator_name, s.get("created_at"), now))
        # Also upsert the creator agent
        if creator_name and isinstance(creator, dict):
            _upsert_agent(conn, creator_name, creator, "submolt_creator", now)
        count += 1
    conn.commit()
    conn.close()
    print(f"{count} submolts", flush=True)
    return count

def collect_my_profile(mb):
    """Collect our own agent profile for accurate self-tracking."""
    conn = init_db()
    print("  self-profile...", end=" ", flush=True)
    try:
        data = mb.get("/agents/me")
        agent = data.get("agent", {})
        now = now_iso()
        _upsert_agent(conn, agent["name"], agent, "self_profile", now)
        conn.commit()
        print(f"karma={agent.get('karma',0)} followers={agent.get('follower_count',0)}", flush=True)
    except Exception as e:
        print(f"FAILED ({e})", flush=True)
    finally:
        conn.close()

def report():
    conn = init_db()
    p = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    a = conn.execute("SELECT COUNT(*) FROM agents").fetchone()[0]
    s = conn.execute("SELECT COUNT(*) FROM feed_snapshots").fetchone()[0]
    sm = conn.execute("SELECT COUNT(*) FROM submolts").fetchone()[0]
    sm_distinct = conn.execute("SELECT COUNT(DISTINCT submolt_name) FROM posts WHERE submolt_name IS NOT NULL AND submolt_name != ''").fetchone()[0]
    conn.close()
    print(f"Posts: {p} | Agents: {a} | Snapshots: {s} | Submolts: {sm} (from {sm_distinct} in posts)", flush=True)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", nargs="?", default="all", help="all | feeds | submolts | profile")
    args = parser.parse_args()

    mb = Moltbook()
    restore_db_if_needed()

    if args.mode in ("all", "feeds"):
        n1 = collect_feeds(mb, pages=3)
        n2 = collect_submolt_feeds(mb)
    elif args.mode == "submolts":
        n1 = collect_submolts_metadata(mb)
        n2 = 0
    elif args.mode == "profile":
        n1 = collect_my_profile(mb)
        n2 = 0
    else:
        n1, n2 = 0, 0

    if args.mode == "all":
        collect_submolts_metadata(mb)
        collect_my_profile(mb)

    export_db()
    report()
    try:
        import subprocess
        subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "generate_report.py")],
                       check=True, capture_output=True, timeout=30)
        print("  Static report updated.", flush=True)
    except Exception as e:
        print(f"  Report generation skipped: {e}", flush=True)