import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type InvitePreview, inviterLabel } from '@/components/screens/invite-friends-screen';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

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
        🎁 {inviterLabel(preview?.inviterNickname)}의 초대로 오셨어요
      </Text>
      <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>
        초대코드를 쓰면 코인 {coin}개를 받아요. 초대코드는 한 번만 쓸 수 있어요.
      </Text>
      <View style={styles.btns}>
        <Pressable
          onPress={onLater}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="초대 나중에 받기"
          style={[styles.btn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[Typography.label, { color: t.text }]}>나중에</Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="초대 코인 받기"
          accessibilityState={{ disabled: busy }}
          style={[styles.btn, { backgroundColor: busy ? t.disabledBg : t.primary }]}>
          <Text style={[Typography.label, { color: busy ? t.textMuted : t.onPrimary }]}>
            {busy ? '받는 중...' : `코인 ${coin}개 받기`}
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
