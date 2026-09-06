import { createContext, type Ref, useContext, useMemo } from 'react';
import { Platform, ScrollView, type ScrollViewProps } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';

/** iOS descendant scrolls wait for the pager's direction decision. */
export const PagerGestureContext = createContext<PanGesture | undefined>(undefined);

export function usePagerNativeGesture(pager: PanGesture | undefined) {
  return useMemo(() => {
    const native = Gesture.Native();
    return pager ? native.requireExternalGestureToFail(pager) : native;
  }, [pager]);
}

/** Keep ScrollView's ref/props while joining the surrounding tab pager on native. */
export function PagerScrollView({ ref, ...props }: ScrollViewProps & { ref?: Ref<ScrollView> }) {
  const pager = useContext(PagerGestureContext);
  const native = usePagerNativeGesture(pager);
  const scroll = <ScrollView ref={ref} {...props} />;
  return pager && Platform.OS === 'ios' ? (
    <GestureDetector gesture={native}>{scroll}</GestureDetector>
  ) : (
    scroll
  );
}
