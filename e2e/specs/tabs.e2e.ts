import sharedEndpoints from '../../src/config/shared-endpoints.json';
import { expect, test } from '../support/app';

// 집의 채팅 버튼은 보이는 글자가 '채팅'이고 접근성 이름이 '집 채팅'이다.
const LANDMARKS = [
  { tab: 'myRoom', name: '방 꾸미기', role: 'button' },
  { tab: 'calendar', name: '2026년 11월', role: 'text' },
  { tab: 'house', name: '집 채팅', role: 'button' },
  { tab: 'feed', name: '내 글', role: 'text' },
  { tab: 'myPage', name: '프로필 편집', role: 'text' },
] as const;

for (const { tab, name, role } of LANDMARKS) {
  test(`${tab} 탭이 고정 응답만으로 그려진다`, async ({ app, page }) => {
    await app.open({ tab });
    await app.dismissModals();
    const target =
      role === 'button'
        ? page.getByRole('button', { name, exact: true })
        : page.getByText(name, { exact: true });
    await expect(target.first()).toBeVisible();
  });
}

test('오늘 출석이 가능하면 출석 모달이 자동으로 뜬다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  await expect(page.getByRole('button', { name: '출석하기' })).toBeVisible();
});

test('고정 응답이 없는 요청은 테스트를 실패시킨다', async ({ page }) => {
  const { mockApi } = await import('../support/api-mock');
  const unmocked = await mockApi(page);
  await page.goto('/');
  // 앱과 같은 API 호스트로 보내야 가로채기에 걸린다 — 실제 서버에는 닿지 않는다.
  await page.evaluate(
    (base) => fetch(`${base}/__no_such_endpoint__`).catch(() => undefined),
    sharedEndpoints.apiBase,
  );
  expect(unmocked).toContain('GET /__no_such_endpoint__');
});
