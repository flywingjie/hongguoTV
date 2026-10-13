#!/usr/bin/env python3
"""Check captured 0.8.0 evidence; not a UI driver or physical-TV acceptance test."""
import json
import re
import sys
import xml.etree.ElementTree as E
from pathlib import Path

root = Path(sys.argv[1])
checks = []

def nodes(name): return list(E.parse(root / (name + '.xml')).iter('node'))
def texts(name): return '\n'.join(n.get('text', '') for n in nodes(name))
def focus(name): return next(n for n in nodes(name) if n.get('focused') == 'true')
def check(name, result):
    if not result: raise AssertionError(name)
    checks.append(name)

for name, passed in json.loads((root / 'playback-validation.json').read_text()).items():
    check('playback: ' + name, passed is True)
for name in ['34-silent-open', '35-silent-manual-next', '38-silent-auto-next',
             '40-back-hides-progress', '43-back-hides-controls', '45-chooser-cancel-stays-hidden']:
    check(name + ' has no progress overlay', not any(n.get('text') or n.get('class') == 'android.widget.ProgressBar' for n in nodes(name)))
for name in ['37-user-progress', '39-visible-progress']:
    check(name + ' shows progress on explicit pause', '已暂停' in texts(name) and any(n.get('class') == 'android.widget.ProgressBar' for n in nodes(name)))
before = (root / 'before-back-media.txt').read_text()
after = (root / 'after-back-media.txt').read_text()
check('back preserves active paused episode 2', 'active=true' in after and 'state=PAUSED(2)' in after and '第 2 集' in after)
check('back does not seek', re.search(r'position=(\d+)', before)[1] == re.search(r'position=(\d+)', after)[1])
check('second back restores original resume card', focus('41-second-back-exits').get('content-desc', '').startswith('接着看，糯糯'))
frames = re.findall(r'Playback first frame episode=(\d+)', (root / 'playback.log').read_text())
check('first frames include episode 1 then episode 2', any(a == '1' and b == '2' for a, b in zip(frames, frames[1:])))
check('up opens playback controls', all(label in texts('42-controls') for label in ['播放', '上一集', '下一集', '选集', '播放设置']))
check('chooser focuses current episode', focus('44-chooser-from-hidden').get('content-desc') == '第 2 集，当前播放')
check('sixth column is reachable', focus('52-sixth-column').get('content-desc', '').startswith('第 6 名'))
check('down preserves grid column', focus('53-second-row').get('content-desc', '').startswith('第 12 名'))
check('quality cancel restores focus', focus('55-quality-refocused').get('text', '').startswith('默认清晰度'))
check('settings have two groups', all(t in texts('33-settings') for t in ['播放偏好', '片单与设备']))
for name in ['46-large-home', '47-large-favorites', '49-large-last-setting']:
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', focus(name).get('bounds')))
    check(name + ' fits 720p safe area', 64 <= x1 < x2 <= 1216 and 36 <= y1 < y2 <= 684)
check('last setting reachable at 1.5 font scale', focus('49-large-last-setting').get('text') == '开源许可')
covers = json.loads((root / 'cover-dimensions.json').read_text())
check('eight measured source covers near 7:10', len(covers) == 8 and all(abs(c['width'] / c['height'] - .7) < .001 for c in covers))
installed = json.loads((root / 'installed-apk.json').read_text())
check('installed APK equals release candidate', installed['sha256'] == installed['installed_sha256'])
check('release certificate retained', '3579f7a8a91bbbc44688db60fb16a5561921784af23fa92f39b849086d76ca98' in (root / 'apk-signature.txt').read_text())
badging = (root / 'apk-badging.txt').read_text()
check('version 0.8.0 targets Android 8 minimum', "sdkVersion:'26'" in badging and "versionCode='8'" in badging and "versionName='0.8.0'" in badging)
check('no final-run Android fatal exception', 'FATAL EXCEPTION' not in (root / 'final-runtime.log').read_text())
result = {'count': len(checks), 'passed': checks, 'scope': 'Assertions over captured evidence only; screenshots were also visually reviewed. Physical-TV testing remains separate.'}
(root / 'evidence-assertions.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'saved_evidence_checks': len(checks)}))
