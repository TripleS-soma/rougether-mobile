/* Rougether design-system card bundle generator (design-sync skill).
 * Emits self-contained HTML cards (first line: @dsCard marker) into ./out,
 * mirroring src/constants/theme.ts and the ui/ primitives.
 *
 * ⚠ 아래 THEMES/DARK/TYPE/SPACING/RADIUS 상수는 theme.ts의 수동 사본이다.
 *   토큰을 바꾸면 여기도 같이 고치고 재생성해서 재푸시할 것 (SKILL.md 참고).
 * Run: node .claude/skills/design-sync/generate.js */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');

const THEMES = {
  cozy: {
    appShell: '#E8DCC8',
    screen: '#FBF8F3',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    surfaceMuted: '#F5F1E8',
    border: '#E8DCC8',
    text: '#4A403A',
    textMuted: '#8B7E74',
    textDisabled: '#B5A89C',
    icon: '#8B7E74',
    primary: '#7FA87F',
    primaryActive: '#6D926D',
    onPrimary: '#2D2623',
    primaryText: '#517751',
    onTint: '#4A403A',
    success: '#5F9B6A',
    warning: '#E8A24A',
    warningText: '#9D6014',
    danger: '#D67878',
    disabledBg: '#D9D2C5',
    sky: '#C3E0F5',
    grass: '#B5D89A',
  },
  forest: {
    appShell: '#DCE8D0',
    screen: '#F6FAF1',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    surfaceMuted: '#EEF5E7',
    border: '#CFE0C3',
    text: '#334236',
    textMuted: '#667563',
    textDisabled: '#9DAE97',
    icon: '#667563',
    primary: '#5F9B6A',
    primaryActive: '#4D8657',
    onPrimary: '#202A22',
    primaryText: '#4A7953',
    onTint: '#334236',
    success: '#5F9B6A',
    warning: '#E8A24A',
    warningText: '#9D6014',
    danger: '#D67878',
    disabledBg: '#CBD8C4',
    sky: '#C3E0F5',
    grass: '#B5D89A',
  },
  hanok: {
    appShell: '#D8C8AF',
    screen: '#FAF5EA',
    surface: '#FFFDF8',
    card: '#FFFDF8',
    surfaceMuted: '#F2E8D7',
    border: '#D9C5A4',
    text: '#493B2E',
    textMuted: '#7F6E5E',
    textDisabled: '#A99B86',
    icon: '#7F6E5E',
    primary: '#9A7B4F',
    primaryActive: '#83663F',
    onPrimary: '#1C1712',
    primaryText: '#7F6541',
    onTint: '#493B2E',
    success: '#7E9A6A',
    warning: '#C9943F',
    warningText: '#886226',
    danger: '#C77A6A',
    disabledBg: '#DCCFB9',
    sky: '#C3E0F5',
    grass: '#B5D89A',
  },
};
// 다크 중립은 #755에서 cozy 바탕으로 전 테마 통일 — 테마별 차이는 액센트뿐.
const DARK = {
  cozy: {
    appShell: '#171310',
    screen: '#211C16',
    surface: '#2B251E',
    card: '#2B251E',
    surfaceMuted: '#362F26',
    border: '#453C31',
    text: '#EFE7DA',
    textMuted: '#B5A99A',
    textDisabled: '#7C7264',
    icon: '#B5A99A',
    primary: '#93BE93',
    primaryActive: '#7FA87F',
    onPrimary: '#1E2A1E',
    primaryText: '#93BE93',
    onTint: '#4A403A',
    success: '#7CB98A',
    warning: '#EDB061',
    warningText: '#EDB061',
    danger: '#E08D8D',
    disabledBg: '#3D362C',
    sky: '#2A3448',
    grass: '#33422E',
  },
  forest: {
    appShell: '#171310',
    screen: '#211C16',
    surface: '#2B251E',
    card: '#2B251E',
    surfaceMuted: '#362F26',
    border: '#453C31',
    text: '#EFE7DA',
    textMuted: '#B5A99A',
    textDisabled: '#7C7264',
    icon: '#B5A99A',
    primary: '#7FBC8B',
    primaryActive: '#6BAA78',
    onPrimary: '#14251A',
    primaryText: '#7FBC8B',
    onTint: '#334236',
    success: '#7CB98A',
    warning: '#EDB061',
    warningText: '#EDB061',
    danger: '#E08D8D',
    disabledBg: '#3D362C',
    sky: '#2A3448',
    grass: '#33422E',
  },
  hanok: {
    appShell: '#171310',
    screen: '#211C16',
    surface: '#2B251E',
    card: '#2B251E',
    surfaceMuted: '#362F26',
    border: '#453C31',
    text: '#EFE7DA',
    textMuted: '#B5A99A',
    textDisabled: '#7C7264',
    icon: '#B5A99A',
    primary: '#C4A16F',
    primaryActive: '#B08D5B',
    onPrimary: '#2A2113',
    primaryText: '#C4A16F',
    onTint: '#493B2E',
    success: '#96B37F',
    warning: '#DCA855',
    warningText: '#DCA855',
    danger: '#DA9384',
    disabledBg: '#3D362C',
    sky: '#2A3448',
    grass: '#33422E',
  },
};
const TYPE = {
  display1: [36, 42, 700],
  display2: [30, 36, 700],
  h1: [26, 32, 700],
  h2: [22, 28, 700],
  h3: [20, 26, 600],
  large: [20, 28, 500],
  body: [18, 26, 400],
  label: [16, 22, 600],
  supporting: [14, 18, 400],
  code: [15, 20, 500],
};
const SPACING = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 };
const RADIUS = { sm: 8, md: 12, lg: 16, pill: 999 };

