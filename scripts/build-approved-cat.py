"""승인된 원화와 Blender 모션을 같은 크기/발 위치의 투명 WebP로 내보낸다.

개발 도구: Python 3, Pillow, numpy. 실행: python3 scripts/build-approved-cat.py
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/characters/cat-approved'
OUT = ROOT / 'assets/images/characters'

idle = Image.open(SRC / 'seated-master.png').convert('RGBA')
flood = idle.convert('RGB')
ImageDraw.floodfill(flood, (0, 0), (1, 2, 3), thresh=45)
alpha = np.where(np.all(np.asarray(flood) == [1, 2, 3], axis=2), 0, 255).astype('uint8')
connected = Image.fromarray(alpha).copy()
ImageDraw.floodfill(connected, (400, 550), 128, thresh=0)
alpha = np.where(np.asarray(connected) == 128, alpha, 0).astype('uint8')
assert np.count_nonzero(alpha) > 400000
idle.putalpha(Image.fromarray(alpha))
idle = idle.resize((677, 581), Image.Resampling.LANCZOS)

wave = Image.open(SRC / 'wave-master.webp')
frames, durations = [], []
for frame in ImageSequence.Iterator(wave):
    frames.append(frame.convert('RGBA'))
    durations.append(frame.info['duration'])
assert sum(durations) == 3000 and len(frames) > 1

# One crop for every pose. Independent trimming would shift face size/grounding.
bounds = [im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
          for im in [idle, *frames]]
x0, y0 = min(b[0] for b in bounds), min(b[1] for b in bounds)
x1, y1 = max(b[2] for b in bounds), max(b[3] for b in bounds)
side = max(x1 - x0, y1 - y0) + 24
left = (x0 + x1 - side) // 2
crop = (left, y1 + 12 - side, left + side, y1 + 12)

def normalize(im):
    return im.crop(crop).resize((512, 512), Image.Resampling.LANCZOS)

idle = normalize(idle)
frames = [normalize(frame) for frame in frames]
OUT.mkdir(parents=True, exist_ok=True)
idle.save(OUT / 'cat-approved-idle.webp', lossless=True, method=6)
frames[0].save(OUT / 'cat-approved-wave.webp', save_all=True, append_images=frames[1:],
               duration=durations, loop=0, lossless=True, method=6)

# Animation must contain a visible, fixed face and a seamless loop.
face = np.asarray(frames[0].crop((120, 175, 320, 270)))
assert face[:, :, 3].mean() > 245
assert all(np.array_equal(face, np.asarray(f.crop((120, 175, 320, 270)))) for f in frames)
assert np.array_equal(np.asarray(frames[0]), np.asarray(frames[-1]))

# WebP may discard RGB underneath alpha=0. Verify decoded visible pixels too.
encoded = Image.open(OUT / 'cat-approved-wave.webp')
decoded = [np.asarray(f.convert('RGBA')) for f in ImageSequence.Iterator(encoded)]
first, last = decoded[0], decoded[-1]
assert np.array_equal(first[:, :, 3], last[:, :, 3])
visible = first[:, :, 3] > 0
assert np.array_equal(first[visible], last[visible])
assert all(np.array_equal(first[175:270, 120:320], f[175:270, 120:320]) for f in decoded)
metadata = {'size': [512, 512], 'duration_ms': sum(durations), 'crop_at_677x581': crop,
            'wave_face_max_difference': 0, 'wave_first_last_visible_difference': 0,
            'source_frames': len(frames), 'poses': ['seated', 'wave']}
(SRC / 'verification.json').write_text('{\n' + ',\n'.join('  ' + json.dumps(k) + ': ' + json.dumps(v) for k, v in metadata.items()) + '\n}\n')
print(json.dumps(metadata))
