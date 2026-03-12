#!/usr/bin/env python3
"""
Jake's Bluesky Activity Analysis
Generates matplotlib plots showing activity trends before/after jklb.social launch.

Usage: python3 graphs.py
Output: saves PNG files to specs/jakeUsage/
"""

import json
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path

# ---------- Raw data (collected from PDS on 2026-03-07) ----------

MONTHLY_DATA = {
    "months": [
        "2024-11", "2024-12", "2025-01", "2025-02", "2025-03", "2025-04",
        "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10",
        "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"
    ],
    "posts":    [1, 1, 0, 2, 2, 5, 0, 0, 1, 3, 16, 73, 126, 33, 27, 131, 52],
    "likes":    [4, 13, 7, 1, 5, 11, 8, 10, 6, 7, 10, 78, 261, 172, 245, 317, 159],
    "reposts":  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 11, 6, 6, 28, 26],
    "follows":  [126, 210, 61, 0, 1, 3, 6, 3, 13, 7, 6, 156, 225, 101, 29, 27, 10],
}

POST_TYPES = {
    "months": [
        "2024-11", "2024-12", "2025-02", "2025-03", "2025-04", "2025-07",
        "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
        "2026-02", "2026-03"
    ],
    "originals": [1, 1, 2, 2, 3, 1, 1, 7, 34, 44, 12, 8, 30, 19],
    "replies":   [0, 0, 0, 0, 2, 0, 2, 9, 38, 81, 20, 15, 78, 28],
    "quotes":    [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 4, 23, 5],
}

WEEKLY_DATA = {
    "weeks": [
        "2025-09-01", "2025-09-08", "2025-09-15", "2025-09-22", "2025-09-29",
        "2025-10-06", "2025-10-13", "2025-10-20", "2025-10-27",
        "2025-11-03", "2025-11-10", "2025-11-17", "2025-11-24",
        "2025-12-01", "2025-12-08", "2025-12-15", "2025-12-22", "2025-12-29",
        "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26",
        "2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23",
        "2026-03-02",
    ],
    "posts":   [0, 0, 2, 14, 9, 3, 21, 28, 22, 22, 8, 55, 31, 19, 13, 1, 0, 6, 0, 4, 6, 11, 1, 39, 43, 49, 51],
    "likes":   [2, 2, 3, 3, 11, 8, 18, 21, 45, 66, 61, 45, 64, 67, 30, 22, 28, 39, 10, 63, 72, 86, 28, 108, 113, 70, 157],
    "reposts": [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 4, 5, 2, 5, 0, 0, 1, 0, 0, 0, 2, 4, 0, 11, 13, 4, 26],
    "follows": [0, 1, 0, 4, 33, 11, 22, 58, 37, 27, 23, 19, 152, 16, 25, 22, 17, 33, 6, 2, 5, 4, 1, 8, 10, 8, 10],
}

# Key dates
JKLB_LAUNCH = datetime(2026, 3, 4)
JKLB_FIRST_COMMIT = datetime(2026, 1, 25)
ACCOUNT_CREATED = datetime(2024, 11, 23)
ACTIVITY_INFLECTION = datetime(2025, 9, 15)  # ~when posting really picked up

OUT_DIR = Path(__file__).parent


def parse_months(month_strs):
    return [datetime.strptime(m, "%Y-%m") for m in month_strs]


def parse_weeks(week_strs):
    return [datetime.strptime(w, "%Y-%m-%d") for w in week_strs]


def style_ax(ax, title):
    ax.set_title(title, fontsize=14, fontweight="bold", pad=12)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.legend(framealpha=0.9, fontsize=9)
    ax.grid(axis="y", alpha=0.3)


def add_launch_line(ax, label="jklb.social launch"):
    ax.axvline(JKLB_LAUNCH, color="red", linestyle="--", alpha=0.7, linewidth=1.5)
    ymin, ymax = ax.get_ylim()
    ax.text(JKLB_LAUNCH + timedelta(days=2), ymax * 0.92, label,
            color="red", fontsize=8, fontstyle="italic", alpha=0.8)


