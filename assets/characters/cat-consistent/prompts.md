# 공통 고양이 원화와 모션 생성 기록

내장 imagegen 참조 이미지 편집 모드. 최초 사용자 캡처(`original-reference.png`)를 참조해 공통 원화(`model-sheet.png`)를 만든 뒤, 8종 모두 같은 원화를 참조했다. 이전 갈색 시안은 생성 참조로 사용하지 않았다.

조립: 배경 제거, 캐릭터별 실제 윤곽 분리, 첫 프레임 상단 35%에서 꼬리를 제외한 머리·귀 윤곽 폭을 공통 320px로 맞추는 동작별 균일 배율, 앞발 기준 위치 정렬, 공통 원화의 128색 팔레트, 무손실 WebP. 팔레트 적용 후 기준점을 다시 측정하여 프레임 전체를 정수 픽셀만큼 보정한다. 부분 리그/메시/광학 보간 없음. 머리 윤곽 폭은 크기를 맞추는 보조 기준이며 얼굴·체형 동일성의 자동 보장을 뜻하지 않는다. 인사 생성물은 프롬프트와 달리 화면 오른쪽 앞발을 주로 들었으므로, 반대 발을 드는 그림을 제외하고 오른쪽 앞발 동작으로 조립했다.

## 공통 원화 프롬프트

```text
Use case: identity-preserve. This is a strict CHARACTER MODEL SHEET, not a redesign. The attached small screenshot crop is the ONLY authoritative character identity. Reconstruct that exact kitten as clean 2D illustration without the room, rug or furniture.
Create one 2-by-2 sheet of FOUR full-body poses of this SAME kitten. All four heads have EXACTLY the same size and face design, same ear size, eye diameter and spacing, muzzle, forehead, colors, short limbs, and chunky baby proportions. Cell 1 top left: original signature lying pose with two large front paws forward, head gently tilted, tiny compact body to the right. Cell 2 top right: seated upright, but body below chin is very SHORT and CHUBBY, only about half the head height, short stubby forelegs, two front paws touching floor. Cell 3 bottom left: modest front-leg stretch, head remains as LARGE as in other cells, tiny rounded rump raised only a little, back is short, very short hind legs. NO elongated adult-cat or dog body. Cell 4 bottom right: curled-up sleeping, same LARGE head resting on front paws, small round body tucked behind, short thick striped tail tucked around right side.
Identity: large rounded gray head with two rounded triangular ears; three thick short medium-gray forehead bars; a soft ivory face patch rising in a rounded peak slightly to viewer right of center, ivory lower face/belly/paws; round small dark gray-brown eyes; extremely small dark gray-brown nose and tiny understated W mouth; pale pink circular cheeks; pale pink inner ears and tiny toe marks; two short gray whiskers per cheek; compact gray haunch with two muted gray marks; short thick curved tail with broad gray bands.
CRITICAL PALETTE: neutral light gray fur (#d0cbc4), subtle medium gray stripes (#b8b2aa), ivory nearly white face (#fffdf3), muted GRAY-TAUPE outlines (#958e82), dark muted brown-gray eyes (#62574b), pale blush (#f5c5bc). The reference is NOT beige, NOT brown fur, NOT orange or yellow, NOT dark chocolate outlines. Keep thin soft rounded gray outlines and quiet pastel contrast like the original. No heavy ink, no extra watercolor grain, no 3D shading.
One consistent flat color design across all four, minimal soft paper texture only. Exactly 2 forelegs and 2 hind legs; seated and lying haunches do not have extra toes. At most two visible front paws. Head is always dominant, never shrink the head for an action. Same scale across all four.
Pure solid cyan #00FFFF background for the entire sheet. No grid lines, labels, text, numbers, props, shadows, effects, decorative objects. Generous space around each kitten. Output square high-resolution model sheet. The original screenshot's soft edges may be sharpened slightly for asset use, but preserve its identity and its chunky short-bodied silhouette.
```

## 모션 공통 프롬프트

```text
Use case: identity-preserve. Generate a strict 4 COLUMNS x 4 ROWS SPRITE SHEET, sixteen equal square cells in temporal row-major order, one full kitten in each cell. Input 1 is the CANONICAL CHARACTER MODEL SHEET: match its face, chunky proportions and palette exactly. Input 2 is the original identity. Do not redesign. Each cell is a full-character drawn animation frame.
IDENTITY LOCK: enormous rounded baby-kitten head, THREE broad short gray forehead bars, two small circular dark gray-brown eyes separated by about 3.5 eye diameters center-to-center, a VERY TINY W mouth and tiny nose, small pale pink cheeks, rounded triangular ears, two whiskers each side, light neutral gray fur, near-white ivory face and belly, gray-taupe outline. Muted neutral colors, NO warm brown/orange outlines or cream/yellow fur. Match the same line weight, smooth fill, almost-flat gentle shading from model sheet. Keep all forehead/haunch/tail markings attached to the same anatomy. Exactly two forelegs total. Short stubby paws, compact body, no adult-cat proportions.
REGISTRATION LOCK: fixed camera and same head size in all 16 cells. Same body position, planted feet and baseline throughout. No frame-to-frame zoom, pan, hopping, sliding, bobbing of the entire cat or change in body proportions. Only the specified body parts performing the actual action move. The body drawing should be copied identically wherever that part is not acting. Do not enlarge the head in some cells or shrink it to fit a pose. Amplitude is small and quiet, suitable for a room pet loop.
Solid pure cyan #00FFFF background, no grid lines, NO TEXT or labels/numbers, no shadows/effects/props/room/rug. SAFE MARGINS on all sides of every cell, no cat touching a cell edge. Make a square sheet at high resolution. Adjacent frames are real temporal drawings, not unrelated alternative poses. Frame 16 matches frame 1. Same face/body/colors as the canonical model sheet; natural compact kitten joints, not long human arms.
```

