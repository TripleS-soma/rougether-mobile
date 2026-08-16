import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Loading } from '@/components/ui/loading';
import { Icon } from '@/components/ui/icon';
import { RetryState } from '@/components/ui/retry-state';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { ScreenHeader } from '@/components/ui/screen-header';
import { friendInviteLink } from '@/constants/links';
import { Radius, Spacing } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

export type InviteInfo = {
  code?: string;
  /** 지금까지 내 코드로 보상 받은 친구 수. */
  rewardedCount?: number;
  /** 초대자 보상이 지급되는 상한 인원. */
  maxRewardedCount?: number;
  /** 친구가 내 코드를 쓰면 내가 받는 코인. */
  inviterRewardCoin?: number;
  /** 코드를 쓴 친구가 받는 코인. */
  inviteeRewardCoin?: number;
};

export type InviteFriendsScreenProps = {
  info?: InviteInfo | null;
  loading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  /** 받은 코드 사용 — 성공 시 보상 코인 액수를 resolve, 실패는 null(토스트는 훅 몫). */
  onRedeem?: (code: string) => Promise<{ rewardCoin: number } | null>;
  /** 초대 링크로 진입 (#667) — 받은 코드 입력란에 프리필된다. */
  initialRedeemCode?: string;
  /** 프리필을 반영했을 때 1회 — 부모가 pending 상태를 클리어한다 (#642 패턴). */
  onInitialRedeemCodeConsumed?: () => void;
  onBack?: () => void;
};

/**
 * 친구 초대 화면 (#518) — 내 초대코드(복사)와 보상 현황, 받은 코드 입력·사용.
 * 설정 → 친구 초대에서 진입. Pure/prop-driven — 데이터·액션은 useInvites가 담당.
 */
