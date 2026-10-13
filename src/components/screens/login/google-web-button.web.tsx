import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { GoogleWebButtonProps } from '@/components/screens/login/google-web-button';
import { OAuthBrand, Radius, Spacing } from '@/constants/theme';
import { useLatestRef } from '@/hooks/use-stable-value';
import { useFontEmphasis, useResolvedScheme } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { mountGoogleButton, onGoogleCredential } from '@/lib/google-auth.web';

/**
 * 웹 구글 로그인 버튼 (#1532) — GIS 공식 버튼을 이 자리에 그대로 그린다.
 *
 * 예전엔 공식 버튼을 화면 밖에 숨기고 우리 버튼에서 JS로 눌렀는데, GIS가 버튼을
 * 구글 도메인 iframe 안에 그리도록 바뀌어 그 클릭이 막혔다. 공식 버튼은 사용자가
 * 직접 눌러야 하므로 보이게 두고, 받은 credential로 화면의 로그인 흐름을 연다.
 * 폭은 자리 폭에 맞추고(GIS 200~400px) 다크 모드면 검은 테마를 쓴다.
 */
export function GoogleWebButton({ recent, onCredential, fallback }: GoogleWebButtonProps) {
  const tr = useT();
  const emph = useFontEmphasis();
  const scheme = useResolvedScheme();
  // 버튼 문구 언어 — 앱 언어를 따른다(언어가 바뀌면 다시 그린다).
  const locale = useTranslation().i18n.language;
  const host = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  const onCredentialRef = useLatestRef(onCredential);

  useEffect(() => onGoogleCredential(() => onCredentialRef.current()), [onCredentialRef]);

  useEffect(() => {
    // RN Web에서 View의 ref는 실제 DOM 요소다.
    const node = host.current as unknown as HTMLElement | null;
    if (!node || width === 0) return;
    let active = true;
    mountGoogleButton(node, {
      width,
      theme: scheme === 'dark' ? 'filled_black' : 'outline',
      locale,
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [width, scheme, locale]);

  if (failed) return <>{fallback}</>;
  const badgeColor = scheme === 'dark' ? OAuthBrand.apple.fg : OAuthBrand.google.fg;
  return (
    <View
      style={styles.frame}
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      <View ref={host} style={styles.host} />
      {recent ? (
        <View
          pointerEvents="none"
          style={[styles.badge, { backgroundColor: `${badgeColor}1A` }]}
          testID="google-recent-badge">
          <Text style={[styles.badgeText, emph('semibold'), { color: badgeColor }]}>
            {tr('member.login.recentBadge')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  host: {
    // GIS large 버튼 높이(40px).
    minHeight: Spacing.five + Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontSize: 13,
  },
});
