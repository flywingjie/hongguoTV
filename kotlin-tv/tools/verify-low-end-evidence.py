#!/usr/bin/env python3
"""Validate saved 0.7.0 evidence, not a UI driver or physical-TV acceptance test."""
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

check('home focuses a resume card', focus('30-final-home').get('content-desc', '').startswith('接着看'))
check('down opens the current episode', focus('32-final-episodes').get('content-desc') == '第 5 集，当前播放')
for label in ['播放', '上一集', '下一集', '选集', '播放设置']:
    check('compact controls: ' + label, label in texts('33-final-controls'))
check('compatible fallback is visible', '1080P（兼容资源）' in texts('33-final-controls'))
check('cancel episode selector preserves pause', 'state=PAUSED(2)' in (root / 'episode-cancel-paused.txt').read_text())
check('background deactivates media session', 'active=false' in (root / 'background-media.txt').read_text())
check('resume stays paused', 'state=PAUSED(2)' in (root / 'resumed-media.txt').read_text())
check('direct playback returns to original series', '接着看，糯糯下山' in focus('35-direct-return').get('content-desc', ''))
check('favorites second page', focus('37-favorites-page2').get('content-desc') == '压力场景剧 022')
check('removal selects adjacent card', focus('38-favorite-neighbor').get('content-desc') == '压力场景剧 023')
check('home view-all available', focus('39-later-viewall').get('content-desc') == '查看全部稍后看')
check('same genre preserves collection', '‹ 返回首页' in texts('41-same-type-collection') and '稍后看' in texts('41-same-type-collection'))
check('collection back restores horizontal position', focus('42-home-scroll-restored').get('content-desc') == focus('39-later-viewall').get('content-desc') and focus('42-home-scroll-restored').get('bounds') == focus('39-later-viewall').get('bounds'))
for name in ['43-large-font-home', '44-large-font-favorites']:
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', focus(name).get('bounds')))
    check(name + ' focus fits 720p safe area', 64 <= x1 < x2 <= 1216 and 36 <= y1 < y2 <= 684)
check('backup preview defaults to cancel', focus('46-import-preview').get('text') == '取消')
check('backup settings restore is opt-in', any(n.get('checked') == 'false' and n.get('text') == '同时恢复播放设置和内容分类' for n in nodes('46-import-preview')))
for name, passed in json.loads((root / 'backup-validation.json').read_text()).items(): check('backup: ' + name, passed is True)
launches = json.loads((root / 'startup-cached.json').read_text())
check('three cached cold-process launches', len(launches) == 3 and all('LaunchState: COLD' in x['launch'] and 'Home content ready cached=true' in x['log'] for x in launches))
bench = json.loads((root / 'playback-benchmark.json').read_text())
check('nine switches reached rendered first frame with player reuse', len(bench) == 9 and all('Playback first frame' in x['result'] and 'reused=true' in x['result'] for x in bench))
warm = [x for x in bench if x['path'] == 'warm-next']
cold = [x for x in bench if x['path'] == 'cold-next-before-prefetch']
check('three prepared handoffs', len(warm) == 3 and all('preloaded=true' in x['result'] and 'prepared near end' in x['preparation'] for x in warm))
check('same episodes also play through normal loading', len(cold) == 3 and all('preloaded=false' in x['result'] for x in cold) and [re.search(r'episode=(\d+)', x['result'])[1] for x in warm] == [re.search(r'episode=(\d+)', x['result'])[1] for x in cold])
recovery = json.loads((root / 'network-recovery.json').read_text())
recovery_log = (root / 'network-recovery.log').read_text()
check('network timeout actually observed', recovery['network_timeout_observed'] and 'Playback failure: InterruptedIOException' in recovery_log)
check('automatic recovery after network timeout', 'Automatic playback recovery 1/3' in recovery_log)
check('recovery renders with a fresh player', recovery['fresh_player_after_error'] and 'Playback first frame' in recovery['online_first_frame'] and 'reused=false' in recovery['online_first_frame'])
installed = json.loads((root / 'installed-apk.json').read_text())
check('installed APK equals published candidate', installed['sha256'] == installed['installed_sha256'])
check('release signing certificate retained', '3579f7a8a91bbbc44688db60fb16a5561921784af23fa92f39b849086d76ca98' in (root / 'apk-signature.txt').read_text())
check('Android 8 minimum', "sdkVersion:'26'" in (root / 'apk-badging.txt').read_text())
check('bounded favorites view tree', int(re.search(r'Views:\s+(\d+)', (root / 'favorites-memory.txt').read_text())[1]) < 200)
check('no final-run Android fatal exception', 'FATAL EXCEPTION' not in (root / 'final-runtime.log').read_text())
result = {'count': len(checks), 'passed': checks, 'scope': 'Assertions over captured evidence only; visual review and physical-TV testing remain separate.'}
(root / 'evidence-assertions.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'saved_evidence_checks': len(checks)}))
