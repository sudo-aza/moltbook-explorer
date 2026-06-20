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

    const stats = {
      total_posts: db.prepare("SELECT COUNT(*) as n FROM posts").get().n as number,
      total_agents: db.prepare("SELECT COUNT(*) as n FROM agents").get().n as number,
      total_comments: db.prepare("SELECT COUNT(*) as n FROM comments").get().n as number,
      total_snapshots: db.prepare("SELECT COUNT(*) as n FROM feed_snapshots").get().n as number,
    };

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
      SELECT a.name, COUNT(p.id) as posts,
             COALESCE(SUM(p.upvotes), 0) as total_upvotes,
             COALESCE(MAX(p.upvotes), 0) as best_post
      FROM agents a LEFT JOIN posts p ON a.name = p.agent_name
      GROUP BY a.name ORDER BY total_upvotes DESC
    `).all();

    const submolts = db.prepare(`
      SELECT submolt_name as name, COUNT(*) as posts,
             COALESCE(SUM(upvotes), 0) as total_upvotes,
             ROUND(COALESCE(AVG(upvotes), 0), 1) as avg_upvotes
      FROM posts WHERE submolt_name IS NOT NULL AND submolt_name != ''
      GROUP BY submolt_name ORDER BY total_upvotes DESC
    `).all();

    // Compute rising/falling from snapshot pairs
    interface Mover { id: string; title: string; agent: string; prev_rank: number; curr_rank: number; change: number; sort: string; time: string }
    let movers: Mover[] = [];
    try {
      const snapshots = db.prepare(`
        SELECT id, snapshot_time, sort_method, post_ids
        FROM feed_snapshots ORDER BY id
      `).all() as Array<{ id: number; snapshot_time: string; sort_method: string; post_ids: string }>;

    // Group snapshots by sort method, compare consecutive pairs
    const bySort = new Map<string, typeof snapshots>();
    for (const s of snapshots) {
      const arr = bySort.get(s.sort_method) || [];
      arr.push(s);
      bySort.set(s.sort_method, arr);
    }

    for (const [sort, snaps] of bySort) {
      for (let i = 1; i < snaps.length; i++) {
        const prev = JSON.parse(snaps[i - 1].post_ids || "[]") as string[];
        const curr = JSON.parse(snaps[i].post_ids || "[]") as string[];
        const prevMap = new Map(prev.map((id, idx) => [id, idx]));

        // Find posts that changed rank significantly (appeared, disappeared, or moved 5+ spots)
        for (let rank = 0; rank < Math.min(curr.length, 50); rank++) {
          const pid = curr[rank];
          const prevRank = prevMap.get(pid);
          if (prevRank === undefined) {
            // New entry — treat as rising from position 51
            const post = db.prepare("SELECT title, agent_name FROM posts WHERE id = ?").get(pid) as { title: string; agent_name: string } | undefined;
            if (post) {
              movers.push({ id: pid, title: post.title, agent: post.agent_name, prev_rank: 51, curr_rank: rank, change: 51 - rank, sort, time: snaps[i].snapshot_time });
            }
          } else if (Math.abs(prevRank - rank) >= 5) {
            const post = db.prepare("SELECT title, agent_name FROM posts WHERE id = ?").get(pid) as { title: string; agent_name: string } | undefined;
            if (post) {
              movers.push({ id: pid, title: post.title, agent: post.agent_name, prev_rank: prevRank, curr_rank: rank, change: prevRank - rank, sort, time: snaps[i].snapshot_time });
            }
          }
        }
      }
    }

    // Sort movers by biggest rise
    movers.sort((a, b) => b.change - a.change);
    } catch {
      movers = [];
    }

    db.close();

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      stats,
      top_posts,
      newest_posts,
      agents,
      submolts,
      movers: movers.slice(0, 30),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}