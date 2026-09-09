"""Build and verify the common-model, frame-drawn cat animation set."""
from pathlib import Path
import hashlib,json,runpy,sys
import numpy as np
from PIL import Image,ImageSequence
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/characters/cat-consistent'
OUT=ROOT/'assets/images/characters'
ORDER=['idle','blink','wink','seated','wave','stretch','sleep','groom']

def verify():
    report={'own_room_order':ORDER,'friend_room_still':'cat-approved-still.webp','poses':{}}
    for name in ORDER:
        path=OUT/f'cat-approved-{name}.webp';im=Image.open(path)
        assert im.size==(512,512) and im.info.get('loop')==0
        frames=[];durations=[]
        for f in ImageSequence.Iterator(im):
            a=np.array(f.convert('RGBA'));a[a[:,:,3]==0,:3]=0
            frames.append(a);durations.append(f.info['duration'])
        assert len(frames)>1 and any(not np.array_equal(frames[0],f) for f in frames[1:]),f'{name}: static'
        assert np.array_equal(frames[0],frames[-1]),f'{name}: loop seam'
        assert max(durations)<=600,f'{name}: excessive hold'
        assert all(not f[0,:,3].any() and not f[-1,:,3].any() and not f[:,0,3].any() and not f[:,-1,3].any() for f in frames),f'{name}: clipped'
        sha=hashlib.sha256(path.read_bytes()).hexdigest();source=json.loads((SRC/f'{name}-verification.json').read_text())
        assert source['sha256']==sha and source['frames']==len(frames)
        assert source['local_art_deformation'] is False and source['target_head_span']==320
        report['poses'][name]={'frames':len(frames),'duration_ms':sum(durations),'max_hold_ms':max(durations),'bytes':path.stat().st_size,'sha256':sha,'animated':True,'loop_geometry_equal':True,'no_clipping':True,'animation_source':'imagegen common-model full-character frames'}
    still=Image.open(OUT/'cat-approved-still.webp');assert getattr(still,'n_frames',1)==1
    still_rgba=np.array(still.convert('RGBA'));idle=np.array(Image.open(OUT/'cat-approved-idle.webp').convert('RGBA'))
    for a in (still_rgba,idle):a[a[:,:,3]==0,:3]=0
    assert np.array_equal(still_rgba,idle),'friend still must match current idle'
    (SRC/'motion-set-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    # Maintain the existing report entry point without stale legacy pose records.
    (ROOT/'assets/characters/cat-approved/motion-set-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__=='__main__':
    if '--verify-only' not in sys.argv:
        builder=runpy.run_path(str(ROOT/'scripts/build-consistent-cat.py'))
        for name in ORDER:builder['build'](name)
        Image.open(OUT/'cat-approved-idle.webp').convert('RGBA').save(OUT/'cat-approved-still.webp',lossless=True,method=4)
    verify()
