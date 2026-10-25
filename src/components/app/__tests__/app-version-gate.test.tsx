import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppVersionGate } from '@/components/app/app-version-gate';
import { useAppVersionGate } from '@/hooks/use-app-version-gate';

jest.mock('@/hooks/use-app-version-gate', () => ({ useAppVersionGate: jest.fn() }));
const gateMock = useAppVersionGate as jest.MockedFunction<typeof useAppVersionGate>;

function setVerdict(level: 'ok' | 'recommended' | 'blocked') {
  gateMock.mockReturnValue({
    verdict: { level, latestVersion: '1.5.4' },
    later: jest.fn(),
    openStore: jest.fn(),
  });
}

const child = <Text>앱 화면</Text>;

describe('AppVersionGate', () => {
  it('통과 판정이면 아무것도 덮지 않는다', async () => {
    setVerdict('ok');
    const { getByText, queryByText } = await render(<AppVersionGate>{child}</AppVersionGate>);
    expect(getByText('앱 화면')).toBeTruthy();
    expect(queryByText('업데이트가 필요해요')).toBeNull();
    expect(queryByText('새 버전이 나왔어요')).toBeNull();
  });

  it('권장 판정이면 시트만 띄운다', async () => {
    setVerdict('recommended');
    const { getByText, queryByText } = await render(<AppVersionGate>{child}</AppVersionGate>);
    expect(getByText('앱 화면')).toBeTruthy();
    expect(getByText('새 버전이 나왔어요')).toBeTruthy();
    expect(queryByText('업데이트가 필요해요')).toBeNull();
  });

  /**
   * 이 PR의 핵심 설계 — 막을 때도 자식을 치우지 않는다. 치우면 라우터 컨텍스트가
   * 끊기고, 판정이 늦게 오는 순간 앱 트리가 전부 다시 마운트된다. 누군가 조건부
   * 렌더링으로 바꾸면 여기서 잡힌다.
   *
   * 동시에 막는 동안 아래 트리는 **접근성 트리에서만** 걷어 낸다 — 덮기만 하면
   * 터치는 막히지만 VoiceOver·TalkBack 포커스는 아래 화면으로 계속 들어간다.
   * 그래서 기본 쿼리로는 안 잡히고 `includeHiddenElements`로만 잡혀야 한다.
   */
  it('막는 판정에서도 자식은 마운트된 채, 스크린리더에서만 걷힌다', async () => {
    setVerdict('blocked');
    const { getByText, queryByText } = await render(<AppVersionGate>{child}</AppVersionGate>);
    expect(getByText('업데이트가 필요해요')).toBeTruthy();
    // 접근성 트리에서 걷혔다 — 기본 쿼리는 숨은 요소를 제외한다.
    expect(queryByText('앱 화면')).toBeNull();
    // 그래도 마운트는 유지된다.
    expect(queryByText('앱 화면', { includeHiddenElements: true })).toBeTruthy();
  });
});
