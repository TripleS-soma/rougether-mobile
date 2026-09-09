"""Animate every own-room cat pose and validate the final bundled files.

Run build-approved-cat.py, build-signature-cat.py and build-cat-head-idle.py first.
Dependencies: Python 3, Pillow, numpy, OpenCV. New art uses a cyan background
for deterministic removal. Four actions use whole-character imagegen drawings.
"""
from pathlib import Path
import hashlib
import json
import math
import runpy
import sys
import cv2
import numpy as np
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/characters/cat-approved'
OUT = ROOT / 'assets/images/characters'
ORDER = ['idle', 'blink', 'wink', 'seated', 'wave', 'stretch', 'sleep', 'groom']
Y, X = np.indices((512, 512), dtype=np.float32)

def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)

def clean_and_normalize(name):
    assert name == 'sleep'
    raw = Image.open(SRC / f'{name}-generated.png').convert('RGB')
    rgb = np.asarray(raw).astype(np.float32)
    cyan = np.minimum(rgb[:, :, 1], rgb[:, :, 2]) - rgb[:, :, 0]
    alpha = 1 - smooth((cyan - 3) / 60)
    # The reference palette is warm; remove cyan spill only at keyed edges.
    edge = cyan > 0
    rgb[edge, 1] = np.minimum(rgb[edge, 1], rgb[edge, 0])
    rgb[edge, 2] = np.minimum(rgb[edge, 2], rgb[edge, 0])
    rgba = np.dstack([rgb, alpha * 255]).round().astype('uint8')
    master = Image.fromarray(rgba)
    master.save(SRC / f'{name}-master.png')
    bounds = master.getbbox()
    subject = master.crop(bounds)
    longest = 480
    scale = longest / max(subject.size)
    size = tuple(round(n * scale) for n in subject.size)
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (512, 512))
    canvas.alpha_composite(subject, ((512-size[0])//2, 500-size[1]))
    canvas.save(SRC / f'{name}-normalized.png')
    assert np.count_nonzero(np.asarray(canvas)[:, :, 3] > 128) > 50000
    return canvas

def deform(im, displacement):
    rgba = np.asarray(im).astype(np.float32) / 255
    rgba[:, :, :3] *= rgba[:, :, 3:4]
    sx, sy = X.copy(), Y.copy()
    for _ in range(7):
        dx, dy = displacement(sx, sy)
        sx, sy = X - dx, Y - dy
    sampled = np.clip(cv2.remap(rgba, sx, sy, cv2.INTER_CUBIC,
                               borderMode=cv2.BORDER_CONSTANT), 0, 1)
    sampled[:, :, :3] /= np.maximum(sampled[:, :, 3:4], 1/255)
    return Image.fromarray((np.clip(sampled, 0, 1)*255).round().astype('uint8'))

def breath(x, y, phase, amount=4):
    # Face translates rigidly; only the lower body deforms toward anchored feet.
    w = 1 - smooth((y - 410) / 70)
    return np.zeros_like(x), -amount * (1 - math.cos(phase)) / 2 * w

def encode(name, frames, duration):
    # One palette for all frames avoids palette flicker in stationary regions.
    sheet = Image.new('RGB', (512*min(4, len(frames)),512))
    for i in range(min(4,len(frames))):
        sheet.paste(frames[i*len(frames)//min(4,len(frames))].convert('RGB'),(i*512,0))
    palette = sheet.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    reduced = []
    for frame in frames:
        f = frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
        f.putalpha(frame.getchannel('A')); reduced.append(f)
    reduced[-1] = reduced[0].copy()
    fixed_region = (slice(490,None),slice(None))
    assert all(np.array_equal(np.asarray(frames[0])[fixed_region],np.asarray(f)[fixed_region]) for f in frames)
    path = OUT/f'cat-approved-{name}.webp'
    lossless = False
    keyframes = {} if lossless else {'kmin':1, 'kmax':1}
    staging = path.with_name(path.stem + '.building.webp')
    reduced[0].save(staging, save_all=True, append_images=reduced[1:], duration=duration,
                   loop=0, lossless=lossless, quality=90, method=4, **keyframes)
    # Measure the final encoding against the uncompressed animation timeline.
    encoded = Image.open(staging); elapsed = 0; errors = []
    for frame in ImageSequence.Iterator(encoded):
        actual = np.asarray(frame.convert('RGBA'))
        expected = np.asarray(frames[min(len(frames)-1,elapsed//duration)])
        opaque = (expected[:,:,3] > 245) & (actual[:,:,3] > 245)
        errors.append(float(np.abs(actual[:,:,:3].astype(float)-expected[:,:,:3])[opaque].mean()))
        elapsed += frame.info['duration']
    assert max(errors) < 4, f'{name} encoding lost too much detail'
    staging.replace(path)
    (SRC/f'{name}-encoding.json').write_text(json.dumps({
        'lossless':lossless,'quality':90,'max_frame_mean_rgb_error':max(errors),
        'source_support_paw_fixed':True},indent=2)+'\n')

def make_expression(name):
    opened = Image.open(SRC/'lying-open-normalized.png').convert('RGBA')
    expression = Image.open(SRC/f'lying-{name}-normalized.png').convert('RGBA')
    frames = []
    for i in range(50):
        ms = i*80
        closed = (1600 <= ms < 1760 or 1920 <= ms < 2080) if name == 'blink' else 1440 <= ms < 2080
        phase = 2*math.pi*i/49
        frames.append(deform(expression if closed else opened,
            lambda x,y: breath(x,y,phase,3.5)))
    encode(name, frames, 80)

def make_pose(name, master, count, duration):
    frames = []
    for i in range(count):
        phase = 2*math.pi*i/(count-1)
        swell = (1-math.cos(phase))/2
        def field(x,y):
            if name == 'sleep':
                # Chest/back slowly rise, muzzle remains nearly resting on paws.
                back = smooth((x-330)/75) * (1-smooth((y-405)/65))
                upper = 1-smooth((y-390)/80)
                return np.zeros_like(x), -swell*(1.5*upper + 4.5*back)
            raise ValueError(f'Unsupported deformation pose: {name}')
        frames.append(deform(master, field))
    encode(name, frames, duration)

def verify():
    report = {'own_room_order':ORDER, 'friend_room_still':'cat-approved-still.webp', 'poses':{}}
    for name in ORDER:
        path = OUT/f'cat-approved-{name}.webp'
        im = Image.open(path); frames=[]; durations=[]
        assert im.size == (512,512) and im.info.get('loop') == 0
        for f in ImageSequence.Iterator(im):
            a = np.asarray(f.convert('RGBA')).copy()
            a[a[:,:,3] == 0,:3] = 0
            frames.append(a); durations.append(f.info['duration'])
        assert len(frames)>1, f'{name} is static'
        # Encoders may merge two identical frames at a breathing turning point.
        drawn = name in ('groom','wave','seated','stretch')
        assert max(durations)<=(240 if drawn else 200), f'{name} has an excessive hold'
        assert any(not np.array_equal(frames[0],f) for f in frames[1:]), name
        # Lossy WebP can encode the same RGB endpoint differently. Geometry
        # must match exactly and its color difference must stay within the measured bound.
        assert np.array_equal(frames[0][:,:,3],frames[-1][:,:,3]), f'{name} loop geometry'
        opaque = (frames[0][:,:,3]>245) & (frames[-1][:,:,3]>245)
        seam_error = np.abs(frames[0][:,:,:3].astype(float)-frames[-1][:,:,:3])[opaque]
        assert seam_error.mean()<2 and np.percentile(seam_error,99)<=12, f'{name} loop color jump'
        assert all(not f[0,:,3].any() and not f[-1,:,3].any() and
                   not f[:,0,3].any() and not f[:,-1,3].any() for f in frames), f'{name} clipped'
        if drawn:
            source = ROOT/'assets/characters/cat-drawn'/f'{name}-verification.json'
            drawing_report = json.loads(source.read_text())
            assert drawing_report['asset_sha256'] == hashlib.sha256(path.read_bytes()).hexdigest()
            assert drawing_report['art_deformation'] is False
            assert drawing_report['encoded_frames'] == len(frames)
        else:
            fixed_region = (slice(490,None),slice(None))
            assert all(np.array_equal(frames[0][fixed_region][:,:,3], f[fixed_region][:,:,3]) for f in frames), f'{name} support paw drift'
        report['poses'][name] = {'frames':len(frames), 'duration_ms':sum(durations),
            'max_hold_ms':max(durations),'bytes':path.stat().st_size,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'animated':True,'loop_geometry_equal':True,'no_clipping':True,
            'loop_mean_rgb_error':float(seam_error.mean()),
            'loop_p99_rgb_error':float(np.percentile(seam_error,99)),
            'support_paw_alpha_fixed':not drawn,
            'animation_source':'imagegen whole-character frames' if drawn else 'approved master motion'}
    still = Image.open(OUT/'cat-approved-still.webp')
    assert getattr(still,'n_frames',1) == 1
    (SRC/'motion-set-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__ == '__main__':
    if '--verify-only' not in sys.argv:
        drawn = runpy.run_path(str(ROOT/'scripts/build-drawn-cat.py'))
        for name in drawn['NAMES']: drawn['build'](name)
        for name in ['blink','wink']: make_expression(name)
        make_pose('sleep',clean_and_normalize('sleep'),60,100)
    verify()
