import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { OnlineDot } from '@/components/screens/house/online-dot';
import { PageActiveContext } from '@/hooks/use-page-active';

// 숨은 탭의 반복 연출은 멈춘다 (성능 장부 M7).
describe('PageActiveContext', () => {
  // Animated.loop는 전역 — 다음 테스트에 스파이가 새지 않게.
  afterEach(() => jest.restoreAllMocks());

  it('보이는 페이지의 접속 점만 펄스를 돌린다', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    await render(
      <PageActiveContext.Provider value={false}>
        <OnlineDot color="#7FA87F" />
      </PageActiveContext.Provider>,
    );
    expect(loop).not.toHaveBeenCalled();

    await render(
      <PageActiveContext.Provider value>
        <OnlineDot color="#7FA87F" />
      </PageActiveContext.Provider>,
    );
    expect(loop).toHaveBeenCalledTimes(1);
  });

  it('페이저 밖(기본값)은 항상 보이는 것으로 친다', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    await render(<OnlineDot color="#7FA87F" />);
    expect(loop).toHaveBeenCalledTimes(1);
  });
});