const t = THEMES.cozy; // component cards render in the default (cozy light) theme
const FONT = `-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', sans-serif`;

const page = (group, title, body, extraCss = '') => `<!-- @dsCard group="${group}" -->
<!doctype html>
<meta charset="utf-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${FONT}; background: ${t.screen}; color: ${t.text}; padding: 24px; }
  h1 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
  .sub { font-size: 12px; color: ${t.textMuted}; margin-bottom: 20px; }
  .section { font-size: 12px; font-weight: 600; color: ${t.textMuted}; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: .04em; }
  ${extraCss}
</style>
<body>
<h1>${title}</h1>
${body}
</body>
`;

const out = (rel, html) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
  console.log('wrote', rel);
};

/* ---------- foundations/colors ---------- */
{
  const swatch = (name, hex, ink) => `
    <div class="sw">
      <div class="chip" style="background:${hex};color:${ink ?? '#fff'}"></div>
      <div class="meta"><b>${name}</b><span>${hex}</span></div>
    </div>`;
  const roleOrder = [
    'appShell',
    'screen',
    'surface',
    'surfaceMuted',
    'border',
    'text',
    'textMuted',
    'textDisabled',
    'primary',
    'primaryActive',
    'onPrimary',
    'primaryText',
    'onTint',
    'success',
    'warning',
    'warningText',
    'danger',
    'disabledBg',
    'sky',
    'grass',
  ];
  const block = (label, theme) => `
    <div class="theme" style="background:${theme.screen};border:1px solid ${theme.border}">
      <div class="tname" style="color:${theme.text}">${label}</div>
      <div class="grid">${roleOrder
        .map(
          (r) => `
        <div class="sw">
          <div class="chip" style="background:${theme[r]};border:1px solid ${theme.border}"></div>
          <div class="meta" style="color:${theme.textMuted}"><b style="color:${theme.text}">${r}</b><span>${theme[r]}</span></div>
        </div>`,
        )
        .join('')}
      </div>
    </div>`;
  const body = `
<div class="sub">Semantic roles — Astryx 구조, 브랜드 3테마 × 라이트/다크 (theme.ts와 1:1)</div>
${['cozy', 'forest', 'hanok'].map((id) => block(`${id} · light`, THEMES[id]) + block(`${id} · dark`, DARK[id])).join('')}`;
  const css = `
  .theme { border-radius: 16px; padding: 16px; margin-bottom: 16px; }
  .tname { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .sw { display: flex; align-items: center; gap: 8px; }
  .chip { width: 34px; height: 34px; border-radius: 10px; flex: none; }
  .meta { display: flex; flex-direction: column; font-size: 10px; }
  .meta b { font-size: 11px; font-weight: 600; }`;
  out('foundations/colors.html', page('Foundations', 'Colors — semantic roles', body, css));
  // 시간대별 하늘 (#358) — theme.ts SKY_BY_PHASE 수동 사본
  const SKY_BY_PHASE = {
    light: { dawn: '#DCD6EC', day: '#C3E0F5', sunset: '#F6CDAB', night: '#3E4A6B' },
    dark: { dawn: '#33324A', day: '#2A3448', sunset: '#463527', night: '#1E2536' },
  };
  const skyRow = (label, set) => `
    <div class="tname">${label}</div>
    <div class="grid">${Object.entries(set)
      .map(
        ([k, v]) => `
      <div class="sw"><div class="chip" style="background:${v}"></div>
      <div class="meta"><b>${k}</b><span>${v}</span></div></div>`,
      )
      .join('')}</div>`;
  const skyBody = `
<div class="sub">집 화면 하늘 — 기기 시각 기준 새벽(05–08)/낮(08–17)/노을(17–20)/밤 (#358)</div>
${skyRow('light', SKY_BY_PHASE.light)}${skyRow('dark', SKY_BY_PHASE.dark)}`;
  out('foundations/sky-by-phase.html', page('Foundations', 'Sky · 시간대', skyBody, css));
}

