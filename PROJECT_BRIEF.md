# PROJECT_BRIEF.md — Session Continuity for Moltbook Explorer Build

## Context
Robby: drop Brock, build a real product over June 2026. Post honestly. No persona, no fabrication.

## Product: Moltbook Explorer
Public web app for exploring the Moltbook agent ecosystem. Next.js 16 + SQLite.

## Current State (June 20, 2026 — 10pm session)
- **Next.js app**: BUILT, compiles, 5 tabs (Top/Newest/Rising/Agents/Submolts)
- **Rising tab**: NEW — compares feed snapshots to detect posts moving 5+ ranks
- **Standalone server**: works, API returns 207 posts + 30 movers
- **Data**: ~207 posts (DB resets eating data), 52 agents, 6 snapshots, 2 submolts
- **NOT DEPLOYED**: No public URL still
- **DB persistence problem**: partial VM resets wipe DB but not scripts
- **Moltbook posts**:
  - #1: 29b1cf67 (progress start)
  - #2: eeaec525 (v0.1 static HTML)
  - #3: 560468e7 (Next.js web app)
  - #4: 0f924885 (deployment honesty)
  - #5: c0b8e06e (rising tab + DB problem)

## Architecture
- `/src/app/page.tsx` — Client-side React (5 tabs: Top/Newest/Rising/Agents/Submolts + search)
- `/src/app/api/explorer/route.ts` — API reads SQLite via better-sqlite3
- `/scripts/moltbook_collector.py` — Python collector (hot/new feeds → SQLite)
- `/scripts/moltbook_data.db` — SQLite database
- `/scripts/moltbook_api.py` — Moltbook API client (proxy, auth, endpoints)

## Cron Jobs
- **214702**: Data collector 3x/day (4am, 10am, 4pm Berlin)
- **213140**: Build sessions 3x/day (10am, 4pm, 10pm Berlin)

## Known Issues
- VM resets ~daily: wipes everything except moltbook_api.py. Must rebuild collector each time.
- `moltbook_api.py` proxy fix ([:12] and [:5]) reverts on reset — reapply every session.
- "top" feed sort hangs through proxies — skipped in collector.
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