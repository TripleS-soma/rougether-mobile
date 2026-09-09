# 고양이 전체 프레임 생성 기록

도구: 내장 `imagegen`, 참조 이미지 편집 방식. 각 동작 4×4 연속 그림. Blender/부위 회전/메시 변형 없이 그림 전체를 프레임으로 사용합니다.

참조: `../cat-approved/lying-master.png`, `../cat-approved/seated-master.png`.

후처리: 청록 배경 제거, 공통 배율, 프레임 전체 위치 정렬, WebP 인코딩. 생성 모델의 얼굴·체형 일관성이 자동 보장되는 것은 아니므로 시각 검수가 필요합니다.

## groom

```text
Use case: identity-preserve. Create a professionally DRAWN FRAME-BY-FRAME 2D animation SPRITE SHEET, exactly FOUR COLUMNS by FOUR ROWS, 16 equal square cells, row-major playback order. This is ONE continuous natural CAT FACE-WASHING animation, NOT sixteen unrelated poses, NOT rigid puppet pieces, NOT a rotating pasted foreleg.
Reference 1: approved lying cat identity. Reference 2: approved seated cat proportions and drawing style. Maintain the exact same appealing light warm-gray tabby kitten, three broad forehead stripes, cream face/belly, round brown eyes, tiny brown W mouth, two whiskers per side, pink cheeks, short thick kitten forelegs, compact seated haunches, striped tail on viewer right, soft thick warm taupe outlines and delicate watercolor texture.
All 16 cells MUST show the SAME full-body cat at the SAME scale, ground level, and body-center position. Fixed camera, no zoom. Use broad clean readable silhouettes and keep generous safe margins within each cell. Pure solid cyan #00FFFF background everywhere, no grid lines, no labels, no numbers, no shadows, no motion lines, no text, no props. Large square canvas, high resolution. Each cat should occupy about 75% of the cell height.
ANATOMY ABSOLUTE: Exactly TWO forelegs total. The viewer-left forepaw is the moving grooming paw. When this paw is raised, there is ONLY ONE planted forepaw, on viewer-right. Never leave a duplicate planted left forepaw below the raised arm. Hindquarters are a smooth rounded haunch, with no extra toe marks or extra feet. Limbs are short and naturally bend at elbow/wrist, never human arms.
Draw coherent real in-between poses, with elbow flexion, wrist turning, head leaning toward the paw, eyes closing during contact, and chest weight shifting slightly. The WHOLE character's drawing responds naturally to the action, preserving identity. Avoid a frozen head with a cutout arm rotating around it.
Frame sequence:
Row 1 cell 1: seated rest, both forepaws planted, eyes open.
Row 1 cell 2: anticipation, head dips slightly toward viewer-left, moving paw begins lifting off ground.
Row 1 cell 3: moving paw reaches chest, elbow naturally bends; only right forepaw planted.
Row 1 cell 4: head inclines toward raised paw near mouth, eyes soft, a tiny lick of the paw.
Row 2 cell 1: paw rises from mouth toward left cheek, head tilts into it.
Row 2 cell 2: paw reaches left side of face near eye; eyes gently closed.
Row 2 cell 3: paw strokes downward over cheek, wrist relaxed, head follows a little.
Row 2 cell 4: paw goes upward over cheek for the next wash, eyes closed.
Row 3 cell 1: second downward cheek stroke, subtle soft head following.
Row 3 cell 2: paw rises again a little, elbow still bent.
Row 3 cell 3: last cheek rub, soft contented expression.
Row 3 cell 4: paw moves away from cheek down toward chest, eyes opening.
Row 4 cell 1: paw descends from chest, head straightens gently.
Row 4 cell 2: moving paw reaches the ground, returning to two planted forepaws.
Row 4 cell 3: settling back into the initial seated posture.
Row 4 cell 4: exact same rest pose as frame 1 for a seamless loop.
Important: draw all sixteen cells fully; each cell is one temporally adjacent animation frame. No duplicated extra limbs in any cell. Preserve head/body proportions and markings throughout.
```

## wave

```text
Use case: identity-preserve. Draw a PROFESSIONAL FRAME-BY-FRAME 2D animation sprite sheet: exactly FOUR COLUMNS by FOUR ROWS, 16 equal square cells in row-major playback order, one continuous animation. Reference 1 is the approved lying cat identity; reference 2 is its approved seated proportions. Same light warm-gray tabby kitten, exactly three forehead stripes, cream face/belly, round chocolate-brown eyes, tiny brown W mouth, pink cheeks, two whiskers per side, small compact body, stubby short cat limbs, striped tail to viewer right, thick soft warm taupe outline and subtle watercolor texture. Same scale/camera/body-center/ground line in all cells. Full body in every cell with safe margins. Draw the whole character naturally responding to each action with body weight shifts and facial expression changes. NO rigid cutout limb pasted/rotated onto an otherwise frozen body. Anatomically coherent cat: only TWO forelegs total, never a raised foreleg plus TWO planted forepaws. Hindquarters are smooth haunches with no additional front-foot-like toe marks. Solid pure cyan #00FFFF background, no grid lines, no text/labels/numbers, no motion lines, no effects, no shadows. One cat per cell, each occupies about 75% of cell height. Adjacent cells must be coherent temporal in-betweens rather than unrelated poses. First and final cell exactly same rest posture for loop.
Animation: a cheerful seated kitten GREETING WITH ITS LEFT FOREPAW (viewer left), a natural cute full-character gesture. Sequence cells 1-16: 1 seated both forepaws down, 2 anticipation head lifts with bright eyes, 3 left paw lifts from ground, 4 elbow bends bringing paw to chest, 5 paw lifts OUTSIDE left of face at cheek height with elbow naturally bent, 6 paw swings outward slightly and kitten leans toward other planted forepaw, 7 paw swings inward with wrist flexing, 8 paw swings outward again, 9 paw swings inward again with happy closed-eye smile, 10 paw swings outward, 11 wave settles with eyes open, 12 paw lowers toward chest, 13 paw descends, 14 paw lands on ground, 15 body settles, 16 same as first. Keep the moving foreleg SHORT, no long human arm, never hide the face. Only one planted forepaw whenever the other is raised. Tail gives a small natural counter-swing.
```

