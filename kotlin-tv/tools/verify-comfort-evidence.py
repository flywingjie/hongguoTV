#!/usr/bin/env python3
"""Check saved TV XML evidence; does not drive the UI or replace screenshot review."""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root=Path(sys.argv[1])
checks=[]
def nodes(name):return list(ET.parse(root/(name+'.xml')).iter('node'))
def texts(name):return '\n'.join(n.get('text','') for n in nodes(name))
def check(name,condition):
    if not condition:raise AssertionError(name)
    checks.append(name)
def contains(name,expected):check(name+': '+expected,expected in texts(name))

contains('60-release-home','第 788 集 · 00:04')
contains('61-release-timer-enabled','定时 15 分钟后')
contains('62-release-timer-cancelled','定时 关闭')
contains('62-release-timer-cancelled','已暂停')
contains('63-release-end-timer-enabled','定时 再播完 1 集')
contains('64-release-sleep-stopped','第 787 集')
contains('64-release-sleep-stopped','定时停止已生效')
contains('64-release-sleep-stopped','定时 关闭')
contains('65-release-loading-pause','第 788 集')
contains('65-release-loading-pause','已暂停')
contains('66-release-panel-pause','已暂停')
check('panel cancellation retains play button and episode focus',any(n.get('text')=='播放' for n in nodes('66-release-panel-pause')) and any(n.get('text')=='选集' and n.get('focused')=='true' for n in nodes('66-release-panel-pause')))
for name,label in [('41-final-frame-fit','画面 完整画面'),('42-final-frame-zoom','画面 等比铺满'),('43-final-frame-fill','画面 拉伸铺满')]:contains(name,label)
for name in ['32-large-font-timer-focus','33-large-font-timer-dialog']:
    focus=next(n for n in nodes(name) if n.get('focused')=='true')
    x1,y1,x2,y2=map(int,re.findall(r'\d+',focus.get('bounds')))
    check(name+': focus inside 720p viewport',0<=x1<x2<=1280 and 0<=y1<y2<=720)
contains('67-release-backup-qr','手机备份与恢复')
contains('68-release-import-preview','确认恢复本机记录')
check('restore defaults to cancel with settings unchecked',any(n.get('text')=='取消' and n.get('focused')=='true' for n in nodes('68-release-import-preview')) and any(n.get('text')=='同时恢复播放设置和内容分类' and n.get('checked')=='false' for n in nodes('68-release-import-preview')))
contains('70-release-settings','全局默认清晰度：1080P')
contains('70-release-settings','全局默认倍速：1×')
contains('70-release-settings','全局画面模式：完整画面')
check('background media session inactive','active=false' in (root/'release-media-background.txt').read_text())
check('sleep timer publishes paused media state','state=PAUSED(2)' in (root/'release-media-sleep-stopped.txt').read_text())
backup=json.loads((root/'backup-validation.json').read_text())
for key in ['cancel_unchanged','release_round_trip','release_import_merged','closed_session_unreachable']:check('backup: '+key,backup[key] is True)
print(json.dumps({'assertions':len(checks),'passed':checks},ensure_ascii=False,indent=2))
