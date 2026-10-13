#!/usr/bin/env python3
"""Check v0.3.0 recorded TV interactions. Does not drive the emulator or replace visual QA."""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
root=Path(sys.argv[1]); checks=[]
def nodes(name):return list(ET.parse(root/(name+'.xml')).iter('node'))
def texts(name):return [n.get('text','') for n in nodes(name)]
def focus(name):
    n=next(n for n in nodes(name) if n.get('focused')=='true')
    assert n.get('package')=='com.hongguotv.nativeapp'
    return n
def check(label,passed):
    assert passed,label
    checks.append(label)
def card(name):return focus(name).get('content-desc')
check('remote keypad initially focuses digit 1',focus('08-fixed-keypad').get('text')=='1')
check('jump locates episode 104 without starting playback',card('09-jump-result')=='第 104 集')
check('history menu is reachable',all(t in texts('13-manage-record') for t in ['继续观看','标记整剧已看','删除这条记录']))
check('watched badge appears','整剧已看完' in texts('14-marked-watched'))
check('delete confirmation defaults to cancel',focus('15-delete-confirm').get('text')=='取消')
check('cancel preserves original record',card('16-delete-cancelled')==card('12-history'))
check('watched detail offers restart',focus('17-watched-detail').get('text')=='重新观看')
check('delete removes selected record',card('12-history') not in texts('18-deleted-record') and card('18-deleted-record')!=card('12-history'))
check('delete retains favorite',card('19-favorite-retained')==card('12-history'))
check('phone input shows local URL',any(t.startswith('http://10.') for t in texts('20-phone-input')))
check('phone input triggers Chinese search','末日漂流' in texts('22-search-ready') and '末日漂流' in card('22-search-ready'))
check('search history includes content type','漫剧 · 末日漂流' in texts('23-search-history'))
check('search history survives restart','漫剧 · 末日漂流' in texts('25-persisted-search-history'))
check('history selection restores query','末日漂流' in texts('26-history-search'))
check('closing phone input restores its button',focus('29-phone-closed-focus').get('text')=='手机输入')
check('update dialog shows installed version',any('当前版本 0.3.0' in t for t in texts('30-updates-large')))
check('update dialog explains browser access',any('GitHub' in t for t in texts('30-updates-large')))
check('invalid episode stays in picker with error','请输入 1—152 之间的集数' in texts('33-invalid-episode'))
check('cancel restores jump button',focus('34-jump-cancel-focus').get('text')=='跳转集数')
for name in ['28-large-phone','30-updates-large','32-large-jump','33-invalid-episode']:
    b=list(map(int,re.findall(r'\d+',focus(name).get('bounds'))))
    check(name+': focused action visible at 720p / large font',0<=b[0]<b[2]<=1280 and 0<=b[1]<b[3]<=720)
check('ranking still displays source rank',card('36-ranking-regression').startswith('第 1 名'))
check('playback reaches nonzero time',any(re.search(r'已暂停.*00:51 / 02:01',t) for t in texts('39-speed-selected')))
check('speed choice applies and restores focus',focus('39-speed-selected').get('text')=='倍速 1.5×')
check('return restores ranking card',card('40-ranking-return')==card('36-ranking-regression'))
check('clear-all defaults to cancellation',focus('43-clear-confirm').get('text')=='取消')
check('clear-all reaches empty history',any('播放过的剧集会自动保存在这里' in t for t in texts('44-history-empty')))
check('clear-all preserves favorites',card('45-clear-retains-favorites')==card('19-favorite-retained'))
report={'passed':len(checks),'checks':checks,'visual_review':'Separate screenshot inspection required; these assertions inspect recorded XML only.'}
(root/'convenience-assertions.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
