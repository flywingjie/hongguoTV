#!/usr/bin/env python3
"""Verify saved release UI/log evidence; does not replace real-device acceptance."""
import json,re,statistics,sys,xml.etree.ElementTree as E
from pathlib import Path
root=Path(sys.argv[1]);checks=[]
def nodes(name):return list(E.parse(root/(name+'.xml')).iter('node'))
def text(name):return '\n'.join(n.get('text','') for n in nodes(name))
def focus(name):return next(n for n in nodes(name) if n.get('focused')=='true')
def check(label,condition):
    if not condition:raise AssertionError(label)
    checks.append(label)
for name,prefix in [('43-final-cached-home','接着看'),('42-final-updated-shelf','收藏有更新'),('44-final-later','稍后看'),('61-final-large-horizontal','热门发现')]:
    check(name+': correct shelf focus',focus(name).get('content-desc','').startswith(prefix))
check('update card shows added episode count','新增 3 集' in text('42-final-updated-shelf'))
for phrase in ['直接播放','收藏这部剧','加入稍后看','查看剧集详情','不在热门推荐中显示']:
    check('long press menu: '+phrase,phrase in text('45-final-longpress-menu'))
check('cancel restores the selected card','废物垫底皇子，反倒成为千古一帝第二季' in focus('46-final-menu-cancel-focus').get('content-desc',''))
check('background refresh keeps the same card and offers explicit update','热门已更新 · 按确认查看' in text('46-final-menu-cancel-focus'))
for name in ['60-final-large-home','61-final-large-horizontal','62-final-large-favorites']:
    node=focus(name);x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
    check(name+': selected card within TV safe area',64<=x1<x2<=1216 and 36<=y1<y2<=684)
    labels=[n for n in node.iter('node') if n.get('text')]
    badge=labels[-1];bx1,by1,bx2,by2=map(int,re.findall(r'\d+',badge.get('bounds')))
    check(name+': badge is fully visible',by2-by1>=25 and by2<=y2)
check('selected full title shown above horizontal cards','觉醒伪神：神明弃我我自为神5' in text('61-final-large-horizontal'))
check('selected card metadata available','全 192 集' in text('61-final-large-horizontal') and '脑洞' in text('61-final-large-horizontal'))
check('restored backup includes later and hidden counts','1 部稍后看' in text('56-final-import-preview') and '1 部已隐藏推荐' in text('56-final-import-preview'))
check('restore requires confirmation and preserves default settings',focus('56-final-import-preview').get('text')=='取消' and any(n.get('checked')=='false' and n.get('text')=='同时恢复播放设置和内容分类' for n in nodes('56-final-import-preview')))
check('hidden recommendation can be restored','恢复隐藏的热门推荐：0 部' in text('58-final-unhidden'))
for label,value in json.loads((root/'backup-validation.json').read_text()).items():check('backup: '+label,value is True)
cached=json.loads((root/'startup-cached.json').read_text())
check('three genuine cached cold-process launches',len(cached)==3 and all('LaunchState: COLD' in r['launch'] and 'Home content ready cached=true' in r['log'] for r in cached))
check('uncached content has its own timing','Home content ready cached=false' in (root/'startup-cold.log').read_text())
bench=json.loads((root/'playback-benchmark.json').read_text())
warm=[r for r in bench if r['path']=='warm-next'];cold=[r for r in bench if r['path']=='cold-next-before-prefetch']
check('nine successive switches completed',len(bench)==9)
check('three warm next-episode handoffs',len(warm)==3 and all('preloaded=true' in r['result'] for r in warm))
check('same episodes replayed through normal fallback',len(cold)==3 and all('preloaded=false' in r['result'] for r in cold) and [re.search(r'episode=(\d+)',r['result'])[1] for r in warm]==[re.search(r'episode=(\d+)',r['result'])[1] for r in cold])
check('no Android exception during final playback benchmark','FATAL EXCEPTION' not in (root/'playback-benchmark.log').read_text())
check('paused state retained after returning from background','已暂停' in text('65-final-resume-paused'))
check('media session paused after repeated switches','state=PAUSED(2)' in (root/'final-media-paused.txt').read_text())
check('media session inactive in background','active=false' in (root/'final-media-background.txt').read_text())
def millis(rows):return [int(re.search(r'elapsedMs=(\d+)',r['result'])[1]) for r in rows]
print(json.dumps({'assertions':len(checks),'passed':checks,'performance_ms':{'warm_next':millis(warm),'cold_next':millis(cold),'warm_median':statistics.median(millis(warm)),'cold_median':statistics.median(millis(cold))}},ensure_ascii=False,indent=2))