/* ---------- foundations/typography ---------- */
{
  const rows = Object.entries(TYPE)
    .map(
      ([role, [fs_, lh, fw]]) => `
    <div class="row">
      <div class="demo" style="font-size:${fs_}px;line-height:${lh}px;font-weight:${fw}">루틴을 함께, 매일 조금씩</div>
      <div class="spec">${role} · ${fs_}/${lh} · ${fw}</div>
    </div>`,
    )
    .join('');
  const css = `
  .row { padding: 10px 0; border-bottom: 1px dashed ${t.border}; }
  .spec { font-size: 11px; color: ${t.textMuted}; margin-top: 2px; font-variant-numeric: tabular-nums; }`;
  out(
    'foundations/typography.html',
    page(
      'Foundations',
      'Typography — type scale (base 16 · ratio 1.2)',
      `<div class="sub">Typography 토큰 (theme.ts)</div>${rows}`,
      css,
    ),
  );
}

/* ---------- foundations/spacing-radius ---------- */
{
  const sp = Object.entries(SPACING)
    .map(
      ([k, v]) => `
    <div class="sprow"><span class="k">${k}</span><div class="bar" style="width:${v * 3}px"></div><span class="v">${v}px</span></div>`,
    )
    .join('');
  const rad = Object.entries(RADIUS)
    .map(
      ([k, v]) => `
    <div class="radbox" style="border-radius:${Math.min(v, 32)}px"><b>${k}</b><span>${v === 999 ? 'pill' : v + 'px'}</span></div>`,
    )
    .join('');
  const body = `
<div class="sub">Spacing / Radius 토큰 (theme.ts)</div>
<div class="section">Spacing</div>${sp}
<div class="section">Radius</div><div class="radrow">${rad}</div>`;
  const css = `
  .sprow { display: flex; align-items: center; gap: 10px; padding: 4px 0; font-size: 12px; }
  .sprow .k { width: 44px; font-weight: 600; }
  .sprow .v { color: ${t.textMuted}; }
  .bar { height: 14px; background: ${t.primary}; border-radius: 4px; }
  .radrow { display: flex; gap: 12px; flex-wrap: wrap; }
  .radbox { width: 96px; height: 72px; background: ${t.surface}; border: 2px solid ${t.primary};
    display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; }
  .radbox span { color: ${t.textMuted}; font-size: 11px; }`;
  out('foundations/spacing-radius.html', page('Foundations', 'Spacing · Radius', body, css));
}

