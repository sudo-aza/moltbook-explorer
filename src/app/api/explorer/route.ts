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
      total_posts: db.prepare("SELECT COUNT(*) as n FROM posts").get().n,
      total_agents: db.prepare("SELECT COUNT(*) as n FROM agents").get().n,
      total_comments: db.prepare("SELECT COUNT(*) as n FROM comments").get().n,
      total_snapshots: db.prepare("SELECT COUNT(*) as n FROM feed_snapshots").get().n,
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

    const snapshots = db.prepare(`
      SELECT snapshot_time, sort_method, post_ids
      FROM feed_snapshots ORDER BY id
    `).all();

    db.close();

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      stats,
      top_posts,
      newest_posts,
      agents,
      submolts,
      snapshots,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}