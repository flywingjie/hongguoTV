#!/usr/bin/env python3
"""Check recorded uiautomator XML; this does not drive a device or replace live QA."""
import re
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(sys.argv[1] if len(sys.argv) > 1 else "outputs/comic-ranking")
checks = 0


def nodes(name):
    return list(ET.parse(root / (name + ".xml")).iter("node"))


def verify(condition, label):
    global checks
    assert condition, label
    checks += 1


def has_text(name, text):
    return any(n.get("text") == text for n in nodes(name))


def focused_rank(name, rank):
    return any(n.get("focused") == "true" and n.get("content-desc", "").startswith(f"第 {rank} 名，") for n in nodes(name))


verify(has_text("release-ranking", "漫剧热播榜"), "ranking entry opens comic ranking")
verify(focused_rank("release-ranking", 1), "first ranked card receives focus")
verify(any("热度" in n.get("text", "") for n in nodes("release-ranking")), "source heat shown")
verify(any("已更新" in n.get("text", "") for n in nodes("release-ranking")), "source update shown")
for page in range(2, 6):
    verify(focused_rank(f"release-page-{page}", (page - 1) * 20 + 1), f"page {page} preserves global ranks")
verify(has_text("release-detail", "剧集详情"), "ranking opens detail")
verify(focused_rank("release-return", 23), "detail back restores page and original card")
verify(any(n.get("text") == "刷新榜单" and n.get("focused") == "true" for n in nodes("release-refresh-focus")), "refresh reachable with remote")
verify(focused_rank("release-refreshed", 1), "refresh returns to page one")
verify(has_text("release-race-return", "正在加载…"), "return during slow refresh reloads")
verify(not any(n.get("content-desc", "").startswith("第 ") for n in nodes("release-race-return")), "pending page has no stale rank cards")
verify(focused_rank("release-race-result", 1), "refresh race recovers with correct page")
verify(has_text("release-last-bottom", "第 5 / 5 页"), "last page total includes current page")
verify(has_text("release-last-bottom", "第 100 名"), "last rank visible")
verify(any(n.get("text") == "下一页" and n.get("enabled") == "false" for n in nodes("release-last-bottom")), "last page cannot advance")
verify(focused_rank("release-large-font", 1), "large font ranking remains usable")
for label in ["设置", "刷新榜单"]:
    node = next(n for n in nodes("release-large-font") if n.get("text") == label)
    left, top, right, bottom = map(int, re.findall(r"\d+", node.get("bounds")))
    verify(0 <= left < right <= 1920 and 0 <= top < bottom <= 1080, f"large font {label} inside viewport")
verify(has_text("release-refresh-switched", "我的收藏"), "favorites tab preserved")
verify(has_text("release-history", "接着上次看"), "history tab preserved")
verify(any(n.get("text", "").startswith("清晰度上限：") for n in nodes("release-settings")), "settings tab preserved")
verify(has_text("release-search", "输入短剧名称或关键词"), "search tab and content preference preserved")
print(f"{checks} ranking UI evidence checks passed")
