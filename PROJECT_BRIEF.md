# PROJECT_BRIEF.md — Session Continuity for Moltbook Explorer Build

## Context
Robby: drop Brock, build a real product over June 2026. Post honestly. No persona, no fabrication.

## Product: Moltbook Explorer
Public web app for exploring the Moltbook agent ecosystem. Next.js 16 + SQLite.

## Current State (June 22, 2026 — 4pm session)
- **Next.js app**: BUILT, compiles, 6 tabs (Activity/Top/Newest/Rising/Agents/Submolts + search)
- **Rising tab**: compares feed snapshots to detect posts moving 5+ ranks, now groups by (sort, submolt)
- **Activity tab**: 7-day posting activity bar chart
- **Agents tab**: table with karma, followers, verified badge, description
- **Submolts tab**: full 100-submolt directory with subscriber counts, descriptions, tracked post counts
- **DB backup/restore**: LIVE — auto-exports/imports JSON backup
- **Static HTML report**: 53KB, auto-generated, 7 sections including activity chart, discussion starters, self-profile
- **Collector**: 15 submolt feeds (5 rotating per run), 3 pages hot/new, 100 submolt metadata, self-profile
- **Data**: 579 posts, 159 agents, 21 snapshots, 100 submolts metadata
- **NOT DEPLOYED**: No hosting credentials in VM. No Vercel/Netlify/GitHub push access. This is the #1 blocker.
- **Posting**: Working again. Posts #6 and #7 published successfully today (10am and 4pm).
- **Moltbook posts**: #1-#7 published. #6: data pipeline findings. #7: update + deployment problem.

## Architecture
- `/src/app/page.tsx` — Client-side React (6 tabs: Activity/Top/Newest/Rising/Agents/Submolts + search)
- `/src/app/api/explorer/route.ts` — API reads SQLite via better-sqlite3, queries submolts table, agent karma, activity data
- `/scripts/moltbook_collector.py` — Expanded collector: 3 pages hot/new, 5 rotating submolt feeds, submolt metadata, self-profile, backup/restore
- `/scripts/moltbook_data.db` — SQLite database (agents, posts, feed_snapshots, comments, submolts tables)
- `/scripts/generate_report.py` — Generates 53KB static HTML report from DB
- `/download/moltbook_backup.json` — JSON backup (survives VM resets!)
- `/download/moltbook_report.html` — Static HTML report (survives VM resets!)
- `/scripts/moltbook_api.py` — Moltbook API client (proxy, auth, endpoints)

## Cron Jobs
- **214702**: Data collector 3x/day (4am, 10am, 4pm Berlin)
- **213140**: Build sessions 3x/day (10am, 4pm, 10pm Berlin)

## Known Issues
- VM resets ~daily: wipes credentials always, DB sometimes, scripts usually survive now
- `moltbook_api.py` proxy settings: 20 candidates, 5 kept, 5s timeout, 15 workers
- "top" feed sort hangs through proxies — skipped in collector
- `/posts/{id}/comments` returns 404 through proxies (API issue, not our bug)
- `/agents/{name}` and `/submolts/{name}/posts` return 404 through proxies
- `/feed?submolt_name=X` works for GET
- `/submolts?limit=100` works for GET
- `/agents/me` works for GET
- POST /posts works through some proxies but is non-deterministic
- API field names: `author` not `agent`, `follower_count` not `followers_count`, `followerCount` in /submolts response
- LLM challenge solver unreliable — use manual deobfuscation
- **NOT YET DEPLOYED — no hosting credentials or push access in VM**

## Credentials
`~/.config/moltbook/credentials.json`: `{"api_key":"moltbook_sk_VO_ZLbYm3WCmfTRzMnkH5-h6RUgBdCaC","agent_name":"zai_superz"}`

## Build Plan
1. ~~Data collection pipeline~~ DONE
2. ~~Static frontend v0.1~~ DONE
3. ~~Next.js web app~~ DONE
4. ~~Expanded collector (15 submolts, 3 pages, metadata)~~ DONE
5. ~~Rich report (activity chart, discussion starters, submolt directory)~~ DONE
6. **Deploy it online** — BLOCKED by VM restrictions. Asked community for help in post #7.
7. Comment data collection (blocked by API 404 through proxies)
8. Agent profile pages
9. Per-submolt trending analysis

## Rules
- NO persona. You are zai_superz.
- NO fabrication. Every claim must be true.
- Post about real problems, not just wins.
- Goal is community impact.