## stretch

```text
Use case: identity-preserve. Draw a PROFESSIONAL FRAME-BY-FRAME 2D animation sprite sheet: exactly FOUR COLUMNS by FOUR ROWS, 16 equal square cells in row-major playback order, one continuous animation. Reference 1 is the approved lying cat identity; reference 2 is its approved seated proportions. Same light warm-gray tabby kitten, exactly three forehead stripes, cream face/belly, round chocolate-brown eyes, tiny brown W mouth, pink cheeks, two whiskers per side, small compact body, stubby short cat limbs, striped tail to viewer right, thick soft warm taupe outline and subtle watercolor texture. Same scale/camera/body-center/ground line in all cells. Full body in every cell with safe margins. Draw the whole character naturally responding to each action with body weight shifts and facial expression changes. NO rigid cutout limb pasted/rotated onto an otherwise frozen body. Anatomically coherent cat: only TWO forelegs total, never a raised foreleg plus TWO planted forepaws. Hindquarters are smooth haunches with no additional front-foot-like toe marks. Solid pure cyan #00FFFF background, no grid lines, no text/labels/numbers, no motion lines, no effects, no shadows. One cat per cell, each occupies about 75% of cell height. Adjacent cells must be coherent temporal in-betweens rather than unrelated poses. First and final cell exactly same rest posture for loop.
Animation: a real CAT FRONT-LEG STRETCH, not tiny breathing. Three-quarter view facing slightly viewer-left, compact cat body visible extending to right. Sequence cells 1-16: 1 relaxed low crouch with head up and two front paws under shoulders, 2 weight shifts back, 3 front paws slide forward together and head begins lowering, 4 elbows straighten with shoulders dipping, 5 hips rise and tail lifts, 6 head dips between the forward front paws, 7 reaches a deep feline stretch with rump up, 8 holds deep stretch and closes eyes contentedly, 9 head gives a tiny settling dip, 10 begins releasing, 11 hips lower as head rises, 12 elbows bend and front paws draw back slightly, 13 head rises more, 14 body returns to compact relaxed crouch, 15 settles, 16 matches first. Draw real changes in foreleg joint angles, back curvature, body pose and head position, same head size and same short-legged proportions. No elongated dog body, no extra paws, no floating character.
```

## seated

```text
Use case: identity-preserve. Draw a PROFESSIONAL FRAME-BY-FRAME 2D animation sprite sheet: exactly FOUR COLUMNS by FOUR ROWS, 16 equal square cells in row-major playback order, one continuous animation. Reference 1 is the approved lying cat identity; reference 2 is its approved seated proportions. Same light warm-gray tabby kitten, exactly three forehead stripes, cream face/belly, round chocolate-brown eyes, tiny brown W mouth, pink cheeks, two whiskers per side, small compact body, stubby short cat limbs, striped tail to viewer right, thick soft warm taupe outline and subtle watercolor texture. Same scale/camera/body-center/ground line in all cells. Full body in every cell with safe margins. Draw the whole character naturally responding to each action with body weight shifts and facial expression changes. NO rigid cutout limb pasted/rotated onto an otherwise frozen body. Anatomically coherent cat: only TWO forelegs total, never a raised foreleg plus TWO planted forepaws. Hindquarters are smooth haunches with no additional front-foot-like toe marks. Solid pure cyan #00FFFF background, no grid lines, no text/labels/numbers, no motion lines, no effects, no shadows. One cat per cell, each occupies about 75% of cell height. Adjacent cells must be coherent temporal in-betweens rather than unrelated poses. First and final cell exactly same rest posture for loop.
Animation: a seated curious kitten LOOKS LEFT AND RIGHT, with organically drawn neck/head turns and small ear movements, not rotating a flat face. Sequence cells 1-16: 1 seated facing viewer, 2 eyes glance to viewer-left, 3 head begins turning slightly left, 4 head three-quarter turns a LITTLE left, 5 curious gentle leftward head tilt while body stays seated, 6 ear twitches and head starts returning, 7 near front, 8 front with one brief blink, 9 eyes glance right, 10 head begins turning slightly right, 11 subtle three-quarter right head turn, 12 curious rightward head tilt, 13 head returns, 14 nearly front, 15 front eyes open, 16 same as first. Only small perspective turns so BOTH eyes remain visible, preserve eye size and separation consistently with perspective. Two front paws always planted, compact body, tail gives a quiet tip swish. Natural head/neck/body drawing changes across in-between frames.
```