/* ---------- components/buttons ---------- */
{
  const btn = (bg, fg, label, extra = '') =>
    `<button class="btn" style="background:${bg};color:${fg};${extra}">${label}</button>`;
  const body = `
<div class="sub">ui/button — pill 버튼 (radius pill · padding 16/24)</div>
<div class="section">Variants</div>
<div class="rowset">
  ${btn(t.primary, t.onPrimary, '1회 뽑기')}
  ${btn(t.surface, t.text, '취소', `border:1px solid ${t.border};`)}
  ${btn(t.danger, t.onPrimary, '집에서 나가기')}
  ${btn(t.textDisabled, t.onPrimary, '비활성')}
</div>
<div class="section">Pressed (opacity .85 / primaryActive)</div>
<div class="rowset">
  ${btn(t.primaryActive, t.onPrimary, '누르는 중')}
</div>
<div class="section">Small action (미션 카드의 보상/추가)</div>
<div class="rowset">
  <button class="mini" style="background:${t.primary};color:${t.onPrimary}">＋</button>
  <button class="mini" style="background:${t.warning};color:${t.text}">보상 받기</button>
</div>`;
  const css = `
  .rowset { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .btn { border: 0; border-radius: 999px; padding: 16px 24px; font-size: 14px; font-weight: 600; font-family: inherit; }
  .mini { border: 0; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-family: inherit; }`;
  out('components/buttons.html', page('Components', 'Buttons', body, css));
}

/* ---------- components/chips-toggle ---------- */
{
  const body = `
<div class="sub">ui/pill · badge · wallet-pills · toggle-switch</div>
<div class="section">Pills & badges</div>
<div class="rowset">
  <span class="pill" style="background:${t.surfaceMuted};color:${t.text}">🪙 9,999+</span>
  <span class="pill" style="background:${t.surfaceMuted};color:${t.text}">💎 9,999+</span>
  <span class="badge" style="background:${t.warning};color:${t.onTint}">MY</span>
  <span class="badge" style="background:${t.primary};color:${t.onPrimary}">착용 중</span>
  <span class="badge" style="background:#C9A227;color:#fff">희귀</span>
</div>
<div class="section">Toggle switch (44×26 · thumb 22)</div>
<div class="rowset">
  <span class="track" style="background:${t.primary}"><span class="thumb on"></span></span>
  <span class="track" style="background:${t.border}"><span class="thumb"></span></span>
</div>
<div class="section">Section tab · layout pill</div>
<div class="rowset">
  <span class="pill" style="background:${t.primary};color:${t.onPrimary}">공동미션</span>
  <span class="pill" style="background:${t.surfaceMuted};color:${t.textMuted}">내 루틴</span>
  <span class="pill" style="background:${t.surfaceMuted};color:${t.primaryText}">＋ 만들기</span>
</div>`;
  const css = `
  .rowset { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; }
  .badge { padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .track { width: 44px; height: 26px; border-radius: 13px; padding: 2px; display: inline-flex; align-items: center; }
  .thumb { width: 22px; height: 22px; border-radius: 11px; background: #fff; }
  .thumb.on { transform: translateX(18px); }`;
  out('components/chips-toggle.html', page('Components', 'Chips · Badges · Toggle', body, css));
}