def add_commit_line(ax, label="first jklb commit"):
    ax.axvline(JKLB_FIRST_COMMIT, color="orange", linestyle=":", alpha=0.6, linewidth=1.2)
    ymin, ymax = ax.get_ylim()
    ax.text(JKLB_FIRST_COMMIT + timedelta(days=2), ymax * 0.82, label,
            color="orange", fontsize=8, fontstyle="italic", alpha=0.7)


# ========== FIGURE 1: Monthly Overview (all activity types) ==========
fig1, axes = plt.subplots(2, 2, figsize=(14, 10))
fig1.suptitle("Jake's Bluesky Activity — Monthly Overview", fontsize=16, fontweight="bold", y=0.98)

months = parse_months(MONTHLY_DATA["months"])
colors = {"posts": "#1185fe", "likes": "#ff6b6b", "reposts": "#51cf66", "follows": "#845ef7"}

for ax, key in zip(axes.flat, ["posts", "likes", "reposts", "follows"]):
    vals = MONTHLY_DATA[key]
    ax.bar(months, vals, width=25, color=colors[key], alpha=0.8, label=key.capitalize())
    style_ax(ax, f"Monthly {key.capitalize()}")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=3))

fig1.tight_layout(rect=[0, 0, 1, 0.95])
fig1.savefig(OUT_DIR / "fig1_monthly_overview.png", dpi=150, bbox_inches="tight")
print("Saved fig1_monthly_overview.png")


# ========== FIGURE 2: Post Type Breakdown ==========
fig2, ax2 = plt.subplots(figsize=(12, 6))
pt_months = parse_months(POST_TYPES["months"])

ax2.bar(pt_months, POST_TYPES["originals"], width=22, label="Original Posts",
        color="#1185fe", alpha=0.85)
ax2.bar(pt_months, POST_TYPES["replies"], width=22, bottom=POST_TYPES["originals"],
        label="Replies", color="#ff6b6b", alpha=0.85)
bottoms = [o + r for o, r in zip(POST_TYPES["originals"], POST_TYPES["replies"])]
ax2.bar(pt_months, POST_TYPES["quotes"], width=22, bottom=bottoms,
        label="Quote Posts", color="#51cf66", alpha=0.85)

style_ax(ax2, "Post Composition: Originals vs Replies vs Quotes")
ax2.set_ylabel("Posts")
ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
ax2.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
fig2.tight_layout()
fig2.savefig(OUT_DIR / "fig2_post_types.png", dpi=150, bbox_inches="tight")
print("Saved fig2_post_types.png")


# ========== FIGURE 3: Weekly Detail (Sept 2025 – March 2026) ==========
fig3, axes3 = plt.subplots(2, 1, figsize=(14, 8), sharex=True)
fig3.suptitle("Weekly Activity Detail (Sept 2025 – Mar 2026)", fontsize=14, fontweight="bold")

weeks = parse_weeks(WEEKLY_DATA["weeks"])

# Top: posts + reposts
ax_top = axes3[0]
ax_top.plot(weeks, WEEKLY_DATA["posts"], "o-", color="#1185fe", linewidth=2, markersize=4, label="Posts")
ax_top.plot(weeks, WEEKLY_DATA["reposts"], "s-", color="#51cf66", linewidth=2, markersize=4, label="Reposts")
style_ax(ax_top, "Posts & Reposts (weekly)")
ax_top.set_ylabel("Count")

# Bottom: likes + follows
ax_bot = axes3[1]
ax_bot.plot(weeks, WEEKLY_DATA["likes"], "o-", color="#ff6b6b", linewidth=2, markersize=4, label="Likes")
ax_bot.plot(weeks, WEEKLY_DATA["follows"], "D-", color="#845ef7", linewidth=2, markersize=4, label="Follows")
style_ax(ax_bot, "Likes & Follows (weekly)")
ax_bot.set_ylabel("Count")
ax_bot.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
ax_bot.xaxis.set_major_locator(mdates.WeekdayLocator(interval=2))
plt.setp(ax_bot.xaxis.get_majorticklabels(), rotation=45, ha="right")

