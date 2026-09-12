import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Loading } from '@/components/ui/loading';
import { Icon } from '@/components/ui/icon';
import { RetryState } from '@/components/ui/retry-state';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { ScreenHeader } from '@/components/ui/screen-header';
import { friendInviteLink } from '@/constants/links';
import { Radius, Spacing } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { shareOrCopy } from '@/lib/share-link';
import { useToast } from '@/components/ui/toast';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
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
  /**
   * 서버가 만든 공유 링크 (#1007) — 서버에 링크 도메인이 설정돼 있을 때만 온다.
   * 없으면 rougether.com 랜딩 링크로 공유한다.
   */
  shareUrl?: string | null;
};

/** 사용 전 미리보기 (#1007, GET /invites/by-code) — 화면·확인 시트가 함께 쓴다. */
export type InvitePreview = {
  /** 정규화한 코드(대문자) — 확정 때 이 값으로 사용한다. */
  code: string;
  /** 초대자 닉네임 — 초대자가 온보딩 전이면 없다. */
  inviterNickname: string | null;
  /** 코드를 쓰면 내가 받는 코인. */
  rewardCoin: number;
  /** 이 계정은 이미 초대 보상을 받았다 — 확인할 것 없이 넘긴다. */
  alreadyRedeemed: boolean;
};

/** 초대자 표시 — 닉네임이 없으면 '친구'. */
export function inviterLabel(nickname: string | null | undefined): string {
  return nickname ? `${nickname}님` : '친구';
}

export type InviteFriendsScreenProps = {
  info?: InviteInfo | null;
  loading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  /** 받은 코드 사용 — 성공 시 보상 코인 액수를 resolve, 실패는 null(토스트는 훅 몫). */
  onRedeem?: (code: string) => Promise<{ rewardCoin: number } | null>;
  /**
   * 사용 전 미리보기 (#1007) — 넘기면 '사용하기'가 곧장 쓰지 않고 초대자를 먼저
   * 보여 준다. 실패는 null(토스트는 훅 몫). 없으면 종전처럼 바로 사용.
   */
  onPreview?: (code: string) => Promise<InvitePreview | null>;
  /** 초대 링크로 진입 (#667) — 받은 코드 입력란에 프리필된다. */
  initialRedeemCode?: string;
  /** 프리필을 반영했을 때 1회 — 부모가 pending 상태를 클리어한다 (#642 패턴). */
  onInitialRedeemCodeConsumed?: () => void;
  onBack?: () => void;
};

/**
 * 친구 초대 화면 (#518) — 내 초대코드(복사)와 보상 현황, 받은 코드 입력·사용.
 * 설정 → 친구 초대에서 진입. Pure/prop-driven — 데이터·액션은 useInvites가 담당.
 *
 * 받은 코드는 사용 전에 초대자를 확인한다 (#1007) — 계정당 평생 1회라 오타로 남의
 * 코드를 쓰면 되돌릴 수 없다.
 */
export function InviteFriendsScreen({
  info,
  loading = false,
  loadError = false,
  onRetry,
  onRedeem,
  onPreview,
  initialRedeemCode,
  onInitialRedeemCodeConsumed,
  onBack,
}: InviteFriendsScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedCoin, setRedeemedCoin] = useState<number | null>(null);
  // 미리보기 확인 단계 (#1007) — 누구의 초대인지 보여 주고 한 번 더 눌러 쓴다.
  const [confirming, setConfirming] = useState<InvitePreview | null>(null);
  const [alreadyRedeemed, setAlreadyRedeemed] = useState(false);
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

  const { show: toast } = useToast();
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
    track('invite_code_copy', { kind: 'friend', how: 'share' });
    // 서버 링크(#1007)가 오면 그걸로 — 설치 전 사용자도 설치 후 코드를 되찾는 랜딩.
    const link = info.shareUrl ?? friendInviteLink(info.code);
    const outcome = await shareOrCopy(
      `루게더에서 함께 루틴 지켜요! 내 초대코드: ${info.code}\n${link}`,
    );
    // 공유 시트가 없는 브라우저는 복사로 대신했으니 알려 준다. 취소는 조용히.
    if (outcome === 'copied') toast('초대 링크를 복사했어요');
  };

  /** 실제 사용 — 성공하면 보상 표시로 바꾼다. */
  const redeemNow = async (value: string): Promise<boolean> => {
    const result = await onRedeem?.(value);
    if (!result) return false;
    setRedeemedCoin(result.rewardCoin);
    setCode('');
    setConfirming(null);
    return true;
  };

  const submitRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed || redeeming || !onRedeem) return;
    setRedeeming(true);
    try {
      if (!onPreview) {
        await redeemNow(trimmed);
        return;
      }
      const preview = await onPreview(trimmed);
      if (!preview) return;
      if (preview.alreadyRedeemed) {
        setAlreadyRedeemed(true);
        return;
      }
      setConfirming(preview);
    } finally {
      setRedeeming(false);
    }
  };

  const confirmRedeem = async () => {
    if (!confirming || redeeming) return;
    setRedeeming(true);
    try {
      // 실패(토스트는 훅 몫)면 입력으로 돌아간다 — 코드는 입력란에 그대로 있다.
      if (!(await redeemNow(confirming.code))) setConfirming(null);
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

      <ScrollView
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}
        keyboardShouldPersistTaps="handled">
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
                {info?.code ?? '-'}
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
              ) : confirming ? (
                <>
                  <Text style={[Typography.body, styles.center, { color: t.text }]}>
                    {inviterLabel(confirming.inviterNickname)}의 초대가 맞나요?
                  </Text>
                  <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
                    코드 {confirming.code} · 사용하면 코인 {confirming.rewardCoin}개를 받아요
                  </Text>
                  <ScalePressable
                    onPress={() => void confirmRedeem()}
                    accessibilityRole="button"
                    accessibilityLabel="초대코드 사용 확정"
                    accessibilityState={{ disabled: redeeming }}
                    style={[
                      styles.redeemBtn,
                      { backgroundColor: redeeming ? t.disabledBg : t.primary },
                    ]}>
                    <Text
                      style={[Typography.label, { color: redeeming ? t.textMuted : t.onPrimary }]}>
                      {redeeming ? '사용하는 중...' : `코인 ${confirming.rewardCoin}개 받기`}
                    </Text>
                  </ScalePressable>
                  <ScalePressable
                    onPress={() => setConfirming(null)}
                    disabled={redeeming}
                    accessibilityRole="button"
                    accessibilityLabel="초대코드 다시 입력"
                    style={styles.textBtn}>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>다시 입력</Text>
                  </ScalePressable>
                </>
              ) : (
                <>
                  <TextInput
                    value={code}
                    onChangeText={(value) => {
                      setCode(value);
                      setAlreadyRedeemed(false);
                    }}
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
                      {redeeming ? '확인 중...' : '사용하기'}
                    </Text>
                  </ScalePressable>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    {alreadyRedeemed
                      ? '이미 초대 보상을 받은 계정이에요.'
                      : '초대코드는 한 번만 사용할 수 있어요.'}
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
  center: {
    textAlign: 'center',
  },
  textBtn: {
    paddingVertical: Spacing.one,
  },
  redeemedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
