"""Assemble full-character imagegen drawings with common face scale and colors.

No sliced limbs, local warps, mesh animation, or optical-flow inbetweens.
"""
from pathlib import Path
import hashlib,json,math
import cv2
import numpy as np
from PIL import Image,ImageSequence

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/characters/cat-consistent'
OUT=ROOT/'assets/images/characters'
ORDER=['idle','blink','wink','seated','wave','stretch','sleep','groom']
SEQUENCES={n:list(range(15))+[0] for n in ORDER}
# Cell 1 raises the opposite paw; omit it and use the matching lowering drawings
# in reverse for anticipation. The selected greeting consistently uses the right paw.
SEQUENCES['wave']=[0,12,11,10,2,3,4,5,6,7,8,9,10,11,12,13,14,0]
SEQUENCES['seated']=[0,2,3,2,0,6,7,6,0,10,11,10,0,14,0,0]
SEQUENCES['groom']=[0,1,2,4,5,6,7,8,9,8,9,10,11,12,13,14,0]

def key_cyan(im):
    a=np.asarray(im.convert('RGB')).astype(float)
    d=np.minimum(a[:,:,1],a[:,:,2])-a[:,:,0]
    t=np.clip((d-3)/60,0,1);alpha=1-t*t*(3-2*t)
    edge=d>0;a[edge,1]=np.minimum(a[edge,1],a[edge,0]);a[edge,2]=np.minimum(a[edge,2],a[edge,0])
    return Image.fromarray(np.dstack([a,alpha*255]).round().astype('uint8'))

def cells_from_sheet(path):
    im=key_cyan(Image.open(path));a=np.asarray(im)
    n,labels,stats,centers=cv2.connectedComponentsWithStats((a[:,:,3]>128).astype('uint8'))
    cats=[(s,c) for s,c in zip(stats[1:],centers[1:]) if s[4]>5000]
    assert len(cats)==16, f'{path.name}: expected 16 separate cats, found {len(cats)}'
    cats.sort(key=lambda p:p[1][1]);ordered=[]
    for r in range(4):ordered.extend(sorted(cats[r*4:r*4+4],key=lambda p:p[1][0]))
    cells=[];boxes=[]
    for (x,y,w,h,area),center in ordered:
        box=(max(0,int(x)-2),max(0,int(y)-2),min(im.width,int(x+w)+2),min(im.height,int(y+h)+2))
        cells.append(im.crop(box));boxes.append(box)
    return cells,boxes

def eye_pair(im):
    a=np.asarray(im);h,w=a.shape[:2];gray=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2GRAY)
    mask=((gray<115)&(a[:,:,3]>230)).astype('uint8')
    n,labels,stats,centers=cv2.connectedComponentsWithStats(mask)
    candidates=[]
    for (x,y,bw,bh,area),c in zip(stats[1:],centers[1:]):
        if 15<area<w*h*.035 and bw<w*.22 and bh<h*.22 and c[0]<w*.84 and h*.18<c[1]<h*.83:
            candidates.append((area,c))
    pairs=[]
    for i,(area,a) in enumerate(candidates):
        for other,b in candidates[i+1:]:
            dx=abs(a[0]-b[0]);dy=abs(a[1]-b[1])
            if w*.18<dx<w*.43 and dy<h*.18 and .25<area/other<4:
                pairs.append((area+other,sorted([a,b],key=lambda p:p[0])))
    if not pairs:return None
    return np.array(max(pairs,key=lambda p:p[0])[1])

def paw_groups(im):
    a=np.asarray(im);h,w=a.shape[:2];rgb=a[:,:,:3].astype(float);yy,xx=np.indices((h,w))
    bounds=im.getbbox();bottom=bounds[3]-1
    foreground_width=bounds[2]-bounds[0]
    pink=(rgb[:,:,0]>215)&(rgb[:,:,0]-rgb[:,:,1]>18)&(rgb[:,:,2]>145)&(np.abs(rgb[:,:,1]-rgb[:,:,2])<38)&(a[:,:,3]>230)
    pink &= yy>bottom-(bounds[3]-bounds[1])*.23
    cols=np.where(pink.any(axis=0))[0]
    assert len(cols)>3,'missing planted toes'
    splits=np.where(np.diff(cols)>foreground_width*.07)[0]+1
    groups=[]
    for cols in np.split(cols,splits):
        region=pink&(xx>=cols.min())&(xx<=cols.max())
        if region.sum()<8:continue
        x=(float(cols.min())+float(cols.max()))/2
        floor=(a[:,:,3]>128)&(np.abs(xx-x)<foreground_width*.08)
        groups.append((x,float(yy[floor].max()),float(cols.min()),float(cols.max())))
    assert groups,'missing planted paws'
    return groups

def anchor(im,name):
    groups=paw_groups(im)
    if name=='wave':return groups[0][:2]
    if name=='groom':return groups[-1][:2]
    if name=='stretch':
        bounds=im.getbbox()
        groups=[g for g in groups if g[0]<bounds[0]+(bounds[2]-bounds[0])*.7]
    return ((groups[0][2]+groups[-1][3])/2,float(max(g[1] for g in groups)))

