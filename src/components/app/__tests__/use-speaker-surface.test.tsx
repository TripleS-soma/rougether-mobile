import { act, renderHook } from '@testing-library/react-native';

import type { Screen } from '@/components/app/navigation';
import { useSpeakerSurface } from '@/components/app/use-speaker-surface';
import { STARTER_SPEAKER_KEY } from '@/resources/speaker';
import { ToastProvider } from '@/components/ui/toast';

const mockSpeaker = {
  playing: false,
  loading: false,
  error: null as string | null,
  trackId: 'rain',
  volume: 0.35,
  play: jest.fn(),
  stop: jest.fn(),
  selectTrack: jest.fn(),
  setVolume: jest.fn(),
};
jest.mock('@/hooks/use-room-speaker', () => ({ useRoomSpeaker: () => mockSpeaker }));

// 방 스피커 (#1325) — 앱 셸에서 옮긴 배선을 직접 고정한다(장부 5번).
const catalogue = { furniture: [{ id: 'sp', assetKey: STARTER_SPEAKER_KEY }] };
const placed = [{ furnitureId: 'sp' }] as never[];

async function setup(props: { screen?: Screen; musicEnabled?: boolean } = {}) {
  const enableSpeakerMusic = jest.fn();
  const view = await renderHook(
    (p: { screen: Screen; musicEnabled: boolean }) =>
      useSpeakerSurface({
        screen: p.screen,
        placedItems: placed,
        catalogue,
        musicEnabled: p.musicEnabled,
        enableSpeakerMusic,
      }),
    {
      initialProps: { screen: props.screen ?? 'myRoom', musicEnabled: props.musicEnabled ?? true },
      wrapper: ToastProvider,
    },
  );
  return { enableSpeakerMusic, ...view };
}

describe('useSpeakerSurface', () => {
  beforeEach(() => jest.clearAllMocks());

  it('탭 재생은 소리 설정의 음악을 켜고 재생한다', async () => {
    const { result, enableSpeakerMusic } = await setup();
    await act(async () => result.current.toggleSpeaker());
    expect(enableSpeakerMusic).toHaveBeenCalled();
    expect(mockSpeaker.play).toHaveBeenCalled();
  });

  it('음악 설정이 꺼지면 멈춘다', async () => {
    await setup({ musicEnabled: false });
    expect(mockSpeaker.stop).toHaveBeenCalled();
  });

  it('나의 방을 떠나면 열린 시트를 닫는다', async () => {
    const { result, rerender } = await setup();
    await act(async () => result.current.openSpeaker());
    expect(result.current.speakerOpen).toBe(true);
    await rerender({ screen: 'house', musicEnabled: true });
    expect(result.current.speakerOpen).toBe(false);
  });
});
