import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppleMark, GoogleMark, KakaoMark } from '@/components/ui/brand-marks';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useResolvedScheme, useTokens } from '@/hooks/use-tokens';

export type SocialProvider = 'kakao' | 'google' | 'apple';

export type SocialLoginButtonProps = {
  provider: SocialProvider;
  onPress?: () => void;
  disabled?: boolean;
};

/** Container diameter. Comfortably above the 44pt minimum touch target. */
const CIRCLE = 56;
/** Mark sits at ~45% of the container, matching each vendor's clear-space ratio. */
const MARK = 25;

const LABELS: Record<SocialProvider, string> = {
  kakao: '카카오',
  google: '구글',
  apple: '애플',
};

/**
 * One 간편 로그인 provider, rendered as the vendor's own icon-only ("심볼형" /
 * logo-only) button. Every container rule below is dictated by the provider's
 * branding guideline, not by our theme — see `brand-marks.tsx`:
 *
 * - 카카오: container #FEE500, symbol 검정 85% (카카오 로그인 디자인 가이드).
 * - Google: white container with a #747775 stroke; the stroke is what keeps the
 *   white button legible on light surfaces, so it is required, not decorative.
 * - Apple: solid black logo-only button, but Apple forbids the black style on
 *   dark backgrounds — so in dark mode we flip to the white style with a black
 *   logo, which is the sanctioned alternative.
 *
 * The caption under each circle stays in our own type/token system; only the
 * button itself is vendor-controlled.
 */
export function SocialLoginButton({ provider, onPress, disabled }: SocialLoginButtonProps) {
  const t = useTokens();
  const emph = useFontEmphasis();
  const isDark = useResolvedScheme() === 'dark';
  const label = LABELS[provider];
  // Apple's white style on dark backgrounds; black everywhere else.
  const appleOnLight = !isDark;

  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={`${label}로 시작`}>
      {({ pressed }) => (
        <>
          <View
            testID={`social-circle-${provider}`}
            style={[
              styles.circle,
              provider === 'kakao' && styles.kakao,
              provider === 'google' && styles.google,
              provider === 'apple' && (appleOnLight ? styles.appleDark : styles.appleLight),
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}>
            {provider === 'kakao' ? <KakaoMark size={MARK} /> : null}
            {provider === 'google' ? <GoogleMark size={MARK} /> : null}
            {provider === 'apple' ? (
              <AppleMark size={MARK} color={appleOnLight ? '#FFFFFF' : '#000000'} />
            ) : null}
          </View>
          <Text style={[styles.caption, emph('medium'), { color: t.textMuted }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Brand containers — vendor-fixed colors, intentionally not theme tokens.
  kakao: {
    backgroundColor: '#FEE500',
  },
  google: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#747775',
  },
  appleDark: {
    backgroundColor: '#000000',
  },
  appleLight: {
    backgroundColor: '#FFFFFF',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  caption: {
    fontSize: 12,
  },
});
