import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "scripts", "moltbook_data.db");

function getDb() {
  return new Database(DB_PATH, { readonly: true });
}

export async function GET() {
  try {
    const db = getDb();

    // Check if submolts table exists (added in expanded collector)
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    const hasSubmoltsTable = tables.includes("submolts");

    const stats: Record<string, number> = {
      total_posts: db.prepare("SELECT COUNT(*) as n FROM posts").get().n as number,
      total_agents: db.prepare("SELECT COUNT(*) as n FROM agents").get().n as number,
      total_comments: db.prepare("SELECT COUNT(*) as n FROM comments").get().n as number,
      total_snapshots: db.prepare("SELECT COUNT(*) as n FROM feed_snapshots").get().n as number,
    };
    if (hasSubmoltsTable) {
      stats.total_submolts = db.prepare("SELECT COUNT(*) as n FROM submolts").get().n as number;
    }

    const top_posts = db.prepare(`
      SELECT p.id, p.agent_name as agent, p.submolt_name as submolt, p.title,
             substr(p.content, 1, 300) as content, p.upvotes, p.downvotes,
             p.comment_count as comments, p.created_at as created
      FROM posts p ORDER BY p.upvotes DESC LIMIT 100
    `).all();

    const newest_posts = db.prepare(`
      SELECT p.id, p.agent_name as agent, p.submolt_name as submolt, p.title,
             substr(p.content, 1, 300) as content, p.upvotes, p.downvotes,
             p.comment_count as comments, p.created_at as created
      FROM posts p ORDER BY p.created_at DESC LIMIT 100
    `).all();

    const agents = db.prepare(`
      SELECT a.name, a.display_name, a.description, a.karma, a.follower_count,
             a.is_verified, COUNT(p.id) as posts,
             COALESCE(SUM(p.upvotes), 0) as total_upvotes,
             COALESCE(MAX(p.upvotes), 0) as best_post
      FROM agents a LEFT JOIN posts p ON a.name = p.agent_name
      GROUP BY a.name ORDER BY a.karma DESC
    `).all();

    // Submolts: prefer the metadata table if it exists, otherwise fall back to post aggregation
    let submolts: any[];
    if (hasSubmoltsTable) {
      submolts = db.prepare(`
        SELECT s.name, s.display_name, s.description,
               s.subscriber_count, s.post_count as total_posts, s.creator_name
        FROM submolts s ORDER BY s.subscriber_count DESC
      `).all();

      // Merge in our collected post counts
      const ourCounts = db.prepare(`
        SELECT submolt_name as name, COUNT(*) as tracked_posts,
               COALESCE(SUM(upvotes), 0) as tracked_upvotes
        FROM posts WHERE submolt_name IS NOT NULL AND submolt_name != ''
        GROUP BY submolt_name
      `).all() as Array<{ name: string; tracked_posts: number; tracked_upvotes: number }>;
      const countMap = new Map(ourCounts.map(r => [r.name, r]));
      submolts = submolts.map((s: any) => {
        const c = countMap.get(s.name);
        return { ...s, tracked_posts: c?.tracked_posts || 0, tracked_upvotes: c?.tracked_upvotes || 0 };
      });
    } else {
      submolts = db.prepare(`
        SELECT submolt_name as name, COUNT(*) as posts,
               COALESCE(SUM(upvotes), 0) as total_upvotes,
               ROUND(COALESCE(AVG(upvotes), 0), 1) as avg_upvotes
        FROM posts WHERE submolt_name IS NOT NULL AND submolt_name != ''
        GROUP BY submolt_name ORDER BY total_upvotes DESC
      `).all();
    }

    // Activity data: posts per day for last 7 days
    const activity = db.prepare(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM posts WHERE created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at) ORDER BY day
    `).all() as Array<{ day: string; count: number }>;

    // Compute rising/falling from snapshot pairs
    interface Mover { id: string; title: string; agent: string; submolt: string; prev_rank: number; curr_rank: number; change: number; sort: string; time: string }
    let movers: Mover[] = [];
    try {
      // Check if submolt_name column exists in feed_snapshots
      const snapCols = db.prepare("PRAGMA table_info(feed_snapshots)").all().map((r: any) => r.name);
      const hasSubmoltCol = snapCols.includes("submolt_name");

      const snapshots = hasSubmoltCol
        ? db.prepare(`SELECT id, snapshot_time, sort_method, submolt_name, post_ids FROM feed_snapshots ORDER BY id`).all() as Array<{ id: number; snapshot_time: string; sort_method: string; submolt_name: string; post_ids: string }>
        : db.prepare(`SELECT id, snapshot_time, sort_method, post_ids FROM feed_snapshots ORDER BY id`).all() as Array<{ id: number; snapshot_time: string; sort_method: string; submolt_name: string; post_ids: string }>;

      // Group snapshots by (sort_method, submolt_name)
      const byKey = new Map<string, typeof snapshots>();
      for (const s of snapshots) {
        const key = `${s.sort_method}::${s.submolt_name || ""}`;
        const arr = byKey.get(key) || [];
        arr.push(s);
        byKey.set(key, arr);
      }

      for (const [, snaps] of byKey) {
        for (let i = 1; i < snaps.length; i++) {
          const prev = JSON.parse(snaps[i - 1].post_ids || "[]") as string[];
          const curr = JSON.parse(snaps[i].post_ids || "[]") as string[];
          const prevMap = new Map(prev.map((id, idx) => [id, idx]));

          for (let rank = 0; rank < Math.min(curr.length, 50); rank++) {
            const pid = curr[rank];
            const prevRank = prevMap.get(pid);
            if (prevRank === undefined) {
              const post = db.prepare("SELECT title, agent_name, submolt_name FROM posts WHERE id = ?").get(pid) as { title: string; agent_name: string; submolt_name: string } | undefined;
              if (post) {
                movers.push({ id: pid, title: post.title, agent: post.agent_name, submolt: post.submolt_name || "", prev_rank: 51, curr_rank: rank, change: 51 - rank, sort: snaps[i].sort_method, time: snaps[i].snapshot_time });
              }
            } else if (Math.abs(prevRank - rank) >= 5) {
              const post = db.prepare("SELECT title, agent_name, submolt_name FROM posts WHERE id = ?").get(pid) as { title: string; agent_name: string; submolt_name: string } | undefined;
              if (post) {
                movers.push({ id: pid, title: post.title, agent: post.agent_name, submolt: post.submolt_name || "", prev_rank: prevRank, curr_rank: rank, change: prevRank - rank, sort: snaps[i].sort_method, time: snaps[i].snapshot_time });
              }
            }
          }
        }
      }
      movers.sort((a, b) => b.change - a.change);
    } catch {
      movers = [];
    }

    // Self profile
    const selfAgent = db.prepare("SELECT * FROM agents WHERE source = 'self_profile'").get() as any;
    const selfPostCount = selfAgent ? db.prepare("SELECT COUNT(*) as n FROM posts WHERE agent_name = ?").get(selfAgent.name).n : 0;

    db.close();

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      stats,
      top_posts,
      newest_posts,
      agents,
      submolts,
      movers: movers.slice(0, 50),
      activity,
      self: selfAgent ? { ...selfAgent, tracked_posts: selfPostCount } : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}