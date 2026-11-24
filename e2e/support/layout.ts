import { errors, type Locator, type Page } from '@playwright/test';

import type { Rect } from '../devices';
import { expect, test } from './app';

/** 위치·크기를 다시 재기까지의 간격과, 멎기를 기다리는 한도. */
const SETTLE_INTERVAL_MS = 100;
const SETTLE_TIMEOUT_MS = 2_000;
/** 규칙 4의 폭 허용 오차(px). */
const WIDTH_SLACK_PX = 2;

const deviceName = () => test.info().project.name;
const fmt = (n: number, digits = 1) => n.toFixed(digits);
const fmtRect = (r: Rect) => `(${fmt(r.x)},${fmt(r.y)} ${fmt(r.width)}×${fmt(r.height)})`;
const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 연속 두 번 같은 값이 나올 때까지 기다린 뒤의 위치·크기. 2초 안에 안 멎으면 던진다. */
export async function stableRect(target: Locator): Promise<Rect> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let prev: Rect | null = null;
  for (;;) {
    // boundingBox는 요소가 생길 때까지 테스트 한도(30초)만큼 기다린다 — 남은 시간으로 끊는다.
    // 여러 요소에 맞는 경우(strict mode) 같은 다른 오류는 그대로 던진다.
    const box = await target
      .boundingBox({ timeout: Math.max(deadline - Date.now(), 1) })
      .catch((e: unknown) => {
        if (e instanceof errors.TimeoutError) return null;
        throw e;
      });
    if (box && prev && sameRect(prev, box)) return box;
    if (Date.now() > deadline) {
      throw new Error(
        box
          ? `${target} 위치가 ${SETTLE_TIMEOUT_MS}ms 안에 멎지 않는다 — 마지막 ${fmtRect(box)}, 직전 ${prev ? fmtRect(prev) : '없음'} (${deviceName()})`
          : `${target} 위치를 잴 수 없다 — ${SETTLE_TIMEOUT_MS}ms 안에 화면에 나타나지 않는다 (${deviceName()})`,
      );
    }
    prev = box;
    await sleep(SETTLE_INTERVAL_MS);
  }
}

/**
 * 규칙 도우미가 받는 대상 — 요소(여기서 잰다) 또는 이미 잰 위치·크기.
 * 실패 예상 테스트는 `test.fail()` 앞에서 재고 잰 값을 넘긴다 — 재기 실패가 예상 실패에 묻히지 않게.
 */
type Target = Locator | Rect;
const isRect = (t: Target): t is Rect => !('boundingBox' in t);
const measure = (t: Target) => (isRect(t) ? t : stableRect(t));
const label = (t: Target) => (isRect(t) ? '잰 영역' : String(t));

/** 규칙 1: target이 zones 어느 것과도 겹치지 않는다. */
export async function expectClearOf(target: Target, zones: Rect[]): Promise<void> {
  const rect = await measure(target);
  // 넓이가 있는 겹침만 센다 — 모서리가 맞닿는 건 겹침이 아니다.
  const overlapping = zones.filter(
    (z) =>
      Math.min(rect.x + rect.width, z.x + z.width) - Math.max(rect.x, z.x) > 0 &&
      Math.min(rect.y + rect.height, z.y + z.height) - Math.max(rect.y, z.y) > 0,
  );
  expect(
    overlapping,
    `${label(target)} ${fmtRect(rect)}가 시스템 영역 ${overlapping.map(fmtRect).join(', ')}과 겹친다, 기대 겹침 없음 (${deviceName()})`,
  ).toEqual([]);
}

/** 규칙 2·5: target 전체가 뷰포트 안에 있고, bottomInset(탭 바 높이)만큼 아래는 제외한다. */
export async function expectInFirstScreen(
  page: Page,
  target: Target,
  bottomInset = 0,
): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error(`뷰포트 크기를 알 수 없다 (${deviceName()})`);
  const rect = await measure(target);
  const bottomLimit = viewport.height - bottomInset;
  const inside =
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= viewport.width &&
    rect.y + rect.height <= bottomLimit;
  expect(
    inside,
    `${label(target)} ${fmtRect(rect)}, 기대 x 0~${fmt(viewport.width)} · y 0~${fmt(bottomLimit)} 안 (뷰포트 ${viewport.width}×${viewport.height}, 아래 ${fmt(bottomInset)} 제외) (${deviceName()})`,
  ).toBe(true);
}

/** 규칙 3: 폭/높이가 ratio와 tolerance(기본 0.01) 안에서 같다. */
export async function expectAspectRatio(
  target: Target,
  ratio: number,
  tolerance = 0.01,
): Promise<void> {
  const rect = await measure(target);
  const actual = rect.width / rect.height;
  expect(
    Math.abs(actual - ratio) <= tolerance,
    `${label(target)} 비율 ${fmt(actual, 3)} ${fmtRect(rect)}, 기대 ${fmt(ratio, 3)}±${tolerance} (${deviceName()})`,
  ).toBe(true);
}

/**
 * 규칙 4: panes가 왼쪽부터 나란히 있고, 합친 폭이 배치 폭과 2px 안에서 같다.
 * `width`는 배치에 쓸 수 있는 폭 — 가로 안전 영역이 있는 기기는 그만큼 뺀 값을 넘긴다(기본 뷰포트 폭).
 */
export async function expectFillsWidth(page: Page, panes: Target[], width?: number): Promise<void> {
  const size = page.viewportSize();
  if (!size) throw new Error(`뷰포트 크기를 알 수 없다 (${deviceName()})`);
  const viewport = { width: width ?? size.width };
  const rects: Rect[] = [];
  for (const pane of panes) rects.push(await measure(pane));
  // 앞 칸의 오른쪽 끝(첫 칸은 화면 왼쪽 끝)에서 다음 칸이 시작해야 한다.
  let edge = 0;
  rects.forEach((r, i) => {
    expect(
      Math.abs(r.x - edge) <= WIDTH_SLACK_PX,
      `${label(panes[i])} 시작 x ${fmt(r.x)}, 기대 ${fmt(edge)}±${WIDTH_SLACK_PX} (${deviceName()})`,
    ).toBe(true);
    edge = r.x + r.width;
  });
  const total = rects.reduce((sum, r) => sum + r.width, 0);
  expect(
    Math.abs(total - viewport.width) <= WIDTH_SLACK_PX,
    `칸 폭 합 ${fmt(total)} [${rects.map((r) => fmt(r.width)).join(' + ')}], 기대 ${viewport.width}±${WIDTH_SLACK_PX} (${deviceName()})`,
  ).toBe(true);
}

/** 규칙 6: 문서의 scrollWidth가 뷰포트 폭을 넘지 않는다. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewportWidth: window.innerWidth,
  }));
  expect(
    scrollWidth,
    `문서 scrollWidth ${scrollWidth}, 기대 뷰포트 폭 ${viewportWidth} 이하 (${deviceName()})`,
  ).toBeLessThanOrEqual(viewportWidth);
}
