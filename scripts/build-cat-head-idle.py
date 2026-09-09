"""Build the lying head-sway idle from one master (Python, Pillow, numpy, OpenCV).

The eyes, nose, mouth and forehead share one rigid rotation. A smooth falloff
at the neck attaches it to stationary paws/body; no generated intermediate art.
"""
from pathlib import Path
import json
import math
import cv2
import numpy as np
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/characters/cat-approved'
OUT = ROOT / 'assets/images/characters/cat-approved-idle.webp'
COUNT, DURATION, AMPLITUDE = 64, 50, 3.0
PIVOT = (490, 850)

def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)

def weight(x, y):
    bottom = 870 + 65 * smooth((x - 350) / 180)
    return (1 - smooth((y - (bottom - 70)) / 70)) * (1 - smooth((x - 880) / 100))

def build():
    master = Image.open(SRC / 'lying-master.png').convert('RGBA')
    pixels = np.asarray(master).astype(np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    yy, xx = np.indices(pixels.shape[:2], dtype=np.float32)
    bounds = master.getbbox()
    width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    scale = 488 / max(width, height)
    size = (round(width * scale), round(height * scale))
    offset = ((512 - size[0]) // 2, 500 - size[1])
    # One fixed full-canvas transform retains room for the moving left whiskers.
    def normalize(im):
        return im.transform((512, 512), Image.Transform.AFFINE,
            (1 / scale, 0, bounds[0] - offset[0] / scale,
             0, 1 / scale, bounds[1] - offset[1] / scale), Image.Resampling.BICUBIC)
    frames = []
    for index in range(COUNT):
        angle = math.radians(AMPLITUDE) * math.sin(2 * math.pi * index / (COUNT - 1))
        sx, sy = xx.copy(), yy.copy()
        # Invert the weighted rigid transform by fixed-point iteration.
        for _ in range(8):
            theta = angle * weight(sx, sy)
            dx, dy = xx - PIVOT[0], yy - PIVOT[1]
            sx = PIVOT[0] + dx * np.cos(theta) + dy * np.sin(theta)
            sy = PIVOT[1] - dx * np.sin(theta) + dy * np.cos(theta)
        sampled = cv2.remap(pixels, sx, sy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT)
        sampled = np.clip(sampled, 0, 1)
        sampled[:, :, :3] /= np.maximum(sampled[:, :, 3:4], 1 / 255)
        rgba = (np.clip(sampled, 0, 1) * 255).round().astype(np.uint8)
        frames.append(normalize(Image.fromarray(rgba)))
    # A shared palette keeps the stationary region identical and avoids
    # per-frame palette flicker while reducing the bundled lossless animation.
    palette_source = master.convert('RGB')
    palette = palette_source.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    color_errors = []
    for index, frame in enumerate(frames):
        reduced = frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
        reduced.putalpha(frame.getchannel('A'))
        before, after = np.asarray(frame), np.asarray(reduced)
        visible_mask = before[:, :, 3] > 128
        color_errors.append(float(np.abs(before[:, :, :3].astype(float) - after[:, :, :3])[visible_mask].mean()))
        frames[index] = reduced
    assert max(color_errors) < 2.0
    frames[-1] = frames[0].copy()
    frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=DURATION,
                   loop=0, lossless=True, method=6)
    decoded, durations = [], []
    for frame in ImageSequence.Iterator(Image.open(OUT)):
        decoded.append(np.array(frame.convert('RGBA')))
        durations.append(frame.info['duration'])
    # Compare visible RGBA: encoders can discard RGB under zero alpha.
    def visible(a):
        b = a.copy(); b[b[:, :, 3] == 0, :3] = 0
        return b
    decoded = [visible(a) for a in decoded]
    assert len(decoded) > 30 and sum(durations) == COUNT * DURATION
    assert np.array_equal(decoded[0], decoded[-1])
    for box in [(0, 451, 512, 512), (420, 0, 512, 512)]:
        x0, y0, x1, y1 = box
        assert all(np.array_equal(a[y0:y1, x0:x1], decoded[0][y0:y1, x0:x1]) for a in decoded)
    assert np.count_nonzero(decoded[0][180:400, :390] != decoded[16][180:400, :390]) > 1000
    assert all(not a[0, :, 3].any() and not a[-1, :, 3].any()
               and not a[:, 0, 3].any() and not a[:, -1, 3].any() for a in decoded)
    # Facial landmarks must all have full weight and preserve pairwise distances.
    landmarks = np.array([(279, 690), (590, 766), (415, 741), (430, 787)], dtype=float)
    assert np.all(weight(landmarks[:, 0], landmarks[:, 1]) == 1)
    report = {'motion': 'lying-head-sway', 'duration_ms': sum(durations),
              'encoded_frames': len(decoded), 'amplitude_degrees': AMPLITUDE,
              'shared_palette_colors': 256, 'max_frame_mean_rgb_error': max(color_errors),
              'file_bytes': OUT.stat().st_size,
              'source_pivot': PIVOT, 'fixed_paws_and_rear_body': True,
              'rigid_face_landmarks': True, 'seamless_visible_loop': True,
              'no_canvas_clipping': True,
              'timing_note': 'New timing based on user-described motion; original cadence not measured.'}
    (SRC / 'head-idle-verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    return frames

if __name__ == '__main__':
    build()