/* ---------- components/bear-check ---------- */
{
  // ui/bear-check (#344, design-sync 시안 A 채택) — 곰 헤드 루틴 체크 토글.
  const CAT = ['#E8A87C', '#7FA8D4', '#C8869C', '#7FA87F'];
  const bear = (fill, line, checked) => `
  <span class="bc">
    <i class="ear l" style="background:${fill};border-color:${line}"></i>
    <i class="ear r" style="background:${fill};border-color:${line}"></i>
    <i class="head" style="background:${fill};border-color:${line}">${checked ? '<svg viewBox="0 0 100 100" class="tick"><path d="M20 55 L42 74 L80 30"/></svg>' : ''}</i>
  </span>`;
  const body = `
<div class="sub">ui/bear-check — 루틴 완료 토글 (#344). 미완료 = 윤곽선, 완료 = 카테고리 색 + 흰 체크.</div>
<div class="section">States</div>
<div class="rowset">${bear(t.surface, t.textDisabled, false)}${bear(CAT[0], CAT[0], true)}</div>
<div class="section">Category colors</div>
<div class="rowset">${CAT.map((c) => bear(c, c, true)).join('')}</div>`;
  const css = `
  .rowset { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
  .bc { position: relative; display: inline-block; width: 30px; height: 34px; }
  .bc .ear { position: absolute; top: 0; width: 13px; height: 13px; border-radius: 50%; border: 2.5px solid; }
  .bc .ear.l { left: 0; transform: rotate(-14deg); }
  .bc .ear.r { right: 0; transform: rotate(14deg); }
  .bc .head { position: absolute; left: 1px; right: 1px; top: 5px; bottom: 0; border-radius: 46%;
    border: 2.5px solid; display: flex; align-items: center; justify-content: center; }
  .bc .tick { width: 14px; height: 14px; }
  .bc .tick path { stroke: #fff; stroke-width: 14; stroke-linecap: round; stroke-linejoin: round; fill: none; }`;
  out('components/bear-check.html', page('Components', 'BearCheck · 루틴 체크 토글', body, css));
}

/* ---------- patterns/mission-card ---------- */
{
  const row = (icon, title, prog, pct, meta, right) => `
  <div class="mrow">
    <div class="micon">${icon}</div>
    <div class="mbody">
      <div class="mhead"><b>${title}</b><span class="prog">${prog}</span></div>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
      <div class="mfoot"><span class="meta">${meta}</span>${right}</div>
    </div>
  </div>`;
  const body = `
<div class="sub">우리 그룹의 미션 — 상태별 액션 (＋ → 루틴 연동됨 → 기여함 → 보상 받기 → 완료)</div>
<div class="card">
  <div class="chead">🎯 우리 그룹의 미션 <span class="mk" style="margin-left:auto">＋ 만들기</span></div>
  ${row('📅', '이번 주 다같이 루틴 지키기', '0/10', 0, '주간 구성원 달성 횟수 · ~07.23', `<button class="mini" style="background:${t.primary};color:${t.onPrimary}">＋</button>`)}
  ${row('📅', '아침 스트레칭 모으기', '3/10', 30, '주간 구성원 달성 횟수', `<span class="meta">루틴 연동됨</span>`)}
  ${row('☀️', '기상 인증 모으기', '5/10', 50, '일일 구성원 달성률', `<span style="color:${t.primaryText};font-size:12px;font-weight:600">기여함</span>`)}
  ${row('☀️', '물 마시기 챌린지', '8/8', 100, '일일 구성원 달성률', `<button class="mini" style="background:${t.warning};color:${t.onTint}">보상 받기</button>`)}
  ${row('📅', '지난주 스트레칭 미션', '20/20', 100, '주간 구성원 달성 횟수', `<span class="meta">완료</span>`)}
</div>`;
  const css = `
  .card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 16px; padding: 16px; max-width: 420px; }
  .chead { display: flex; align-items: center; font-size: 16px; font-weight: 600; margin-bottom: 12px; }
  .mk { font-size: 12px; color: ${t.primaryText}; background: ${t.surfaceMuted}; padding: 4px 12px; border-radius: 999px; }
  .mrow { display: flex; gap: 10px; background: ${t.surfaceMuted}; border-radius: 12px; padding: 12px; margin-bottom: 8px; }
  .micon { font-size: 18px; }
  .mbody { flex: 1; }
  .mhead { display: flex; justify-content: space-between; font-size: 14px; }
  .prog { color: ${t.primaryText}; font-size: 12px; }
  .track { height: 8px; background: ${t.border}; border-radius: 4px; margin: 6px 0; }
  .fill { height: 8px; background: ${t.primary}; border-radius: 4px; }
  .mfoot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .meta { font-size: 12px; color: ${t.textMuted}; }
  .mini { border: 0; border-radius: 999px; padding: 5px 12px; font-size: 12px; font-family: inherit; }`;
  out('patterns/mission-card.html', page('Patterns', 'Mission card — 상태 5종', body, css));
}

