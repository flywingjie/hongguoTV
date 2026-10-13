#!/usr/bin/env python3
"""Check v0.2.1 recorded remote interactions; visually inspect screenshots too."""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(sys.argv[1])
checks = []


def nodes(name):
    return list(ET.parse(root / (name + '.xml')).iter('node'))


def focused(name):
    node = next(n for n in nodes(name) if n.get('focused') == 'true')
    assert node.get('package') == 'com.hongguotv.nativeapp', name
    return node


def box(node):
    return list(map(int, re.findall(r'\d+', node.get('bounds'))))


def check(label, passed):
    assert passed, label
    checks.append(label)


def position(name):
    label = next(n.get('text') for n in nodes(name) if '已暂停' in n.get('text', ''))
    match = re.search(r'(\d+):(\d+) /', label)
    return int(match[1]) * 60 + int(match[2])


for name, expected in [
    ('04-synopsis-expanded', '收起简介'),
    ('05-synopsis-collapsed', '完整简介'),
    ('06-synopsis-repeated', '完整简介'),
    ('11-quality-720', '清晰度上限：720P'),
    ('12-quality-1080', '清晰度上限：1080P'),
    ('13-autonext-off', '自动播放下一集：关闭'),
    ('14-autonext-on', '自动播放下一集：开启'),
    ('17-1080-expanded', '收起简介'),
    ('18-1080-collapsed', '完整简介'),
]:
    check(name + ': changed control retains focus', focused(name).get('text') == expected)

for name, width, height in [
    ('01-720-font130', 1280, 720),
    ('08-720-font150', 1280, 720),
    ('09-720-default', 1280, 720),
    ('10-1080-default', 1920, 1080),
]:
    b = box(focused(name))
    check(name + ': focused card fits safe area',
          b[0] >= width * .049 and b[1] >= height * .049
          and b[2] <= width * .951 and b[3] <= height * .951)
    cards = [n for n in nodes(name) if n.get('clickable') == 'true'
             and n.get('content-desc') and box(n)[1] == b[1]]
    check(name + ': all five cards align within row',
          len(cards) == 5 and len({tuple(box(n)[1::2]) for n in cards}) == 1)

heights = [box(focused(n))[3] - box(focused(n))[1] for n in
           ('09-720-default', '01-720-font130', '08-720-font150')]
check('card height grows with font size', heights[0] < heights[1] < heights[2])
check('large-font second row scrolls to top',
      box(focused('01-720-font130'))[1] == box(focused('02-720-font130-row'))[1])
check('return restores large-font card and scroll position',
      focused('07-return-card').get('content-desc') == focused('02-720-font130-row').get('content-desc')
      and box(focused('07-return-card')) == box(focused('02-720-font130-row')))
check('upgrade preserves episode 104 progress', focused('16-long-detail').get('text') == '继续第 104 集')
check('real playback pauses after starting', position('19-playback-paused') > 0)
check('right seeks ten seconds', position('20-playback-seek') - position('19-playback-paused') == 10)
check('last episode next button disabled', any(n.get('text') == '下一集' and n.get('enabled') == 'false' for n in nodes('21-player-menu')))
check('remote skips disabled next button', focused('21-player-menu').get('text') == '选集')
check('back restores current episode', focused('22-return-episode').get('content-desc') == '第 104 集')
check('back restores history card', focused('23-return-history').get('content-desc') == focused('15-upgrade-history').get('content-desc'))
report = {'passed': len(checks), 'checks': checks,
          'visual_checks_required': ['No clipped glyphs at font scales 1.0, 1.3, 1.5', 'Synopsis and focused button remain visible']}
(root / 'interaction-assertions.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