def palette():
    a=np.asarray(key_cyan(Image.open(SRC/'model-sheet.png')))
    rgb=a[:,:,:3][a[:,:,3]>245]
    # Shared canonical colors, preserving antialiasing alpha separately.
    strip=Image.fromarray(rgb[:len(rgb)//256*256].reshape((-1,256,3)))
    return strip.quantize(colors=128,method=Image.Quantize.MEDIANCUT)

def head_span(im):
    # In every initial pose the upper 35% contains the head/ears. A separate
    # tail component is excluded. Unlike closed eyelid centroids, this remains
    # comparable between waking and sleeping faces.
    a=np.asarray(im);mask=(a[:round(im.height*.35),:,3]>128).astype('uint8')
    _,_,stats,_=cv2.connectedComponentsWithStats(mask)
    head=max(stats[1:],key=lambda s:s[4])
    return float(head[2])

def build(name,preview=False):
    cells,boxes=cells_from_sheet(SRC/f'{name}-sheet.png')
    pairs=[eye_pair(c) for c in cells]
    distances=[float(np.linalg.norm(p[1]-p[0])) if p is not None else None for p in pairs]
    # One uniform scale per pose makes the head comparable across poses; do not
    # normalize by total height, which previously shrank the stretching head.
    initial_head_span=head_span(cells[0])
    scale=320/initial_head_span
    pal=palette();frames=[];anchors=[]
    initial_anchor=anchor(cells[0],name)
    target=(256+scale*(initial_anchor[0]-cells[0].width/2),493)
    for im in cells:
        ax,ay=anchor(im,name);anchors.append((ax,ay))
        left=target[0]-scale*ax;top=target[1]-scale*ay
        f=im.transform((512,512),Image.Transform.AFFINE,(1/scale,0,-left/scale,0,1/scale,-top/scale),Image.Resampling.BICUBIC)
        alpha=f.getchannel('A');f=f.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');f.putalpha(alpha)
        # Re-measure after palette/resampling so rounding or toe-color changes
        # cannot reintroduce the earlier planted-paw alignment regression.
        actual=anchor(f,name)
        offset=(round(target[0]-actual[0]),round(target[1]-actual[1]))
        aligned=Image.new('RGBA',f.size);aligned.paste(f,offset);f=aligned
        frames.append(f)
    frames=[frames[i].copy() for i in SEQUENCES[name]]
    duration={'idle':200,'sleep':300}.get(name,160)
    durations=[duration]*len(frames)
    dest=SRC/f'{name}-preview.webp' if preview else OUT/f'cat-approved-{name}.webp'
    staging=dest.with_name(dest.stem+'.building.webp')
    frames[0].save(staging,save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True,method=4)
    decoded=[];dt=[]
    for f in ImageSequence.Iterator(Image.open(staging)):
        a=np.array(f.convert('RGBA'));a[a[:,:,3]==0,:3]=0;decoded.append(a);dt.append(f.info['duration'])
    assert len(decoded)>1 and sum(dt)==sum(durations)
    assert np.array_equal(decoded[0],decoded[-1]),f'{name}: loop seam'
    assert all(not f[0,:,3].any() and not f[-1,:,3].any() and not f[:,0,3].any() and not f[:,-1,3].any() for f in decoded),f'{name}: clipping'
    decoded_anchors=np.array([anchor(Image.fromarray(f),name) for f in decoded])
    drift=np.ptp(decoded_anchors,axis=0)
    assert max(drift)<=2,f'{name}: planted paw drift {drift}'
    staging.replace(dest)
    report={'source':'imagegen full-character frames','sheet_sha256':hashlib.sha256((SRC/f'{name}-sheet.png').read_bytes()).hexdigest(),'crop_boxes':boxes,'initial_head_span':initial_head_span,'head_span_method':'largest alpha component in upper 35 percent of initial drawing','common_scale':scale,'target_head_span':320,'anchors':anchors,'source_cell_indices':SEQUENCES[name],'frames':len(decoded),'duration_ms':sum(dt),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'loop_endpoint_equal':True,'no_clipping':True,'local_art_deformation':False,'common_palette':'model-sheet.png, 128 colors'}
    report['decoded_paw_center_drift_px']=float(drift[0]);report['decoded_floor_drift_px']=float(drift[1])
    (SRC/f'{name}-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'pose':name,'scale':scale,'eyes':distances,'anchors':anchors,'bytes':dest.stat().st_size}))
    (SRC/'frames'/name).mkdir(parents=True,exist_ok=True)
    for i,f in enumerate(frames):f.save(SRC/'frames'/name/f'{i:02d}.png')
    return frames

if __name__=='__main__':
    import sys
    names=[n for n in sys.argv[1:] if n in ORDER] or ORDER
    for name in names:build(name,'--preview' in sys.argv)