export function InviteFriendsScreen({
  info,
  loading = false,
  loadError = false,
  onRetry,
  onRedeem,
  initialRedeemCode,
  onInitialRedeemCodeConsumed,
  onBack,
}: InviteFriendsScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedCoin, setRedeemedCoin] = useState<number | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  // 초대 링크 진입 (#667) — 받은 코드 입력란에 프리필하고 부모 pending을 비운다.
  useEffect(() => {
    if (!initialRedeemCode) return;
    setCode(initialRedeemCode);
    onInitialRedeemCodeConsumed?.();
  }, [initialRedeemCode, onInitialRedeemCodeConsumed]);

  const copyCode = async () => {
    if (!info?.code) return;
    try {
      await Clipboard.setStringAsync(info.code);
      // 확산 신호 (#803) — 코드를 손에 쥔 순간. 실제 사용은 invite_redeem이 센다.
      track('invite_code_copy', { kind: 'friend', how: 'clipboard' });
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 실패는 조용히 — 코드는 화면에 그대로 보인다.
    }
  };

  // 링크 공유 (#667) — 집 초대(#624)와 같은 결: 랜딩 경유 https라 메신저에서 눌린다.
  const shareLink = async () => {
    if (!info?.code) return;
    try {
      track('invite_code_copy', { kind: 'friend', how: 'share' });
      await Share.share({
        message: `루게더에서 함께 루틴 지켜요! 내 초대코드: ${info.code}\n${friendInviteLink(info.code)}`,
      });
    } catch {
      // 공유 시트 취소/실패 — 조용히.
    }
  };

  const submitRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed || redeeming || !onRedeem) return;
    setRedeeming(true);
    try {
      const result = await onRedeem(trimmed);
      if (result) {
        setRedeemedCoin(result.rewardCoin);
        setCode('');
      }
    } finally {
      setRedeeming(false);
    }
  };

  const sectionTitle = [
    Typography.supporting,
    emph('semibold'),
    styles.sectionTitle,
    { color: t.textMuted },
  ];

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="친구 초대" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.loadingBlock}>
            <Loading />
          </View>
        ) : loadError ? (
          <View style={styles.loadingBlock}>
            <RetryState message="초대 정보를 불러오지 못했어요." onRetry={onRetry} />
          </View>
        ) : (
          <>
            <Text style={sectionTitle}>내 초대코드</Text>
            <View style={[styles.card, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h1, styles.code, { color: t.text }]}>
                {info?.code ?? '—'}
              </Text>
              <View style={styles.codeActions}>
                <ScalePressable
                  onPress={copyCode}
                  accessibilityRole="button"
                  accessibilityLabel="초대코드 복사"
                  style={[
                    styles.copyBtn,
                    { backgroundColor: copied ? t.surfaceMuted : t.primary },
                  ]}>
                  <Icon
                    name={copied ? 'check' : 'copy'}
                    size={14}
                    color={copied ? t.text : t.onPrimary}
                  />
                  <Text style={[Typography.label, { color: copied ? t.text : t.onPrimary }]}>
                    {copied ? '복사됨' : '복사하기'}
                  </Text>
                </ScalePressable>
                {/* 링크 공유 (#667) — 메신저에서 눌리는 랜딩 경유 링크. */}
                <ScalePressable
                  onPress={() => void shareLink()}
                  accessibilityRole="button"
                  accessibilityLabel="초대 링크 공유"
                  style={[styles.copyBtn, { backgroundColor: t.primary }]}>
                  <Icon name="gift" size={14} color={t.onPrimary} />
                  <Text style={[Typography.label, { color: t.onPrimary }]}>링크 공유</Text>
                </ScalePressable>
              </View>
              <Text style={[Typography.supporting, styles.rewardHint, { color: t.textMuted }]}>
                친구가 이 코드를 입력하면 나는 코인 {info?.inviterRewardCoin ?? 0}개, 친구는 코인{' '}
                {info?.inviteeRewardCoin ?? 0}개를 받아요.
              </Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                지금까지 {info?.rewardedCount ?? 0}
                {info?.maxRewardedCount != null ? ` / ${info.maxRewardedCount}` : ''}명이 내 코드로
                함께하고 있어요.
              </Text>
            </View>

            <Text style={sectionTitle}>받은 코드가 있나요?</Text>
            <View style={[styles.card, { backgroundColor: t.surface }]}>
              {redeemedCoin != null ? (
                <View style={styles.redeemedRow}>
                  <Icon name="coin" size={18} />
                  <Text style={[Typography.body, { color: t.text }]}>
                    코인 {redeemedCoin}개를 받았어요!
                  </Text>
                </View>
              ) : (
                <>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="친구에게 받은 초대코드"
                    placeholderTextColor={t.textDisabled}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel="초대코드 입력"
                    style={[
                      styles.input,
                      // iOS placeholder 자간 이슈 — 값 있을 때만 자간.
                      code.length > 0 && styles.inputSpacing,
                      { backgroundColor: t.surfaceMuted, color: t.text },
                    ]}
                  />
                  <ScalePressable
                    onPress={() => void submitRedeem()}
                    accessibilityRole="button"
                    accessibilityLabel="초대코드 사용"
                    accessibilityState={{ disabled: !code.trim() || redeeming }}
                    style={[
                      styles.redeemBtn,
                      { backgroundColor: code.trim() && !redeeming ? t.primary : t.disabledBg },
                    ]}>
                    <Text
                      style={[
                        Typography.label,
                        { color: code.trim() && !redeeming ? t.onPrimary : t.textMuted },
                      ]}>
                      {redeeming ? '확인 중…' : '사용하기'}
                    </Text>
                  </ScalePressable>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    초대코드는 한 번만 사용할 수 있어요.
                  </Text>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  loadingBlock: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  sectionTitle: {
    marginTop: Spacing.two,
    marginLeft: Spacing.one,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  code: {
    letterSpacing: 4,
  },
  codeActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  rewardHint: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  input: {
    alignSelf: 'stretch',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    textAlign: 'center',
  },
  // iOS placeholder 자간 이슈 — 값이 있을 때만 입력에 얹는다.
  inputSpacing: {
    letterSpacing: 2,
  },
  redeemBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
  },
  redeemedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
