"""Animate every own-room cat pose and validate the final bundled files.

Run build-approved-cat.py, build-signature-cat.py and build-cat-head-idle.py first.
Dependencies: Python 3, Pillow, numpy, OpenCV. New art uses a cyan background
for deterministic removal; all motion frames derive from one master per pose.
"""
from pathlib import Path
import hashlib
import json
import math
import cv2
import numpy as np
from PIL import Image, ImageSequence, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/characters/cat-approved'
OUT = ROOT / 'assets/images/characters'
ORDER = ['idle', 'blink', 'wink', 'seated', 'wave', 'stretch', 'sleep', 'groom']
Y, X = np.indices((512, 512), dtype=np.float32)

def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)

def clean_and_normalize(name):
    assert name in ('sleep','stretch')
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
    fixed_region = (slice(485,None),slice(235,315)) if name in ('groom','wave') else (slice(490,None),slice(None))
    assert all(np.array_equal(np.asarray(frames[0])[fixed_region],np.asarray(f)[fixed_region]) for f in frames)
    path = OUT/f'cat-approved-{name}.webp'
    lossless = name == 'groom'
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
            if name == 'seated':
                # Look from side to side: rigid head rotation, not whole-sprite bobbing.
                w = 1-smooth((y-338)/70)
                angle = math.radians(8)*math.sin(phase)*w
                dx,dy = x-255,y-340
                hx = dx*np.cos(angle)-dy*np.sin(angle)-dx
                hy = dx*np.sin(angle)+dy*np.cos(angle)-dy
                tail = smooth((x-350)/45)*(1-smooth((y-420)/45))
                return hx + 12*math.sin(phase*2)*tail,hy
            if name == 'sleep':
                # Chest/back slowly rise, muzzle remains nearly resting on paws.
                back = smooth((x-330)/75) * (1-smooth((y-405)/65))
                upper = 1-smooth((y-390)/80)
                return np.zeros_like(x), -swell*(1.5*upper + 4.5*back)
            if name == 'stretch':
                grounded = 1-smooth((y-435)/45)
                back = smooth((x-340)/65)
                tail = smooth((x-380)/35) * (1-smooth((y-245)/80))
                # Rise out of the low stretch, then lower the head and raise hips again.
                head = (1-smooth((x-340)/60))*(1-smooth((y-425)/55))
                return 10*math.sin(phase)*tail, -30*swell*head+18*swell*back*grounded
            raise ValueError(f'Unsupported deformation pose: {name}')
        frames.append(deform(master, field))
    encode(name, frames, duration)

def prepare_paw_rig():
    # One planted paw in the body plate + one moving paw. No third foreleg.
    raw = Image.open(SRC/'groom-body-generated.png').convert('RGB')
    rgb = np.asarray(raw).astype(np.float32)
    cyan = np.minimum(rgb[:,:,1],rgb[:,:,2])-rgb[:,:,0]
    alpha = 1-smooth((cyan-3)/60)
    edge = cyan>0
    rgb[edge,1] = np.minimum(rgb[edge,1],rgb[edge,0])
    rgb[edge,2] = np.minimum(rgb[edge,2],rgb[edge,0])
    body = Image.fromarray(np.dstack([rgb,alpha*255]).round().astype('uint8'))
    original = Image.open(SRC/'groom-foreleg-source.png').convert('RGBA')
    assert original.size == body.size == (1254,1254)
    # Trace only the raised foreleg; never carry the erroneous planted paw.
    outline = [(244,753),(245,714),(249,685),(268,661),(291,647),(326,647),
        (358,658),(385,682),(402,710),(405,741),(397,769),(434,803),
        (458,838),(470,880),(457,917),(422,942),(377,929),(338,912),
        (304,883),(276,847),(256,804)]
    mask = Image.new('L',original.size)
    ImageDraw.Draw(mask).polygon(outline,fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.0))
    yy,xx = np.indices((1254,1254),dtype=float)
    joint_fade = smooth(np.sqrt((xx-436)**2+(yy-900)**2)/75)
    mask = Image.fromarray((np.asarray(mask)*joint_fade).astype('uint8'))
    paw = original.copy()
    paw.putalpha(Image.fromarray((np.asarray(original.getchannel('A')).astype(float)*np.asarray(mask)/255).astype('uint8')))
    # Keep a rounded shoulder joint; the root stays inside the torso at all angles.
    body.save(SRC/'paw-rig-body.png'); paw.save(SRC/'paw-rig-foreleg.png')
    bounds = body.getbbox(); scale=432/(bounds[3]-bounds[1])
    width=round((bounds[2]-bounds[0])*scale)
    left=(512-width)//2-bounds[0]*scale; top=500-bounds[3]*scale
    def normalize(im):
        return im.transform((512,512),Image.Transform.AFFINE,
            (1/scale,0,-left/scale,0,1/scale,-top/scale),Image.Resampling.BICUBIC)
    body,paw=normalize(body),normalize(paw)
    pivot=(430*scale+left,900*scale+top)
    tip=(320*scale+left,700*scale+top)
    return body,paw,pivot,tip

