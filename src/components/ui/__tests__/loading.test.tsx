import { act, render } from '@testing-library/react-native';

import { Loading } from '@/components/ui/loading';

describe('Loading (#849)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /**
   * 캐시가 warm한 요청은 순식간에 끝난다. 거기에 스피너를 그리면 개선이
   * 아니라 깜빡임이다 — 지연 안에 끝나면 아무것도 안 보여야 한다.
   */
  it('지연 시간 안에는 아무것도 그리지 않는다', async () => {
    const { toJSON } = await render(<Loading />);
    expect(toJSON()).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(200); // 기본 지연(250) 미만
    });
    expect(toJSON()).toBeNull();
  });

  it('지연이 지나면 표시된다', async () => {
    const { toJSON } = await render(<Loading />);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(toJSON()).not.toBeNull();
  });

  it('delayMs=0이면 즉시 표시된다 — 이미 오래 기다린 자리용', async () => {
    const { toJSON } = await render(<Loading delayMs={0} />);
    expect(toJSON()).not.toBeNull();
  });

  /** 지연 중에 빈 상자가 자리를 잡으면 그것도 깜빡임이다. */
  it('지연 중에는 자리도 잡지 않는다 — fill이어도 null', async () => {
    const { toJSON } = await render(<Loading fill />);
    expect(toJSON()).toBeNull();
  });
});
