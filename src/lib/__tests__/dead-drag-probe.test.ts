import { track } from '@/lib/analytics';
import {
  __resetDeadDragProbeForTests,
  DEAD_DRAG_MAX_DURATION_MS,
  DEAD_DRAG_SESSION_CAP,
  deadDragTouchCancel,
  deadDragTouchEnd,
  deadDragTouchStart,
  dragAxis,
  noteHouseTouch,
  registerGestureReader,
} from '@/lib/dead-drag-probe';
import { __resetDiagnosticsForTests, formatDiagnostics } from '@/lib/diagnostics-log';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const drag = (to: { x: number; y: number }, ms = 300, screen = 'house') => {
  deadDragTouchStart({ x: 100, y: 400, screen, now: 1000 });
  return deadDragTouchEnd({ ...to, screen, now: 1000 + ms });
};

beforeEach(() => {
  __resetDeadDragProbeForTests();
  __resetDiagnosticsForTests();
  jest.mocked(track).mockClear();
});

describe('dragAxis', () => {
  it('한 축이 우세하고 충분히 움직였을 때만 드래그로 본다', () => {
    expect(dragAxis(80, 10)).toBe('x');
    expect(dragAxis(-80, 10)).toBe('x');
    expect(dragAxis(10, -90)).toBe('y');
    expect(dragAxis(40, 0)).toBeNull();
    expect(dragAxis(80, 70)).toBeNull();
  });
});

describe('dead-drag-probe', () => {
  it('드래그했는데 페이저·스크롤이 제자리면 상태를 남긴다', () => {
    registerGestureReader('pager', () => ({ state: 'i2 sw1 lk0 tx-786', motion: '2:-786' }));
    registerGestureReader('house', () => ({ state: 'drag0 zoom0 y0', motion: '0' }));
    registerGestureReader('layers', () => ({ state: 'tabs:on a:off-empty b:off-empty' }));
    deadDragTouchStart({ x: 100, y: 400, screen: 'house', now: 1000 });
    noteHouseTouch();
    expect(deadDragTouchEnd({ x: 220, y: 410, screen: 'house', now: 1300 })).toBe(true);
    expect(track).toHaveBeenCalledWith('house_dead_drag', {
      axis: 'x',
      dx: 120,
      dy: 10,
      ms: 300,
      house_touch: true,
      pager: 'i2 sw1 lk0 tx-786',
      house: 'drag0 zoom0 y0',
      layers: 'tabs:on a:off-empty b:off-empty',
    });
    expect(formatDiagnostics({ budget: 1000, header: 'h', now: 1300 })).toContain(
      'gesture dead-drag x dx=120 dy=10 300ms houseTouch=1 pager[i2 sw1 lk0 tx-786]',
    );
  });

  it('집 화면이 터치를 못 받았으면 그렇게 남긴다 — 위에서 가로챈 경우', () => {
    expect(drag({ x: 100, y: 250 })).toBe(true);
    expect(track).toHaveBeenCalledWith(
      'house_dead_drag',
      expect.objectContaining({ axis: 'y', house_touch: false, pager: 'none' }),
    );
  });

  it('페이저나 스크롤이 움직였으면 정상 드래그다', () => {
    let tx = -786;
    registerGestureReader('pager', () => ({ state: 'i2', motion: `2:${tx}` }));
    deadDragTouchStart({ x: 100, y: 400, screen: 'house', now: 1000 });
    tx = -700;
    expect(deadDragTouchEnd({ x: 220, y: 400, screen: 'house', now: 1300 })).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('탭·길게 누르기·취소된 터치·다른 화면은 보지 않는다', () => {
    expect(drag({ x: 110, y: 405 })).toBe(false);
    expect(drag({ x: 220, y: 400 }, DEAD_DRAG_MAX_DURATION_MS + 1)).toBe(false);
    expect(drag({ x: 220, y: 400 }, 300, 'myRoom')).toBe(false);
    deadDragTouchStart({ x: 100, y: 400, screen: 'house', now: 1000 });
    deadDragTouchCancel();
    expect(deadDragTouchEnd({ x: 220, y: 400, screen: 'house', now: 1300 })).toBe(false);
    // 집에서 시작했어도 끝날 때 화면이 바뀌었으면 전환 중 터치다.
    deadDragTouchStart({ x: 100, y: 400, screen: 'house', now: 1000 });
    expect(deadDragTouchEnd({ x: 220, y: 400, screen: 'friendRoom', now: 1300 })).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('앱 실행당 정해진 횟수까지만 남긴다', () => {
    for (let i = 0; i < DEAD_DRAG_SESSION_CAP + 3; i += 1) drag({ x: 220, y: 400 });
    expect(track).toHaveBeenCalledTimes(DEAD_DRAG_SESSION_CAP);
  });

  it('상태를 읽다 터져도 판정을 막지 않고, 해제한 리더는 읽지 않는다', () => {
    registerGestureReader('pager', () => {
      throw new Error('boom');
    });
    const off = registerGestureReader('house', () => ({ state: 'drag1' }));
    off();
    expect(drag({ x: 220, y: 400 })).toBe(true);
    expect(track).toHaveBeenCalledWith(
      'house_dead_drag',
      expect.objectContaining({ pager: 'err', house: 'none' }),
    );
  });
});
