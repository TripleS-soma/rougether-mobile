import { createContext, type Ref, useContext, useMemo } from 'react';
import { Platform, ScrollView, type ScrollViewProps } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';

/** Descendant vertical scrolls wait for the pager's direction decision. */
export const PagerGestureContext = createContext<PanGesture | undefined>(undefined);

export function usePagerNativeGesture() {
  const pager = useContext(PagerGestureContext);
  return useMemo(() => {
    const native = Gesture.Native();
    return pager ? native.requireExternalGestureToFail(pager) : native;
  }, [pager]);
}

/** Keep ScrollView's ref/props while joining the surrounding tab pager on native. */
export function PagerScrollView({ ref, ...props }: ScrollViewProps & { ref?: Ref<ScrollView> }) {
  const pager = useContext(PagerGestureContext);
  const native = usePagerNativeGesture();
  const scroll = <ScrollView ref={ref} {...props} />;
  return pager && Platform.OS !== 'web' ? (
    <GestureDetector gesture={native}>{scroll}</GestureDetector>
  ) : (
    scroll
  );
}
