"""Assemble whole-character imagegen frames. No limb rigs, warps or optical flow.

Only cyan keying, a common scale and whole-frame translation align each drawing.
"""
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image, ImageSequence

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/characters/cat-drawn'
OUT=ROOT/'assets/images/characters'
NAMES=['groom','wave','seated','stretch']
SEQUENCES={
    # Omit crossed-arm drawings that read as a second muzzle instead of a paw.
    'groom':[0,1,2,3,4,5,4,5,4,5,4,11,12,13,14,0],
    'wave':[0,1,2,3,4,5,4,5,8,9,10,11,12,13,14,0],
    # Return through the same perspective before looking the other way.
    'seated':[0,1,2,3,2,4,2,0,7,0,9,10,9,5,9,0],
    # The generated release sits upright; reverse the crouch-to-stretch drawings
    # instead so the action returns to its own crouched starting posture.
    'stretch':[0,1,2,3,4,5,6,7,8,7,6,5,4,3,2,1,0],
}

def key_cyan(im):
    a=np.asarray(im.convert('RGB')).astype(float)
    d=np.minimum(a[:,:,1],a[:,:,2])-a[:,:,0]
    t=np.clip((d-3)/60,0,1);alpha=1-t*t*(3-2*t)
    edge=d>0
    a[edge,1]=np.minimum(a[edge,1],a[edge,0])
    a[edge,2]=np.minimum(a[edge,2],a[edge,0])
    return Image.fromarray(np.dstack([a,alpha*255]).round().astype('uint8'))

def build(name, preview_only=False):
    sheet=Image.open(SRC/f'{name}-sheet.png')
    cells=[];anchors=[]
    for row in range(4):
        for col in range(4):
            box=(round(col*sheet.width/4),round(row*sheet.height/4),
                 round((col+1)*sheet.width/4),round((row+1)*sheet.height/4))
            cell=key_cyan(sheet.crop(box));a=np.asarray(cell);h,w=a.shape[:2]
            # Anchor each entire drawing at the same planted forepaw. The toe
            # marks are pink and occur below the cheek, in the lower cell area.
            yy,xx=np.indices((h,w))
            rgb=a[:,:,:3].astype(float)
            pink=(rgb[:,:,0]-rgb[:,:,1]>18)&(rgb[:,:,0]-rgb[:,:,2]>14)&(a[:,:,3]>230)
            pink &= (yy>h*.76)&(xx>w*.45)&(xx<w*.72)
            if pink.sum()>8:
                ax=float(np.median(xx[pink]))
                visible=(a[:,:,3]>128)&(np.abs(xx-ax)<w*.08)
                ay=float(yy[visible].max())
            else:
                bounds=cell.getbbox();ax=(bounds[0]+bounds[2])/2;ay=bounds[3]-1
            if name=='stretch':
                # Both forepaws slide during a stretch. Keep the whole silhouette
                # above the floor instead of pinning one moving toe to the floor.
                ay=cell.getbbox()[3]-1
            cells.append(cell);anchors.append((ax,ay))
    # One scale preserves the drawn head dips and body changes between frames.
    max_height=max(c.getbbox()[3]-c.getbbox()[1] for c in cells)
    scale=420/max_height
    frames=[]
    for cell,(ax,ay) in zip(cells,anchors):
        target_x=275 if name!='stretch' else 265
        left=target_x-ax*scale;top=495-ay*scale
        frame=cell.transform((512,512),Image.Transform.AFFINE,
            (1/scale,0,-left/scale,0,1/scale,-top/scale),Image.Resampling.BICUBIC)
        frames.append(frame)
    # Reuse the actual first drawing as the endpoint, not a regenerated imitation.
    frames=[frames[i].copy() for i in SEQUENCES[name]]
    durations=[160]*len(frames)
    durations[0]=240;durations[-1]=240
    dest=SRC/f'{name}-drawn.webp' if preview_only else OUT/f'cat-approved-{name}.webp'
    staging=dest.with_name(dest.stem+'.building.webp')
    frames[0].save(staging,save_all=True,append_images=frames[1:],duration=durations,
                   loop=0,lossless=True,method=4)
    decoded=[];timings=[]
    for f in ImageSequence.Iterator(Image.open(staging)):
        a=np.asarray(f.convert('RGBA')).copy();a[a[:,:,3]==0,:3]=0
        decoded.append(a);timings.append(f.info['duration'])
    assert len(decoded)>=12 and sum(timings)==sum(durations)
    assert np.array_equal(decoded[0],decoded[-1])
    assert all(not a[0,:,3].any() and not a[-1,:,3].any() and
               not a[:,0,3].any() and not a[:,-1,3].any() for a in decoded),f'{name}: clipping'
    staging.replace(dest)
    frame_dir=SRC/f'{name}-frames';frame_dir.mkdir(exist_ok=True)
    for i,frame in enumerate(frames):frame.save(frame_dir/f'{i:02d}.png')
    info={'source':'built-in imagegen, whole-character drawings',
          'grid':[4,4],'sheet_sha256':hashlib.sha256((SRC/f'{name}-sheet.png').read_bytes()).hexdigest(),
          'sheet_cells':16,'playback_cell_indices':SEQUENCES[name],
          'drawn_frames':len(set(SEQUENCES[name])),
          'encoded_frames':len(decoded),'duration_ms':sum(timings),
          'common_scale':scale,'planted_paw_anchors':anchors,
          'art_deformation':False,'loop_endpoint_equal':True,'no_clipping':True,
          'file_bytes':dest.stat().st_size,'asset_sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
    (SRC/f'{name}-verification.json').write_text(json.dumps(info,indent=2)+'\n')
    print(json.dumps(info))
    return frames,durations

if __name__=='__main__':
    import sys
    names=[n for n in sys.argv[1:] if n in NAMES] or NAMES
    for name in names:build(name,preview_only='--preview' in sys.argv)
