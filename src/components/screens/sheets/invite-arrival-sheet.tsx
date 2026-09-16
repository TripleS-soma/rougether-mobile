import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type InvitePreview, inviterLabel } from '@/components/screens/invite-friends-screen';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type InviteArrivalSheetProps = {
  visible: boolean;
  /** 미리보기 결과 — 없으면 아무것도 그리지 않는다. */
  preview: InvitePreview | null;
  /** 받기 요청 중 — 버튼을 잠그고 끌어내리기도 막는다. */
  busy?: boolean;
  /** 코인 받기 — 이때 처음으로 redeem한다. */
  onAccept?: () => void;
  /** 나중에·백드롭 — 코드는 친구 초대 화면 입력란에 남는다. */
  onLater?: () => void;
};

/**
 * 링크·붙여넣기로 들어온 친구 초대 확인 (#1007). 초대코드는 계정당 평생 1회라
 * 잘못 잡힌 코드를 자동으로 쓰면 되돌릴 수 없다 — 누구의 초대인지 보여 주고
 * 사용자가 [받기]를 눌렀을 때만 쓴다(서버 #343의 자동 redeem 금지 계약).
 */
export function InviteArrivalSheet({
  visible,
  preview,
  busy = false,
  onAccept,
  onLater,
}: InviteArrivalSheetProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const coin = preview?.rewardCoin ?? 0;
  return (
    <BottomSheet
      visible={visible && preview != null}
      onClose={busy ? undefined : onLater}
      dragEnabled={!busy}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <View style={[styles.handle, { backgroundColor: t.border }]} />
      <Text style={[Typography.h2, { color: t.text }]}>
        {tr('house.inviteArrival.title', { inviter: inviterLabel(preview?.inviterNickname) })}
      </Text>
      <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>
        {tr('house.inviteArrival.body', { n: coin })}
      </Text>
      <View style={styles.btns}>
        <Pressable
          onPress={onLater}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={tr('house.inviteArrival.laterA11y')}
          style={[styles.btn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[Typography.label, { color: t.text }]}>
            {tr('house.inviteArrival.later')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={tr('house.inviteArrival.acceptA11y')}
          accessibilityState={{ disabled: busy }}
          style={[styles.btn, { backgroundColor: busy ? t.disabledBg : t.primary }]}>
          <Text style={[Typography.label, { color: busy ? t.textMuted : t.onPrimary }]}>
            {busy
              ? tr('house.inviteArrival.accepting')
              : tr('house.inviteArrival.accept', { n: coin })}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    marginBottom: Spacing.one,
  },
  body: {
    lineHeight: 24,
  },
  btns: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  btn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
