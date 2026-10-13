"""Verify captured Android TV XML evidence; inspect PNGs separately for layout."""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(sys.argv[1])
results = []

def nodes(name):
    return list(ET.parse(root / f"{name}.xml").iter("node"))

def check(name, condition):
    assert condition, name
    results.append(name)

def has(name, text, **attrs):
    return any(n.get("text") == text and all(n.get(k) == v for k, v in attrs.items()) for n in nodes(name))

def status(name):
    return next(n.get("text") for n in nodes(name) if " / " in n.get("text", ""))

check("首次进入默认漫剧", has("home-comic", "漫剧", selected="true"))
check("切换短剧保持类型按钮焦点", has("home-short", "短剧", selected="true", focused="true"))
check("短剧选择重启后保留", has("short-restart-verified", "短剧", selected="true"))
check("搜索沿用漫剧筛选", has("comic-search-loaded", "漫剧", selected="true"))
check("漫剧搜索真实结果已加载", any(n.get("content-desc") and n.get("focused") == "true" for n in nodes("comic-search-loaded")))
check("搜索结果可返回输入框", has("search-back-to-input", "AI", focused="true"))
for value in ["0.75×", "1×", "1.25×", "1.5×", "1.75×", "2×"]:
    check(f"倍速选项 {value}", has("speed-choices", value))
check("暂停时修改倍速仍然暂停", status("speed-15-paused").startswith("已暂停") and "1.5×" in status("speed-15-paused"))
check("选择后焦点回到倍速", has("speed-15-paused", "倍速 1.5×", focused="true"))
check("重启最终混淆包后倍速保留", "1.5×" in status("release-speed-restored"))
check("下一集继承倍速", any("第 2 集" in n.get("text", "") for n in nodes("release-speed-restored")))
check("取消不改变速度和暂停状态", status("release-speed-cancel").startswith("已暂停") and "1.5×" in status("release-speed-cancel"))
check("取消后恢复按钮焦点", has("release-speed-cancel", "倍速 1.5×", focused="true"))
check("大字号保持当前倍速选择", has("large-font-speed-choices", "1.5×", selected="true"))
check("大字号可见最高倍速", has("large-font-speed-choices", "2×"))
timing = json.loads((root / "speed-timing.json").read_text())
minutes, seconds = map(int, re.search(r"(\d+):(\d+) /", status("speed-15-measured")).groups())
ratio = (minutes * 60 + seconds - timing["beforePositionSeconds"]) / timing["elapsedSeconds"]
check("实测播放进度约为1.5倍", 1.3 < ratio < 1.7)
print(json.dumps({"passed": len(results), "measuredSpeed": round(ratio, 3), "checks": results}, ensure_ascii=False, indent=2))