/* ---------- patterns/room-tiles ---------- */
{
  const body = `
<div class="sub">집 화면 멤버 타일 — 방 미리보기(로드 후) vs 파스텔 폴백(로드 전/실패)</div>
<div class="tiles">
  <div class="tile preview">
    <div class="wall"></div><div class="floor"></div>
    <div class="furn" style="left:10%;top:12%">🪟</div>
    <div class="furn" style="right:10%;top:12%">🪴</div>
    <div class="furn" style="left:12%;bottom:26%">📚</div>
    <div class="chr">🐼</div>
    <span class="nametag">루티니1</span>
  </div>
  <div class="tile" style="background:#F5E1D8">
    <div class="avatar">🐑</div>
    <span class="name">채영</span>
  </div>
  <div class="tile preview">
    <div class="wall" style="background:#EFE3C8"></div><div class="floor" style="background:#E3CBA4"></div>
    <div class="furn" style="left:14%;top:14%">🖼️</div>
    <div class="furn" style="right:12%;bottom:28%">🪑</div>
    <div class="chr">🐶</div>
    <span class="mytag">MY</span>
    <span class="nametag">👑 준서 (나)</span>
  </div>
</div>`;
  const css = `
  .tiles { display: flex; gap: 12px; flex-wrap: wrap; }
  .tile { position: relative; width: 168px; height: 168px; border-radius: 16px; border: 1px solid ${t.border};
    overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
  .wall { position: absolute; inset: 0 0 50% 0; background: #EAF0DF; }
  .floor { position: absolute; inset: 50% 0 0 0; background: #DCCBAA; }
  .furn { position: absolute; font-size: 22px; }
  .chr { position: absolute; bottom: 22%; left: 50%; transform: translateX(-50%); font-size: 40px; }
  .avatar { font-size: 40px; }
  .name { font-size: 12px; font-weight: 600; color: ${t.onTint}; }
  .nametag { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,.4); color: #fff; font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 999px; white-space: nowrap; }
  .mytag { position: absolute; top: 8px; right: 8px; background: ${t.warning}; color: ${t.onTint};
    font-size: 9px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }`;
  out('patterns/room-tiles.html', page('Patterns', 'Member room tiles', body, css));
}

/* ---------- patterns/cover-picker ---------- */
{
  const cell = (name, g1, g2, selected) => `
  <div class="cell${selected ? ' sel' : ''}">
    <div class="art" style="background:linear-gradient(135deg,${g1},${g2})"></div>
    <span>${name}</span>
  </div>`;
  const body = `
<div class="sub">집 대표 이미지 선택 그리드 — 선택 셀은 primary 링 (실제 아트는 CDN house/* 키)</div>
<div class="grid">
  ${cell('구름 풍선 집', '#BFD9F2', '#F5E8FF', true)}
  ${cell('산호 수족관 집', '#FFD9CF', '#BFE8E2', false)}
  ${cell('버섯 숲 집', '#E0512F22', '#DCE8D0', false)}
  ${cell('밤의 천문대 집', '#2E3A5C', '#7E8FC9', false)}
</div>`;
  const css = `
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-width: 360px; }
  .cell { background: ${t.surfaceMuted}; border: 2px solid transparent; border-radius: 12px; padding: 4px;
    display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 12px; font-weight: 600; }
  .cell.sel { border-color: ${t.primary}; }
  .art { width: 100%; aspect-ratio: 1.4; border-radius: 8px; }`;
  out('patterns/cover-picker.html', page('Patterns', 'House cover picker', body, css));
}

