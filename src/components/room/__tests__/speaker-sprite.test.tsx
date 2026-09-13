import { act, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';
import { SpeakerSprite } from '@/components/room/speaker-sprite';

describe('SpeakerSprite', () => {
  afterEach(() => jest.restoreAllMocks());

  it('animates during playback and stops when playback ends', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const start = jest.fn();
    const stop = jest.fn();
    jest.spyOn(Animated, 'loop').mockReturnValue({ start, stop, reset: jest.fn() });
    const view = await render(<SpeakerSprite playing />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(view.getByLabelText('음악이 흐르는 스피커')).toBeTruthy();
    await view.rerender(<SpeakerSprite playing={false} />);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(view.getByLabelText('꺼진 스피커')).toBeTruthy();
  });

  it('respects reduced motion and responds to accessibility changes', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const remove = jest.fn();
    const listener = jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >);
    const start = jest.fn();
    const stop = jest.fn();
    jest.spyOn(Animated, 'loop').mockReturnValue({ start, stop, reset: jest.fn() });
    const view = await render(<SpeakerSprite playing />);
    await act(async () => {});
    expect(start).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith('reduceMotionChanged', expect.any(Function));
    const onChange = listener.mock.calls[0][1] as unknown as (enabled: boolean) => void;
    await act(() => onChange(false));
    expect(start).toHaveBeenCalledTimes(1);
    await act(() => onChange(true));
    expect(stop).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
