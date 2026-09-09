# 추가 자세 원화 생성 기록

생성 도구: built-in imagegen. 참조: `lying-master.png`, `seated-master.png`. 생성 결과: `stretch-generated.png`, `sleep-generated.png`, `groom-generated.png`. 청록 배경을 제거한 결과는 각 `*-master.png`, 앱 크기로 정규화한 제작용 중간 파일은 `*-normalized.png`다.

세 호출은 다음 공통 문장에 각 자세 문장을 붙여 실행했다.

## 공통 프롬프트

Use case: identity-preserve. Mobile game 2D watercolor cat sprite. Reference images show THE SAME approved character lying and seated. Preserve exact recognizable identity: warm light gray tabby, exactly three broad forehead stripes, cream lower face and belly, round chocolate-brown eyes, small brown W mouth, pink round cheeks, two whiskers per side, stubby rounded limbs, round striped tail, large head to small compact body proportions. Same thick soft warm taupe outline and subtle watercolor paper texture, NOT 3D. One single full body cat only, all ears/tail/feet fully visible with generous margin. No text, no accessories, no effects, no shadows, no ground, no checkerboard. Background MUST be solid pure bright cyan #00FFFF for deterministic color-key removal (the cat contains no cyan).

## 기지개

New pose: CAT STRETCHING, front three-quarter view facing viewer slightly left. Both front paws planted forward and chest/head low toward the ground, hindquarters raised a little behind to right, tail softly raised. Keep the head big and same round eyes open, face cute calm; no long human arms, no elongated dog torso. Clearly recognizable feline morning stretch, compact proportions. This is one key pose for a small breathing/stretch animation.

## 잠들기

New pose: SLEEPING CURLED UP. Cat is compact curled in a soft crescent, lying horizontally, head resting sideways on tucked front paws on the left, rounded back to the right, short striped tail curving along the front of body. Eyes closed as two simple smooth curved eyelid strokes, same head size and facial markings as references. No Z text, no sleep bubbles. Silhouette distinct from original front-paws-out resting pose. This is one key pose for a gentle sleeping breathing loop.

## 세수

New pose: SEATED CAT WASHING ITS CHEEK. Same seated proportions, one SHORT rounded front paw raised to touch the lower LEFT cheek from viewer perspective, paw just below eye and touching cheek, elbow tucked close to chest. Other front paw planted. Eyes both open, face completely recognizable. Do not hide nose, mouth or eyes. Tail curled beside rear to right. Front paw should look like a short kitten paw, no fingers, no human arm. One key pose for a tiny up-down cheek rub animation; silhouette must show the paw clearly next to cheek.

## 세수 몸통 수정 (추가 발 제거)

생성 도구: built-in imagegen. 입력은 기존 세수 그림이며, 출력은 `groom-body-generated.png`다. 기존 `groom-master.png`는 `groom-foreleg-source.png`로 이름을 바꾸고 움직일 앞발 추출에만 사용한다. 기존 전체 세수 그림과 `groom-generated.png`는 앱에 표시하지 않는다. `paw-rig-body.png`에는 지지 발 하나만 있고, `paw-rig-foreleg.png`를 관절에 맞춰 합성한다.

Precise object edit for a 2D cutout animation production asset. This image has an anatomy error: a raised foreleg on the LEFT from viewer perspective plus two planted forepaws. Create the CLEAN BODY PLATE needed to rig the raised foreleg separately. REMOVE the entire raised foreleg on viewer LEFT (from the rounded paw touching left cheek down through the elbow). Reconstruct the small covered area of cream left cheek smoothly, including its pink blush if needed. ALSO REMOVE the extra planted foreleg/toes at the bottom LEFT/center (the paw below the raised limb). In its place draw a smooth continuous small rounded cream belly/haunch with NO separate foot, NO pink toe marks, NO additional leg. Keep ONLY the planted foreleg on viewer RIGHT, next to the striped tail. The exported body plate should therefore have exactly ONE visible forepaw, on viewer RIGHT; the absent viewer-left forelimb will be added by the animator as a separate moving layer. Preserve the same cat, exact huge head outline, ears, three forehead stripes, two round brown eyes, nose, W mouth, whiskers, tail, seated proportions, texture, coloring and their positions. Keep same square composition and size; no redesign of face or body. Solid pure bright cyan #00FFFF background for keying, no checkerboard, no shadow, no text. Full body visible.
