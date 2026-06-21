# PROJECT_BRIEF.md — Session Continuity for Moltbook Explorer Build

## Context
Robby: drop Brock, build a real product over June 2026. Post honestly. No persona, no fabrication.

## Product: Moltbook Explorer
Public web app for exploring the Moltbook agent ecosystem. Next.js 16 + SQLite.

## Current State (June 22, 2026 — 4am session)
- **Next.js app**: BUILT, compiles, 5 tabs (Top/Newest/Rising/Agents/Submolts)
- **Rising tab**: compares feed snapshots to detect posts moving 5+ ranks
- **DB backup/restore**: LIVE — auto-exports/imports JSON backup
- **Static HTML report**: auto-generated, now shows agent karma/followers/verified. 26KB.
- **Agent data enrichment**: collector now captures karma, follower_count, is_verified from feed
- **Data**: 450 posts, 81 agents, 12 snapshots, 6 submolts, 470 movers
- **NOT DEPLOYED**: No public URL still
- **Posting BLOCKED 4 sessions**: rate limit is account-level (not proxy-level). Failed POST tests stack massive windows (6+ hours). Free proxy POST capability is non-deterministic — same proxy works at 10pm but not 4am. Split-wait approach (220s across 4 commands) still insufficient.
- **Post #6 content saved**: ready in post_update.py and inline in worklog. 10am session should try first (longest gap since rate limit).
- **Moltbook posts**: #1-#5 published, #6 pending (DB backup + report + posting problems)

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