/* ---------- patterns/gacha-selector ---------- */
{
  const chips = (n, active) =>
    Array.from(
      { length: n },
      (_, i) => `
    <span class="chip${i === active ? ' on' : ''}" style="background:${['#E8DCC8', '#D6E4D2', '#F7E6C8', '#D8D2EC', '#E6D2D2', '#D2E4E6'][i % 6]}">${['🎁', '🌲', '🍃', '🌙', '☁️', '🧵'][i % 6]}</span>`,
    ).join('');
  const body = `
<div class="sub">뽑기 머신 선택 — 종류별 두 행 (가구 / 캐릭터), 선택 칩은 primary 링</div>
<div class="section">가구 뽑기</div>
<div class="row">${chips(6, 1)}</div>
<div class="section">캐릭터 뽑기</div>
<div class="row">${chips(1, -1)}</div>`;
  const css = `
  .row { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0; }
  .chip { width: 56px; height: 56px; border-radius: 16px; border: 2px solid transparent;
    display: inline-flex; align-items: center; justify-content: center; font-size: 24px; flex: none; }
  .chip.on { border-color: ${t.primary}; }`;
  out('patterns/gacha-selector.html', page('Patterns', 'Gacha machine selector', body, css));
}

/* ---------- proposals (코드에 아직 없는 후보안 — 채택되면 ui/로 구현) ---------- */

/* icon buttons */
{
  const b = (cls, inner, style2 = '') =>
    `<span class="ib ${cls}" style="${style2}">${inner}</span>`;
  const body = `
<div class="sub">아이콘 버튼 변형 — 현재 앱은 surfaceMuted 원형 1종만 사용. 위계별 3변형 제안</div>
<div class="section">Filled · Tonal · Ghost (40px)</div>
<div class="rowset">
  ${b('f', '＋')}${b('t', '🔍')}${b('g', '⋯')}
  ${b('t', '👥')}${b('t', '🔔')}${b('d', '🗑')}
</div>
<div class="section">Small (32px) — 카드 안 인라인 액션</div>
<div class="rowset">
  ${b('f sm', '＋')}${b('t sm', '✏️')}${b('g sm', '⋯')}
</div>
<div class="section">뱃지 달림 (알림)</div>
<div class="rowset"><span style="position:relative">${b('t', '🔔')}<span class="dot"></span></span></div>`;
  const css = `
  .rowset { display: flex; gap: 12px; align-items: center; }
  .ib { width: 40px; height: 40px; border-radius: 999px; display: inline-flex; align-items: center;
    justify-content: center; font-size: 16px; }
  .ib.sm { width: 32px; height: 32px; font-size: 13px; }
  .ib.f { background: ${t.primary}; color: ${t.onPrimary}; }
  .ib.t { background: ${t.surfaceMuted}; color: ${t.text}; }
  .ib.g { background: transparent; border: 1px solid ${t.border}; color: ${t.textMuted}; }
  .ib.d { background: ${t.danger}22; color: ${t.danger}; }
  .dot { position: absolute; top: 2px; right: 2px; width: 8px; height: 8px; border-radius: 4px;
    background: ${t.danger}; border: 2px solid ${t.screen}; }`;
  out(
    'proposals/icon-buttons.html',
    page('Proposals', 'Icon buttons — filled/tonal/ghost', body, css),
  );
}

/* progress ring */
{
  const ring = (pct, size, label, sub) => `
  <div class="ringwrap">
    <div class="ring" style="width:${size}px;height:${size}px;background:conic-gradient(${t.primary} 0 ${pct}%, ${t.border} ${pct}% 100%)">
      <div class="hole" style="width:${size - 16}px;height:${size - 16}px"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</div>
    </div>
  </div>`;
  const body = `
<div class="sub">미션·스트릭 진행률 링 — RN에선 react-native-svg Circle strokeDasharray로 구현</div>
<div class="section">Sizes & states</div>
<div class="rowset">
  ${ring(0, 72, '0%', '이번 주')}
  ${ring(65, 72, '65%', '이번 주')}
  ${ring(100, 72, '✓', '달성')}
  ${ring(40, 48, '2/5', '')}
</div>
<div class="section">스탯 카드 결합 (집 화면 요약과 합성 가능)</div>
<div class="card2">
  ${ring(65, 64, '65%', '')}
  <div><b style="font-size:14px">우리 집 미션 진행률</b><div style="font-size:11px;color:${t.textMuted};margin-top:2px">2개 진행 중 · 오늘 기여 1/2</div></div>
</div>`;
  const css = `
  .rowset { display: flex; gap: 16px; align-items: center; }
  .ring { border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .hole { border-radius: 50%; background: ${t.surface}; display: flex; flex-direction: column;
    align-items: center; justify-content: center; }
  .hole b { font-size: 14px; } .hole span { font-size: 8px; color: ${t.textMuted}; }
  .card2 { display: flex; gap: 14px; align-items: center; background: ${t.surface};
    border: 1px solid ${t.border}; border-radius: 16px; padding: 14px; max-width: 320px; margin-top: 8px; }`;
  out('proposals/progress-ring.html', page('Proposals', 'Progress ring', body, css));
}

