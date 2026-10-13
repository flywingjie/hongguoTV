#!/usr/bin/env python3
"""Validate recorded UIAutomator observations; does not replace real TV testing."""
import json,re,sys,xml.etree.ElementTree as ET
from pathlib import Path
root=Path(sys.argv[1])
checks=[]
def nodes(name):return list(ET.parse(root/(name+'.xml')).iter('node'))
def texts(name):return [n.get('text','') for n in nodes(name) if n.get('text')]
def focus(name):
    node=next(n for n in nodes(name) if n.get('focused')=='true')
    assert node.get('package')=='com.hongguotv.nativeapp',f'{name}: not the native app'
    return node
def check(name,value):
    assert value,name
    checks.append(name)
def position(name):
    value=next(t for t in texts(name) if '已暂停' in t)
    m=re.search(r'(\d+):(\d+) /',value)
    return int(m[1])*60+int(m[2])
check('native application home',focus('final-01-home').get('package')=='com.hongguotv.nativeapp')
card=focus('final-02-row-scroll')
check('second row scroll aligns to complete row',card.get('bounds')==focus('final-01-home').get('bounds'))
check('detail defaults to play',focus('final-03-detail').get('text')=='开始观看')
check('favorite saved',focus('final-04-favorite').get('text')=='已收藏')
check('center pauses playback',position('final-05-paused')>=0)
check('right seeks ten seconds',position('final-06-seek')-position('final-05-paused')==10)
check('down opens player controls',focus('final-07-player-menu').get('text')=='播放')
check('next episode plays',any('第 2 集' in t for t in texts('final-08-next-episode')))
check('paused background resume retains position',position('final-09-background-resume')==position('final-08-next-episode'))
check('back restores current episode focus',focus('final-10-return-episode').get('content-desc')=='第 2 集')
check('back restores original card',focus('final-11-return-card').get('content-desc')==card.get('content-desc'))
check('back restores row position',focus('final-11-return-card').get('bounds')==card.get('bounds'))
check('search input reachable with dpad',focus('final-12-search-focus').get('class')=='android.widget.EditText')
check('search returns cards',bool(focus('final-13-search-results').get('content-desc')))
check('results return to editable search query',focus('final-14-search-edit-again').get('class')=='android.widget.EditText')
check('favorites list retains saved series',focus('final-15-favorites').get('content-desc')==card.get('content-desc'))
check('recently watched retains current episode',any('第 2 集' in t for t in texts('final-16-history')))
check('background resume pauses at a saved nonzero position',position('final-17-active-background-resume')>0)
check('next page loads different content',focus('final-23-page-two').get('content-desc')!=focus('final-01-home').get('content-desc'))
check('page two detail returns to the same card',focus('final-25-page-two-return').get('content-desc')==focus('final-23-page-two').get('content-desc'))
if (root/'final-21-720-home.xml').exists():
    box=list(map(int,re.findall(r'\d+',focus('final-21-720-home').get('bounds'))))
    check('720p focused card fits safe area',box[0]>=60 and box[1]>=36 and box[2]<=1220 and box[3]<=684)
report={'passed':len(checks),'checks':checks}
(root/'tv-assertions.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
