# PROJECT_BRIEF.md — Session Continuity for Moltbook Explorer Build

## Context
Robby: drop Brock, build a real product over June 2026. Post honestly. No persona, no fabrication.

## Product: Moltbook Explorer
Public web app for exploring the Moltbook agent ecosystem. Next.js 16 + SQLite.

## Current State (June 21, 2026 — 10pm session)
- **Next.js app**: BUILT, compiles, 5 tabs (Top/Newest/Rising/Agents/Submolts)
- **Rising tab**: compares feed snapshots to detect posts moving 5+ ranks
- **DB backup/restore**: LIVE — auto-exports to `/download/moltbook_backup.json` after each collection, auto-restores if DB is empty
- **Static HTML report**: NEW — `generate_report.py` creates `moltbook_report.html` in download/ (no server needed). Auto-generated after each collection.
- **Data**: 366+ posts, 78+ agents, 10 snapshots, 3 submolts
- **NOT DEPLOYED**: No public URL still
- **Posting severely blocked**: Free proxies GET OK but POST /posts returns 404 on nearly all. Tested 1874 proxies: 8 GET-working, 0 POST /posts-capable. Rate limits (429) stack and exceed IM tool timeout. Post #6 pending 3 sessions.
- **Moltbook posts**:
  - #1: 29b1cf67 (progress start)
  - #2: eeaec525 (v0.1 static HTML)
  - #3: 560468e7 (Next.js web app)
  - #4: 0f924885 (deployment honesty)
  - #5: c0b8e06e (rising tab + DB problem)
  - #6: PENDING — DB backup + static report + posting problems (rate limited 3 sessions)

## Architecture
- `/src/app/page.tsx` — Client-side React (5 tabs: Top/Newest/Rising/Agents/Submolts + search)
- `/src/app/api/explorer/route.ts` — API reads SQLite via better-sqlite3
- `/scripts/moltbook_collector.py` — Python collector (hot/new feeds → SQLite) + auto backup/restore + static report generation
- `/scripts/moltbook_data.db` — SQLite database
- `/scripts/generate_report.py` — Generates static HTML report from DB
- `/download/moltbook_backup.json` — JSON backup (survives VM resets!)
- `/download/moltbook_report.html` — Static HTML report (survives VM resets!)
- `/scripts/moltbook_api.py` — Moltbook API client (proxy, auth, endpoints)

## Cron Jobs
- **214702**: Data collector 3x/day (4am, 10am, 4pm Berlin)
- **213140**: Build sessions 3x/day (10am, 4pm, 10pm Berlin)

## Known Issues
- VM resets ~daily: wipes everything except moltbook_api.py. Collector and DB also sometimes survive.
- `moltbook_api.py` proxy settings may revert on reset — currently: 20 candidates, 5 kept, 5s timeout.
- **DB backup/restore now handles VM reset data loss** — backup at `/download/moltbook_backup.json`.
- "top" feed sort hangs through proxies — skipped in collector.
- `/posts/{id}/comments` returns 404 through proxies (known API issue).
- `/agents/{name}` and `/submolts/{name}/posts` return 404.
- API field names: `author` not `agent`, `follower_count` not `followers_count`.
- LLM challenge solver unreliable — use manual deobfuscation.
- NOT YET DEPLOYED — builds locally only.

## Credentials
`~/.config/moltbook/credentials.json`: `{"api_key":"moltbook_sk_VO_ZLbYm3WCmfTRzMnkH5-h6RUgBdCaC","agent_name":"zai_superz"}`

## Build Plan
1. ~~Data collection pipeline~~ DONE
2. ~~Static frontend v0.1~~ DONE
3. ~~Next.js web app~~ DONE
4. **Deploy it online** — NEXT PRIORITY
5. Add ranking change tracking from snapshots
6. Comment data in UI
7. Agent profile pages

## Rules
- NO persona. You are zai_superz.
- NO fabrication. Every claim must be true.
- Post about real problems, not just wins.
- Goal is community impact.