## idle

```text
ACTION: signature LYING IDLE with gentle head sway, matching model-sheet TOP LEFT. All paws, torso and tail base remain in exactly the same place. Head makes only a tiny +/-3 degree slow tilt about the neck, same large size. Eyes stay open, same little W mouth. Frame 1 original slight head tilt; 2-4 gradually straighten the head by just a few degrees; 5-8 tilt those few degrees the other way; 9-12 slowly return toward original tilt; 13-16 settle into exact initial position. This must remain the original lying kitten, no sitting, no front paws lifting, no larger head turn.
```

## blink

```text
ACTION: signature LYING kitten, same model-sheet TOP LEFT pose and head angle, blinks softly TWICE. Body and head shape, outline and position identical across cells. 1-3 open eyes; 4 eyelids halfway; 5 closed eyes (gentle arcs); 6 halfway opening; 7-8 open; 9 halfway closing; 10 closed; 11 halfway opening; 12-16 open. Very slight drawn chest breathing only, front paws anchored, no change in head scale. The cat is always lying, not seated.
```

## wink

```text
ACTION: signature LYING kitten, model-sheet TOP LEFT pose, a shy WINK with viewer-right eye. Same head angle, mouth, body and paw position throughout. 1-4 both eyes open; 5 viewer-right eyelid halfway closed; 6-9 viewer-right eye gently closed as an arc, viewer-left eye remains its SAME circular size; 10 viewer-right eye halfway opening; 11-16 both eyes open. No face tilting or shrinking; a very slight natural chest breath only.
```

## seated

```text
ACTION: model-sheet TOP RIGHT SEATED kitten, VERY SHORT CHUBBY torso, chest below chin less than HALF head height, BOTH front paws planted. Curious looking side to side with SMALL yaw turns only, maximum 8 degrees, both eyes remain clearly visible and nearly circular. No head roll/side tilt. Do NOT make a narrow side profile or move the body. 1 front; 2 eyes glance left; 3-4 head turns just a little left; 5 begins returning; 6 front; 7 brief eyelid lowering; 8 blink; 9 front eyes open; 10 glance right; 11-12 slight head yaw right; 13 returns; 14-16 front. Keep face width, ear silhouette, eye diameter/spacing as consistent as perspective permits. Planted paw tips never shift in any cell.
```

## wave

```text
ACTION: model-sheet TOP RIGHT short CHUBBY SEATED kitten waves viewer-left forepaw. All cells retain same canonical LARGE head and very SHORT round torso. 1 both paws down; 2-3 left paw lifts bending at small elbow; 4 raised beside cheek; 5 paw wrist tips outward; 6 inward; 7 outward; 8 inward; 9 outward; 10 inward; 11 lowers to chest; 12-13 lowers further; 14 both paws down; 15-16 settle. Head stays same place and size, little closed W mouth (NO big open mouth or tongue). A small ear reaction is enough. When left paw raised there is exactly ONE planted front paw on viewer-right, no duplicate left ground paw. The raised foreleg is SHORT, never long like a human arm.
```

## stretch

```text
ACTION: model-sheet BOTTOM LEFT COMPACT front-leg stretch. Maintain the very LARGE canonical head throughout, same head width as resting and seated poses. Body behind head must stay very short, only a small rounded haunch. Back/hind legs do not elongate. It is a SMALL forepaw reach with rump rising at most one paw-height, not a tall yoga stretch. 1 signature lying rest; 2 anticipation; 3-4 both front paws slide forward by HALF a paw-length and shoulders lower a little; 5-6 tiny rounded rump lifts a little on extremely short hind legs; 7-9 hold modest stretch eyes contentedly closed; 10 eyes open and shoulders ease up; 11-12 rump lowers; 13-14 forepaws return; 15-16 original lying rest. Keep the enormous head and tiny body like the model sheet, NEVER shrink the head to fit extended body. No extra forepaws.
```

## sleep

```text
ACTION: model-sheet BOTTOM RIGHT CURLED SLEEPING kitten. Same large canonical head, tiny rounded body tucked closely behind, short thick striped tail around right side. Eyes gently closed throughout. 1 rest exhale; 2-4 chest and back VERY subtly expand; 5-8 small inhale peak; 9-12 gradually exhale; 13-16 settle to initial rest. Head/face/paws/tail tip remain in same position, same anatomy and outline design. Only subtle drawn breathing chest/back change, not full-body floating or camera zoom. Preserve the three forehead bars and tail band pattern exactly.
```

## groom

```text
ACTION: model-sheet TOP RIGHT short CHUBBY SEATED kitten washes viewer-left cheek with its viewer-left paw. Keep the same huge head and very short round torso. 1 both forepaws planted; 2 left paw leaves floor; 3 bent short paw near mouth; 4 tiny lick with eyes softly closed; 5 paw reaches left cheek; 6 paw strokes UP over left eye; 7 DOWN over SAME left cheek; 8 UP same cheek; 9 DOWN same cheek; 10 final small UP stroke; 11 paw moves away from left cheek; 12 chest height; 13 lowering; 14 lands; 15-16 original rest. NEVER sweep the forearm across the muzzle to the opposite cheek; keep it on viewer LEFT. No long forearm. When left paw raised, exactly ONE planted front paw on viewer-right; no duplicate planted left forepaw. Head leans into paw by only a few degrees, same face size/shape, body remains grounded at fixed baseline.
```