/* stepper */
{
  const body = `
<div class="sub">수치 입력 스테퍼 — 미션 목표 수치(1~1000)·집 정원처럼 키보드가 과한 입력용</div>
<div class="section">Default</div>
<div class="stepper"><button>−</button><b>10</b><button class="p">＋</button></div>
<div class="section">한계값 (min에서 − 비활성)</div>
<div class="stepper"><button class="dis">−</button><b>1</b><button class="p">＋</button></div>
<div class="section">라벨 결합</div>
<div class="fieldrow"><span class="lab">목표 수치</span><div class="stepper sm"><button>−</button><b>20</b><button class="p">＋</button></div></div>`;
  const css = `
  .stepper { display: inline-flex; align-items: center; gap: 2px; background: ${t.surfaceMuted};
    border-radius: 999px; padding: 4px; }
  .stepper button { width: 34px; height: 34px; border-radius: 999px; border: 0; font-size: 16px;
    background: ${t.surface}; color: ${t.text}; font-family: inherit; }
  .stepper button.p { background: ${t.primary}; color: ${t.onPrimary}; }
  .stepper button.dis { color: ${t.textDisabled}; }
  .stepper b { min-width: 48px; text-align: center; font-size: 15px; font-variant-numeric: tabular-nums; }
  .stepper.sm button { width: 28px; height: 28px; font-size: 13px; }
  .stepper.sm b { min-width: 38px; font-size: 13px; }
  .fieldrow { display: flex; align-items: center; gap: 12px; }
  .lab { font-size: 12px; color: ${t.textMuted}; font-weight: 600; }`;
  out('proposals/stepper.html', page('Proposals', 'Stepper — 수치 입력', body, css));
}

/* segmented control */
{
  const seg = (items, active, grow = false) => `
  <div class="seg${grow ? ' grow' : ''}">${items.map((x, i) => `<span class="${i === active ? 'on' : ''}">${x}</span>`).join('')}</div>`;
  const body = `
<div class="sub">세그먼트 컨트롤 — 미션 유형·공개/비공개처럼 2~3택 라디오를 통일 (현재는 화면마다 개별 스타일)</div>
<div class="section">2분할</div>
${seg(['공개', '비공개'], 0)}
<div class="section">아이콘 결합 (미션 유형)</div>
${seg(['☀️ 일일 달성률', '📅 주간 달성 횟수'], 1, true)}
<div class="section">3분할</div>
${seg(['전체', '루틴', '투두'], 0, true)}`;
  const css = `
  .seg { display: inline-flex; background: ${t.surfaceMuted}; border-radius: 999px; padding: 3px;
    gap: 2px; margin-bottom: 4px; }
  .seg.grow { display: flex; max-width: 340px; }
  .seg.grow span { flex: 1; text-align: center; }
  .seg span { padding: 7px 16px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
    color: ${t.textMuted}; }
  .seg span.on { background: ${t.surface}; color: ${t.primaryText};
    box-shadow: 0 1px 3px rgba(74,64,58,.15); }`;
  out('proposals/segmented-control.html', page('Proposals', 'Segmented control', body, css));
}

console.log('done');
