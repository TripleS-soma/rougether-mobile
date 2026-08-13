import { useFonts } from 'expo-font';

/**
 * Web (dev harness) counterpart of the native config-plugin embed: registers
 * the selectable app fonts (#382) under the same family names the native
 * builds resolve (PostScript names). Non-blocking — text falls back to the
 * system font until loading finishes.
 */
export function useWebFonts(): boolean {
  const [loaded] = useFonts({
    NanumSquareRoundR: require('@/assets/fonts/NanumSquareRoundR.ttf'),
    NanumSquareRoundB: require('@/assets/fonts/NanumSquareRoundB.ttf'),
    NanumSquareRoundEB: require('@/assets/fonts/NanumSquareRoundEB.ttf'),
    'Pretendard-Regular': require('@/assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('@/assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('@/assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('@/assets/fonts/Pretendard-Bold.otf'),
    'Jua-Regular': require('@/assets/fonts/Jua-Regular.ttf'),
    'SUIT-Regular': require('@/assets/fonts/SUIT-Regular.otf'),
    'SUIT-Medium': require('@/assets/fonts/SUIT-Medium.otf'),
    'SUIT-SemiBold': require('@/assets/fonts/SUIT-SemiBold.otf'),
    'SUIT-Bold': require('@/assets/fonts/SUIT-Bold.otf'),
  });
  return loaded;
}
