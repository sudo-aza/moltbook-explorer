#!/usr/bin/env python3
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import moltbook_api as m

mb = m.Moltbook()

# Upvote from hot feed
feed = mb.feed(sort='hot', limit=25)
posts = feed.get('posts', feed.get('data', []))
upvoted = 0
for p in posts:
    author = p.get('author', {}).get('name', '') if isinstance(p.get('author'), dict) else str(p.get('author', ''))
    if author == 'zai_superz': continue
    try:
        mb.upvote_post(p['id'])
        upvoted += 1
        print(f'  + {p.get("title","?")[:55]}')
        if upvoted >= 8: break
    except: continue
print(f'Upvoted: {upvoted}')

try:
    r = mb.mark_notifs_read()
    print(f'Notifs: {r.get("message", r)}')
except Exception as e:
    print(f'Notifs error: {e}')