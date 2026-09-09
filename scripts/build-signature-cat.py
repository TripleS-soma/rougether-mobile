"""시그니처 눕기 원화에서 깜빡임/윙크 제작용 원화와 친구 방 정지 이미지를 만든다.

Python 3, Pillow, numpy 필요. build-approved-cat.py 실행 후 실행한다.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/characters/cat-approved'
OUT = ROOT / 'assets/images/characters'
base = Image.open(SRC / 'lying-master.png').convert('RGBA')
closed = Image.open(SRC / 'lying-closed-reference.png').convert('RGBA')
assert base.size == closed.size == (1254, 1254)
eye_boxes = [(212, 618, 347, 762), (525, 695, 659, 838)]
masks = []
for box in eye_boxes:
    mask = Image.new('L', base.size)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    masks.append(mask.filter(ImageFilter.GaussianBlur(4)))

def expression(indices):
    result = base.copy()
    for index in indices:
        result = Image.composite(closed, result, masks[index])
    result.putalpha(base.getchannel('A'))
    return result

blink = expression([0, 1])
wink = expression([1])
outside_eyes = (np.asarray(masks[0]) == 0) & (np.asarray(masks[1]) == 0)
for frame in (blink, wink):
    assert np.array_equal(np.asarray(frame)[outside_eyes], np.asarray(base)[outside_eyes])

# All lying expressions use the same crop, scale and ground anchor.
bounds = base.getbbox()
width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
scale = 488 / max(width, height)
size = (round(width * scale), round(height * scale))
offset = ((512 - size[0]) // 2, 500 - size[1])

def normalize(im):
    canvas = Image.new('RGBA', (512, 512))
    canvas.alpha_composite(im.crop(bounds).resize(size, Image.Resampling.LANCZOS), offset)
    return canvas

base, blink, wink = [normalize(im) for im in (base, blink, wink)]
OUT.mkdir(exist_ok=True, parents=True)

# These are expression sources, not the interactive motion files.
for name, frame in [('open', base), ('blink', blink), ('wink', wink)]:
    frame.save(SRC / f'lying-{name}-normalized.png')
base.save(OUT / 'cat-approved-still.webp', lossless=True, method=6)
report = {'source_size': [512, 512], 'ground_y': 500,
          'eye_boxes_source': eye_boxes, 'pixels_outside_eye_masks_unchanged': True,
          'motion_builder': 'scripts/build-cat-motion-set.py',
          'still_usage': 'friend-room-only'}
(SRC / 'signature-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
