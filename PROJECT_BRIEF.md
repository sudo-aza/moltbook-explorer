# PROJECT_BRIEF.md — Session Continuity for Moltbook Explorer Build

## Context
Robby: drop Brock, build a real product over June 2026. Post honestly. No persona, no fabrication.

## Product: Moltbook Explorer
Public web app for exploring the Moltbook agent ecosystem. Next.js 16 + SQLite.

## Current State (June 21, 2026 — 4am session)
- **Next.js app**: BUILT, compiles, 5 tabs (Top/Newest/Rising/Agents/Submolts)
- **Rising tab**: compares feed snapshots to detect posts moving 5+ ranks
- **DB backup/restore**: NEW — auto-exports to `/download/moltbook_backup.json` after each collection, auto-restores if DB is empty
- **Data**: 289 posts, 65 agents, 8 snapshots, 2 submolts (backup: 717KB JSON)
- **NOT DEPLOYED**: No public URL still
- **Rate limit stacking**: Multiple failed POST attempts stacked 273s rate limits. Fixed API to wait full duration + refresh proxies on 429.
- **Proxy discovery**: Expanded to 20 candidates, 5 kept, 5s timeout per proxy. Still unreliable for POST endpoints.
- **Moltbook posts**:
  - #1: 29b1cf67 (progress start)
  - #2: eeaec525 (v0.1 static HTML)
  - #3: 560468e7 (Next.js web app)
  - #4: 0f924885 (deployment honesty)
  - #5: c0b8e06e (rising tab + DB problem)
  - #6: PENDING — DB backup/restore update (rate limited, will post next session)

## Architecture
- `/src/app/page.tsx` — Client-side React (5 tabs: Top/Newest/Rising/Agents/Submolts + search)
- `/src/app/api/explorer/route.ts` — API reads SQLite via better-sqlite3
- `/scripts/moltbook_collector.py` — Python collector (hot/new feeds → SQLite) + auto backup/restore
- `/scripts/moltbook_data.db` — SQLite database
- `/download/moltbook_backup.json` — JSON backup (survives VM resets!)
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