"""시그니처 눕기 원화에서 눈만 바꾸어 깜빡임/윙크를 생성한다.

Python 3, Pillow, numpy 필요. build-approved-cat.py 실행 후 실행한다.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageSequence

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

def save_loop(name, expressions, durations):
    path = OUT / f'cat-approved-{name}.webp'
    expressions[0].save(path, save_all=True, append_images=expressions[1:],
                        duration=durations, loop=0, lossless=True, method=6)
    encoded = Image.open(path)
    arrays, actual_durations = [], []
    for frame in ImageSequence.Iterator(encoded):
        arrays.append(np.asarray(frame.convert('RGBA')))
        actual_durations.append(frame.info['duration'])
    assert sum(actual_durations) == sum(durations)
    assert len(arrays) > 1
    assert all(np.array_equal(a[:, :, 3], arrays[0][:, :, 3]) for a in arrays)
    # The nose, mouth, paws, silhouette and entire back/tail stay fixed.
    for x0, y0, x1, y1 in [(145, 360, 210, 399), (0, 420, 512, 512), (395, 0, 512, 512)]:
        assert all(np.array_equal(a[y0:y1, x0:x1], arrays[0][y0:y1, x0:x1]) for a in arrays)
    visible = arrays[0][:, :, 3] > 0
    assert np.array_equal(arrays[0][visible], arrays[-1][visible])
    return {'duration_ms': sum(actual_durations), 'encoded_frames': len(arrays),
            'fixed_alpha': True, 'fixed_body': True, 'seamless_visible_loop': True}

checks = {
    'blink': save_loop('blink', [base, blink, base, blink, base], [1700, 90, 110, 90, 2010]),
    'wink': save_loop('wink', [base, wink, base], [1200, 650, 2150]),
}
report = {'default_pose': 'lying-head-sway', 'size': [512, 512], 'ground_y': 500,
          'eye_boxes_source': eye_boxes, 'pixels_outside_eye_masks_unchanged': True,
          'poses': ['lying', 'blink', 'wink', 'seated', 'wave'], 'loops': checks,
          'idle_verification': 'head-idle-verification.json'}
(SRC / 'signature-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