def make_paw_action(name):
    body,paw,pivot,tip = prepare_paw_rig()
    keys = ([(0,-112),(4,-104),(12,-3),(17,-16),(22,0),(27,-16),
             (32,0),(37,-16),(45,-104),(49,-112)] if name=='groom' else
            [(0,-112),(7,-65),(13,-5),(19,-65),(25,-5),(31,-65),
             (37,-5),(44,-95),(49,-112)])
    def angle_at(frame):
        for (a,va),(b,vb) in zip(keys,keys[1:]):
            if a<=frame<=b:
                return va+(vb-va)*float(smooth((frame-a)/(b-a)))
        return keys[-1][1]
    frames=[];tips=[]
    for frame in range(50):
        angle=math.radians(angle_at(frame));c,sn=math.cos(angle),math.sin(angle)
        # Inverse affine map: one physical foreleg rotates around its shoulder.
        px,py=pivot
        layer=paw.transform(paw.size,Image.Transform.AFFINE,
            (c,sn,px-c*px-sn*py,-sn,c,py+sn*px-c*py),Image.Resampling.BICUBIC)
        result=body.copy();result.alpha_composite(layer);frames.append(result)
        dx,dy=tip[0]-px,tip[1]-py
        tips.append((px+c*dx-sn*dy,py+sn*dx+c*dy))
    excursion=float(np.linalg.norm(np.ptp(np.array(tips),axis=0)))
    assert excursion>100, 'paw action must visibly lift and lower'
    encode(name,frames,80)
    (SRC/f'{name}-action.json').write_text(json.dumps({
        'planted_forepaws_in_body':1,'moving_foreleg_layers':1,
        'source_pivot':list(pivot),'paw_tip_excursion_px':excursion,
        'action': 'lower-lift-rub-lower' if name=='groom' else 'lower-lift-wave-lower',
        'keys':keys},indent=2)+'\n')

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
        assert max(durations)<=200, f'{name} has a static hold'
        assert any(not np.array_equal(frames[0],f) for f in frames[1:]), name
        # Lossy WebP can encode the same RGB endpoint differently. Geometry
        # must match exactly and its color difference must stay within the measured bound.
        assert np.array_equal(frames[0][:,:,3],frames[-1][:,:,3]), f'{name} loop geometry'
        opaque = (frames[0][:,:,3]>245) & (frames[-1][:,:,3]>245)
        seam_error = np.abs(frames[0][:,:,:3].astype(float)-frames[-1][:,:,:3])[opaque]
        assert seam_error.mean()<2 and np.percentile(seam_error,99)<=12, f'{name} loop color jump'
        assert all(not f[0,:,3].any() and not f[-1,:,3].any() and
                   not f[:,0,3].any() and not f[:,-1,3].any() for f in frames), f'{name} clipped'
        fixed_region = (slice(485,None),slice(235,315)) if name in ('groom','wave') else (slice(490,None),slice(None))
        assert all(np.array_equal(frames[0][fixed_region][:,:,3], f[fixed_region][:,:,3]) for f in frames), f'{name} support paw drift'
        if name == 'groom':
            # Eye/nose/mouth pixels stay fixed; the moving paw may cover the cheek.
            for x0,y0,x1,y1 in [(135,230,185,278),(200,230,320,322)]:
                assert all(np.array_equal(frames[0][y0:y1,x0:x1],f[y0:y1,x0:x1]) for f in frames), 'groom face warped'
        report['poses'][name] = {'frames':len(frames), 'duration_ms':sum(durations),
            'max_hold_ms':max(durations),'bytes':path.stat().st_size,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'animated':True,'loop_geometry_equal':True,'no_clipping':True,
            'loop_mean_rgb_error':float(seam_error.mean()),
            'loop_p99_rgb_error':float(np.percentile(seam_error,99)),
            'support_paw_alpha_fixed':True}
    still = Image.open(OUT/'cat-approved-still.webp')
    assert getattr(still,'n_frames',1) == 1
    (SRC/'motion-set-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__ == '__main__':
    make_paw_action('wave')
    make_paw_action('groom')
    for name in ['blink','wink']: make_expression(name)
    make_pose('seated',Image.open(SRC/'seated-normalized.png').convert('RGBA'),50,80)
    for name,count,duration in [('stretch',50,80),('sleep',60,100)]:
        make_pose(name,clean_and_normalize(name),count,duration)
    verify()
