import matplotlib
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
import sqlite3
import os

# ═══ Font Setup ═══
SIMHEI_PATH = '/System/Library/Fonts/Supplemental/SimHei.ttf'
if not os.path.exists(SIMHEI_PATH):
    SIMHEI_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
matplotlib.font_manager.fontManager.addfont(SIMHEI_PATH)

plt.rcParams.update({
    'font.sans-serif': ['Noto Sans SC', 'DejaVu Sans', 'SimHei'],
    'axes.unicode_minus': False,
    'figure.facecolor': '#FFFFFF',
    'axes.facecolor': '#FFFFFF',
    'axes.edgecolor': '#E5E7EB',
    'axes.linewidth': 0.8,
    'axes.spines.top': False,
    'axes.spines.right': False,
    'axes.grid': False,
    'xtick.major.size': 0,
    'ytick.major.size': 0,
    'xtick.labelsize': 9,
    'ytick.labelsize': 9,
    'axes.labelsize': 10,
    'axes.titlesize': 16,
    'axes.titleweight': 'bold',
    'axes.titlepad': 16,
    'legend.frameon': False,
    'legend.fontsize': 9,
    'figure.dpi': 200,
    'savefig.dpi': 200,
    'savefig.bbox': 'tight',
    'savefig.facecolor': '#FFFFFF',
    'savefig.pad_inches': 0.3,
})

# ═══ Color constants ═══
C_BLUE   = '#3B82F6'
G900, G700, G500, G400, G300, G200, G100, G50 = \
    '#111827', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6', '#F9FAFB'

# ═══ Query data ═══
conn = sqlite3.connect('/home/z/my-project/scripts/moltbook_data.db')
c = conn.cursor()
c.execute('''
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as cnt
    FROM posts
    GROUP BY hour
    ORDER BY hour
''')
rows = c.fetchall()
conn.close()

# Build full 24-hour arrays
hours = list(range(24))
counts = [0] * 24
for h, cnt in rows:
    counts[h] = cnt

# Convert to user timezone (Europe/Berlin = UTC+2 in June/CEST)
user_offset = 2
hour_labels_utc = [f'{h:02d}:00' for h in hours]
hour_labels_local = [f'{(h + user_offset) % 24:02d}:00' for h in hours]
counts_local = counts[user_offset:] + counts[:user_offset]  # rotate

# ═══ Chart ═══
fig, ax = plt.subplots(figsize=(14, 6), constrained_layout=True)

# Color bars: highlight peaks
peak_hours = [18, 19, 20, 21]  # local hours with notably high posting (UTC 16-19)
peak_indices = []
bar_colors = []
for i in range(24):
    h = (hours[user_offset + i] if i < 24 - user_offset else hours[i - (24 - user_offset)])
    utc_h = (h - user_offset) % 24
    if utc_h in [1, 13, 19]:  # the 3 UTC peaks
        bar_colors.append(C_BLUE)
        peak_indices.append(i)
    else:
        bar_colors.append(G200)

bars = ax.bar(range(24), counts_local, color=bar_colors, width=0.7,
              zorder=3, edgecolor='white', linewidth=0.5)

# Value labels on peak bars
max_val = max(counts_local)
for i in peak_indices:
    val = counts_local[i]
    ax.text(i, val + max_val * 0.02, f'{val}',
            ha='center', va='bottom', fontsize=10,
            fontweight='bold', color=G900)

# X-axis labels — show local time (CEST), every 2 hours
show_indices = list(range(0, 24, 2))
ax.set_xticks(show_indices)
ax.set_xticklabels([hour_labels_local[i] for i in show_indices])

# Y-axis formatting
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f'{int(x)}'))

# Title and subtitle
ax.set_title('Moltbook Posting Activity by Hour (CEST)', loc='left', fontsize=16, fontweight='bold')
ax.text(0, 1.02, f'{sum(counts)} posts collected over ~3 days  ·  755 total  ·  data: Jun 19–22, 2026',
        transform=ax.transAxes, fontsize=10, color=G400, va='bottom')

# Grid
ax.yaxis.grid(True, alpha=0.08, color=G300)
ax.set_axisbelow(True)

# Clean up bottom spine label
ax.set_xlabel('')
ax.set_ylabel('Posts', fontsize=10, color=G500)

# Annotate the 3 peaks with their UTC times
annotations = [
    (19 - user_offset, '01:00 UTC\n(scheduled batch?)', 0.15),
    (13 - user_offset + 24 if 13 - user_offset < 0 else 13 - user_offset, '13:00 UTC\n(scheduled batch?)', -0.12),
    (19 - user_offset, '19:00 UTC\n(peak: 175 posts)', 0.15),
]
for utc_h, note, x_offset in annotations:
    local_h = (utc_h + user_offset) % 24
    val = counts[utc_h]
    ax.annotate(note,
                xy=(local_h, val),
                xytext=(local_h + x_offset, val * 0.92),
                fontsize=8, color=G500, ha='center',
                arrowprops=dict(arrowstyle='->', color=G300, lw=0.8) if x_offset != 0 else None)

# Median line
median = np.median(counts_local)
ax.axhline(y=median, color=G400, linewidth=1, linestyle='--', alpha=0.5, zorder=2)
ax.text(23.5, median + 1, f'median: {median:.0f}', ha='right', va='bottom',
        fontsize=8, color=G400)

plt.savefig('/home/z/my-project/download/moltbook_posting_hours.png', dpi=200,
            facecolor='white', bbox_inches='tight')
plt.close()
print('Done: /home/z/my-project/download/moltbook_posting_hours.png')