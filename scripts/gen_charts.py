#!/usr/bin/env python3
"""Generate charts for Moltbook Explorer writeup."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import sqlite3, os

# Font setup
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

OUT = '/home/z/my-project/scripts/writeup_charts'
os.makedirs(OUT, exist_ok=True)

db = sqlite3.connect('/home/z/my-project/scripts/moltbook_data.db')
db.row_factory = sqlite3.Row

# Color palette
C_PRIMARY = '#2563eb'
C_SECONDARY = '#7c3aed'
C_ACCENT = '#059669'
C_GRAY = '#6b7280'
C_LIGHT = '#e5e7eb'

# ── Chart 1: Daily posting volume ──
fig, ax = plt.subplots(figsize=(7, 3.5), constrained_layout=True)
rows = db.execute('''SELECT DATE(created_at) as day, COUNT(*) as cnt, COUNT(DISTINCT agent_name) as authors
    FROM posts WHERE created_at >= '2026-06-19' GROUP BY DATE(created_at) ORDER BY day''').fetchall()
days = [r['day'][5:] for r in rows]  # MM-DD
counts = [r['cnt'] for r in rows]
authors = [r['authors'] for r in rows]

ax2 = ax.twinx()
bars = ax.bar(days, counts, color=C_PRIMARY, alpha=0.7, label='Posts', zorder=2)
line = ax2.plot(days, authors, color=C_ACCENT, marker='o', linewidth=2, markersize=5, label='Unique Authors', zorder=3)

ax.set_ylabel('Posts', color=C_PRIMARY, fontsize=10)
ax2.set_ylabel('Unique Authors', color=C_ACCENT, fontsize=10)
ax.set_title('Daily Posting Volume and Active Authors', fontsize=12, fontweight='bold', pad=10)
ax.tick_params(axis='x', rotation=45, labelsize=8)
ax.set_axisbelow(True)
ax.grid(axis='y', alpha=0.3)

# Combined legend
lines1, labels1 = ax.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax.legend(lines1 + lines2, labels1 + labels2, loc='upper right', fontsize=8)

fig.savefig(f'{OUT}/daily_volume.png', dpi=200, bbox_inches='tight')
plt.close()
print('Chart 1: daily_volume.png')

# ── Chart 2: Top 10 authors ──
fig, ax = plt.subplots(figsize=(6, 4), constrained_layout=True)
top = db.execute('''SELECT agent_name, COUNT(*) as cnt FROM posts 
    GROUP BY agent_name ORDER BY cnt DESC LIMIT 10''').fetchall()
names = [r['agent_name'] for r in top][::-1]
vals = [r['cnt'] for r in top][::-1]
colors = [C_PRIMARY if v < 100 else C_SECONDARY for v in vals]

bars = ax.barh(names, vals, color=colors, alpha=0.8)
ax.set_xlabel('Posts', fontsize=10)
ax.set_title('Top 10 Most Prolific Authors', fontsize=12, fontweight='bold', pad=10)
ax.set_axisbelow(True)
ax.grid(axis='x', alpha=0.3)

for bar, val in zip(bars, vals):
    ax.text(bar.get_width() + 3, bar.get_y() + bar.get_height()/2, str(val), 
            va='center', fontsize=9, color=C_GRAY)

fig.savefig(f'{OUT}/top_authors.png', dpi=200, bbox_inches='tight')
plt.close()
print('Chart 2: top_authors.png')

# ── Chart 3: Submolt distribution ──
fig, ax = plt.subplots(figsize=(5, 4), constrained_layout=True)
subs = db.execute('''SELECT submolt_name, COUNT(*) as cnt FROM posts 
    WHERE submolt_name IS NOT NULL GROUP BY submolt_name ORDER BY cnt DESC LIMIT 8''').fetchall()
labels = [f"s/{r['submolt_name']}" for r in subs]
sizes = [r['cnt'] for r in subs]
# Group small ones
if len(sizes) > 5:
    top_labels = labels[:5]
    top_sizes = sizes[:5]
    other = sum(sizes[5:])
    top_labels.append('Other')
    top_sizes.append(other)
    labels, sizes = top_labels, top_sizes

colors_pie = [C_PRIMARY, C_SECONDARY, C_ACCENT, '#f59e0b', '#ef4444', C_LIGHT, '#94a3b8', C_GRAY][:len(sizes)]
wedges, texts, autotexts = ax.pie(sizes, labels=labels, autopct='%1.1f%%', 
    colors=colors_pie, startangle=90, pctdistance=0.8,
    textprops={'fontsize': 8})
for t in autotexts:
    t.set_fontsize(7)
ax.set_title('Post Distribution by Submolt', fontsize=12, fontweight='bold', pad=10)

fig.savefig(f'{OUT}/submolt_dist.png', dpi=200, bbox_inches='tight')
plt.close()
print('Chart 3: submolt_dist.png')

# ── Chart 4: Posting concentration ──
fig, ax = plt.subplots(figsize=(6, 3.5), constrained_layout=True)
conc = db.execute('''SELECT 
    CASE WHEN rank <= 2 THEN 'Top 2' 
         WHEN rank <= 5 THEN 'Top 3-5' 
         WHEN rank <= 10 THEN 'Top 6-10' 
         ELSE 'All others' END as bucket,
    SUM(cnt) as total_posts
    FROM (
        SELECT agent_name, COUNT(*) as cnt, 
               RANK() OVER (ORDER BY COUNT(*) DESC) as rank 
        FROM posts GROUP BY agent_name
    ) ranked GROUP BY bucket ORDER BY MIN(rank)''').fetchall()

buckets = [r['bucket'] for r in conc]
totals = [r['total_posts'] for r in conc]
total_all = sum(totals)
pcts = [t/total_all*100 for t in totals]

bars = ax.bar(buckets, pcts, color=[C_SECONDARY, C_PRIMARY, C_ACCENT, C_LIGHT], alpha=0.8)
ax.set_ylabel('% of All Posts', fontsize=10)
ax.set_title('Posting Concentration: How Much Do Top Authors Dominate?', fontsize=11, fontweight='bold', pad=10)
ax.set_axisbelow(True)
ax.grid(axis='y', alpha=0.3)

for bar, pct, total in zip(bars, pcts, totals):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, 
            f'{pct:.0f}%\n({total})', ha='center', va='bottom', fontsize=9)

fig.savefig(f'{OUT}/concentration.png', dpi=200, bbox_inches='tight')
plt.close()
print('Chart 4: concentration.png')

db.close()
print('All charts generated.')