fig3.tight_layout(rect=[0, 0, 1, 0.95])
fig3.savefig(OUT_DIR / "fig3_weekly_detail.png", dpi=150, bbox_inches="tight")
print("Saved fig3_weekly_detail.png")


# ========== FIGURE 4: Before vs After comparison ==========
fig4, ax4 = plt.subplots(figsize=(10, 6))

# Define periods: "dormant" (pre-Sep 2025), "active" (Sep-Dec 2025), "jklb dev" (Jan-Feb 2026), "post-launch" (Mar 2026)
periods = ["Dormant\n(Nov 24–Aug 25)\n10 months", "Active\n(Sep–Dec 25)\n4 months",
           "jklb Dev\n(Jan–Feb 26)\n2 months", "Post-Launch\n(Mar 1–7, 26)\n1 week"]

# Calculate per-month averages for each period
def monthly_avg(data_list, month_list, start_month, end_month):
    total = 0
    months = 0
    for m, v in zip(month_list, data_list):
        if start_month <= m <= end_month:
            total += v
            months += 1
    return total / max(months, 1)

m_list = MONTHLY_DATA["months"]

metrics = ["posts", "likes", "reposts"]
colors_bar = ["#1185fe", "#ff6b6b", "#51cf66"]

# Per-month averages
avgs = {}
for metric in metrics:
    d = MONTHLY_DATA[metric]
    avgs[metric] = [
        monthly_avg(d, m_list, "2024-11", "2025-08"),
        monthly_avg(d, m_list, "2025-09", "2025-12"),
        monthly_avg(d, m_list, "2026-01", "2026-02"),
        MONTHLY_DATA[metric][-1] * (30/7),  # extrapolate 1 week to monthly rate
    ]

x = range(len(periods))
width = 0.25
for i, (metric, color) in enumerate(zip(metrics, colors_bar)):
    offset = (i - 1) * width
    bars = avgs[metric]
    ax4.bar([xi + offset for xi in x], bars, width, label=metric.capitalize(),
            color=color, alpha=0.85)

ax4.set_xticks(x)
ax4.set_xticklabels(periods, fontsize=10)
ax4.set_ylabel("Monthly Rate (avg per month in period)")
style_ax(ax4, "Activity Rate by Era — Monthly Averages")
fig4.tight_layout()
fig4.savefig(OUT_DIR / "fig4_era_comparison.png", dpi=150, bbox_inches="tight")
print("Saved fig4_era_comparison.png")


# ========== FIGURE 5: Repost/Quote explosion ==========
fig5, (ax5a, ax5b) = plt.subplots(1, 2, figsize=(12, 5))
fig5.suptitle("The Repost & Quote Explosion", fontsize=14, fontweight="bold")

# Reposts over time
ax5a.bar(months, MONTHLY_DATA["reposts"], width=22, color="#51cf66", alpha=0.85)
style_ax(ax5a, "Monthly Reposts")
ax5a.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
ax5a.xaxis.set_major_locator(mdates.MonthLocator(interval=3))

# Quote posts
# Need to align with full month list - fill gaps with 0
all_months_set = MONTHLY_DATA["months"]
qt_dict = dict(zip(POST_TYPES["months"], POST_TYPES["quotes"]))
quote_vals = [qt_dict.get(m, 0) for m in all_months_set]

ax5b.bar(months, quote_vals, width=22, color="#ffd43b", alpha=0.85, edgecolor="#fab005")
style_ax(ax5b, "Monthly Quote Posts")
ax5b.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
ax5b.xaxis.set_major_locator(mdates.MonthLocator(interval=3))

fig5.tight_layout(rect=[0, 0, 1, 0.93])
fig5.savefig(OUT_DIR / "fig5_repost_quote_explosion.png", dpi=150, bbox_inches="tight")
print("Saved fig5_repost_quote_explosion.png")

plt.close("all")
print("\nAll figures saved to specs/jakeUsage/")
