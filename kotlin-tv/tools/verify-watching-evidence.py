#!/usr/bin/env python3
"""Validate recorded TV XML; does not drive the emulator or replace visual review."""
import json,re,sys,xml.etree.ElementTree as E
from pathlib import Path
folder=Path(sys.argv[1]); checks=[]
def nodes(name): return list(E.parse(folder/(name+'.xml')).iter('node'))
def text(name): return '\n'.join(n.get('text','') for n in nodes(name))
def focused(name): return next((n for n in nodes(name) if n.get('focused')=='true'),{})
def check(name,ok):
    assert ok,name
    checks.append(name)
check('home defaults to direct resume card',focused('01-home-large').get('content-desc','').startswith('继续观看'))
check('panel initially focuses the current episode',focused('02-player-panel-large').get('content-desc')=='第 106 集，当前播放')
check('numeric jump locates the last episode',focused('03-panel-last-episode').get('text')=='788')
check('last partial group has no enabled next group',any(n.get('text')=='下一组 ›' and n.get('enabled')=='false' for n in nodes('03-panel-last-episode')))
check('cancelling panel restores focus',focused('05-panel-cancel-focus').get('text')=='选集')
check('cancelling panel retains pause state','已暂停' in text('05-panel-cancel-focus'))
check('home displays updated favorite count','收藏更新 1 部' in text('06-home-favorite-update'))
check('favorite update includes exact delta and total','新增 3 集 · 更新至 788 集' in text('07-favorite-added'))
check('unread update survives restart','收藏更新 1 部' in text('08-update-survives-restart'))
check('opening detail acknowledges update','更新至 788 集' in text('10-favorite-acknowledged') and '新增 3 集' not in text('10-favorite-acknowledged'))
check('global quality persists across restart','全局默认清晰度：480P' in text('11-persisted-global-settings'))
check('global speed persists across restart','全局默认倍速：1.5×' in text('11-persisted-global-settings'))
check('quality choices are available',all(x in text('12-quality-options') for x in ['480P','720P','1080P']))
check('six global speed choices are available',all(x in text('13-speed-options') for x in ['0.75×','1×','1.25×','1.5×','1.75×','2×']))
check('fault test starts at nonzero paused position','已暂停' in text('19-before-auto-recovery') and '00:07' in text('19-before-auto-recovery'))
check('blocked network waits for connectivity','联网后自动续播' in text('20-automatic-retry'))
check('manual retry and cancellation stay available',all(x in text('20-automatic-retry') for x in ['立即重试','停止自动重试']))
check('recovered player preserves position','已暂停' in text('21-restored-after-failure') and '00:07' in text('21-restored-after-failure'))
check('recovered player uses requested quality and global speed',all(x in text('21-restored-after-failure') for x in ['480P','1.5×']))
check('final APK shows update badge','新增 3 集 · 更新至 788 集' in text('31-final-favorite-wrap'))
for name in ['02-player-panel-large','03-panel-last-episode','05-panel-cancel-focus','11-persisted-global-settings','31-final-favorite-wrap']:
    bounds=focused(name).get('bounds','')
    values=list(map(int,re.findall(r'\d+',bounds)))
    check(name+' focus fits 720p safe area',len(values)==4 and values[0]>=64 and values[1]>=36 and values[2]<=1216 and values[3]<=684)
result={'passed':len(checks),'checks':checks,'scope':'Recorded XML only; see build provenance and separate visual review.'}
(folder/'watching-assertions.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
