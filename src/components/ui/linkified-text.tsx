import { openBrowserAsync } from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { type StyleProp, StyleSheet, Text, type TextStyle } from 'react-native';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useFontEmphasis } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { reportError } from '@/lib/error-reporting';
import { linkHost, splitLinks } from '@/utils/linkify';

export type LinkifiedTextProps = {
  children: string;
  style?: StyleProp<TextStyle>;
  /** 링크 글자색 — 기본은 본문과 같은 색(밑줄로만 구분). 내 말풍선처럼 바탕이 진하면 그대로 둔다. */
  linkColor?: string;
  selectable?: boolean;
  numberOfLines?: number;
  /** 테스트·스토리용 — 기본은 앱 안 브라우저(웹은 새 탭). */
  openLink?: (url: string) => void | Promise<unknown>;
};

/**
 * 본문 속 웹 주소를 누를 수 있게 그리는 글 (#1507) — 채팅 말풍선·피드 글·댓글.
 *
 * 링크는 밑줄로 표시하고, 누르면 "외부 사이트로 이동할까요? (도메인)"를 먼저 묻는다(사용자가
 * 올린 글이라 피싱 주소일 수 있다). 확인하면 앱 안 브라우저(`expo-web-browser`)로 연다. 링크가
 * 없으면 평범한 `Text`와 같다. 길게 눌러 선택·복사(`selectable`)는 그대로 둔다.
 */
export function LinkifiedText({
  children,
  style,
  linkColor,
  selectable,
  numberOfLines,
  openLink = openBrowserAsync,
}: LinkifiedTextProps) {
  const tr = useT();
  const emph = useFontEmphasis();
  const segments = useMemo(() => splitLinks(children), [children]);
  const [pending, setPending] = useState<string | null>(null);

  const confirm = () => {
    const url = pending;
    setPending(null);
    if (!url) return;
    void Promise.resolve(openLink(url)).catch((err: unknown) => reportError(err));
  };

  return (
    <>
      {/* 호출부 스타일이 글꼴을 빠뜨려도 선택 폰트를 따르게 기본 굵기를 먼저 깐다(#382). */}
      <Text style={[emph('normal'), style]} selectable={selectable} numberOfLines={numberOfLines}>
        {segments.map((seg, i) =>
          seg.kind === 'text' ? (
            seg.text
          ) : (
            <Text
              key={i}
              accessibilityRole="link"
              accessibilityLabel={tr('app.link.a11y', { url: seg.text })}
              onPress={() => setPending(seg.url)}
              style={[styles.link, linkColor ? { color: linkColor } : null]}>
              {seg.text}
            </Text>
          ),
        )}
      </Text>
      {pending ? (
        <ConfirmDialog
          visible
          title={tr('app.link.confirmTitle')}
          body={tr('app.link.confirmBody', { host: linkHost(pending) })}
          confirmLabel={tr('app.link.open')}
          cancelLabel={tr('common.cancel')}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  link: { textDecorationLine: 'underline' },
});
