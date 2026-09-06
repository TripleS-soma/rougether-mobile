import { memo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon, type IconName } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import {
  DEFAULT_FONT_ID,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_MODE,
  FONT_OPTIONS,
  THEME_OPTIONS,
  Radius,
  Spacing,
  displayFaceFor,
  type BrandFontId,
  type ThemeId,
  type ThemeMode,
  typographyFor,
} from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { type ScrollRestoreProps, useScrollRestore } from '@/hooks/use-scroll-restore';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import type { NavTab } from '@/components/ui/bottom-nav';
import { DEFAULT_START_TAB, START_TAB_OPTIONS } from '@/lib/start-tab';

const MODE_OPTIONS: { id: ThemeMode; name: string }[] = [
  { id: 'system', name: '시스템' },
  { id: 'light', name: '라이트' },
  { id: 'dark', name: '다크' },
];

/**
 * 설정 행 오른쪽의 현재 폰트 이름을 그 폰트로 그리는 스타일 (#382). 크기는
 * label 롤에서, 얼굴은 displayFaceFor에서 — 주아 혼합은 제목만 Jua라 label
 * 롤의 얼굴만으로는 무엇이 다른지 안 보인다 (#750).
 */
function fontPreviewStyle(id: BrandFontId) {
  return { ...typographyFor(id).label, ...displayFaceFor(id) };
}

type Row = { icon: IconName; label: string; onPress?: () => void };

export type SettingsScreenProps = ScrollRestoreProps & {
  /** 마이페이지의 서브화면 (#1088) — 헤더 뒤로 가기. 미배선이면 탭 루트처럼 그린다. */
  onBack?: () => void;
  /** 시작 화면 (#1139) — 앱을 열 때 처음 보일 탭. 다음 실행부터 적용. */
  startTab?: NavTab;
  onChangeStartTab?: (tab: NavTab) => void;
  /** Light/dark preference ('system' follows the OS). */
  themeMode?: ThemeMode;
  onChangeThemeMode?: (mode: ThemeMode) => void;
  /** App font choice (#382) — 행 오른쪽 현재값 표시용. */
  /** 현재 브랜드 테마 — 행 오른쪽에 이름·색을 보인다 (#972). */
  themeId?: ThemeId;
  fontId?: BrandFontId;
  /** Opens the 폰트 picker screen (#750). */
  onOpenFont?: () => void;
  /** Opens the 테마 색상 picker screen (#459). */
  onOpenTheme?: () => void;
  /**
   * 비밀번호 변경 (#787) — 서버 인증이 소셜·dev 로그인뿐이라 비밀번호 계정이
   * 없다. 행을 내렸고 셸도 넘기지 않는다. 서버가 비밀번호 인증을 붙이면 기타
   * 섹션 위에 계정 섹션을 되살려 `{ icon: 'lock', label: '비밀번호 변경',
   * onPress: onChangePassword }`를 넣을 것 (화면·Dev 갤러리 엔트리는 그대로).
   * 프로필 편집·친구 초대는 마이페이지로 갔다 (#1088).
   */
  onChangePassword?: () => void;
  onOpenNotifications?: () => void;
  onOpenSound?: () => void;
  onReplayOnboarding?: () => void;
  /** 스토어 요건 — 인앱 약관/개인정보처리방침 링크 (#545). */
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  onLogout?: () => void;
  /**
   * 회원탈퇴 (#547) — 확인 다이얼로그를 통과했을 때만 호출된다. 성공/실패
   * 처리(토스트·화면 전환)는 셸 몫.
   */
  onWithdraw?: () => void;
};

/**
 * Settings screen, ported from the prototype `SettingsScreen`: dark-mode picker
 * + notification / misc rows. 마이페이지의 서브화면 (#1088) — "바꾸는 곳"만
 * 남기고 프로필·친구 초대·주간회고·도움말·버그 제보·캘린더 연동은 마이페이지로
 * 갔다(#1097). 업데이트 카드(#1083)는 뺐다 — OTA는 실행 시 자동 적용 (#1095). Theme tokens + type scale; vector icons
 * via the shared Icon. Each row navigates to its sub-screen via the matching
 * prop. The mode picker is prop-driven (onChangeThemeMode); the app shell wires
 * it to the global BrandThemeProvider. (The 포근/숲/한옥 brand picker was
 * removed with dark mode's arrival — cozy is the single brand theme now.)
 *
 * memo (#539 후속): 탭 페이저(#563)에 상주하던 시절의 경계를 그대로 둔다 —
 * 서브화면이 된 뒤에도 셸이 주는 콜백 prop은 전부 참조 고정.
 */
export const SettingsScreen = memo(function SettingsScreen({
  onBack,
  startTab = DEFAULT_START_TAB,
  onChangeStartTab,
  themeMode = DEFAULT_THEME_MODE,
  onChangeThemeMode,
  themeId = DEFAULT_THEME_ID,
  fontId = DEFAULT_FONT_ID,
  onOpenFont,
  onOpenTheme,
  onOpenNotifications,
  onOpenSound,
  onOpenTerms,
  onOpenPrivacy,
  onReplayOnboarding,
  onLogout,
  onWithdraw,
  getInitialScrollY,
  onScrollY,
}: SettingsScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  // Section captions: supporting size with a semibold face via the active font.
  const sectionTitleStyle = [Typography.supporting, emph('semibold'), styles.sectionTitle];
  // Logging out drops the session immediately, so gate it behind a confirm.
  const [confirmLogout, setConfirmLogout] = useState(false);
  // 회원탈퇴는 복구 불가 — 파괴 확인 다이얼로그 뒤에만 (#547).
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const currentFontName = FONT_OPTIONS.find((o) => o.id === fontId)?.name ?? '';
  const currentTheme = THEME_OPTIONS.find((o) => o.id === themeId);
  // 서브화면(도움말·버그 제보 …)에 다녀와도 보던 자리로 (#763).
  const scrollRef = useRef<ScrollView>(null);
  const scrollRestore = useScrollRestore(scrollRef, { getInitialScrollY, onScrollY });

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: '알림',
      rows: [
        { icon: 'bell', label: '푸시 알림', onPress: onOpenNotifications },
        { icon: 'sound', label: '효과음', onPress: onOpenSound },
      ],
    },
    {
      title: '기타',
      rows: [
        { icon: 'refresh', label: '튜토리얼 다시 보기', onPress: onReplayOnboarding },
        { icon: 'list', label: '이용약관', onPress: onOpenTerms },
        { icon: 'lock', label: '개인정보처리방침', onPress: onOpenPrivacy },
        { icon: 'leave', label: '로그아웃', onPress: () => setConfirmLogout(true) },
      ],
    },
  ];

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.ambient}>
        <View style={[styles.ambientPrimary, { backgroundColor: t.primarySoft }]} />
        <View style={[styles.ambientWarm, { backgroundColor: t.warningSoft }]} />
      </View>
      <ScreenHeader title="설정" onBack={onBack} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        // 넓은 화면에서 행이 끝까지 늘어나면 화살표가 라벨에서 멀어져 한 줄로
        // 안 읽힌다 (#725).
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
          // 서브화면(#1088)이라 바텀바가 없다 — 바텀바 인셋 대신 고정 여백(리뷰 반영).
          { paddingBottom: Spacing.six },
        ]}
        {...scrollRestore}>
        <View style={styles.section}>
          <Text style={[...sectionTitleStyle, { color: t.textMuted }]}>디자인</Text>
          <GlassSurface
            fallbackColor={t.surface}
            interactive={false}
            style={styles.card}
            testID="settings-design-glass">
            <View style={styles.designHead}>
              <View style={[styles.iconCircle, { backgroundColor: t.primarySoft }]}>
                <Icon name="moon" size={20} color={t.primaryText} />
              </View>
              <View style={styles.flex}>
                <Text style={[Typography.label, { color: t.text }]}>다크 모드</Text>
              </View>
            </View>
            <View style={[styles.modeRow, { backgroundColor: t.surfaceMuted }]}>
              {MODE_OPTIONS.map((opt) => {
                const selected = opt.id === themeMode;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => onChangeThemeMode?.(opt.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    aria-checked={selected}
                    accessibilityLabel={opt.name}
                    style={styles.modeOption}>
                    {selected ? (
                      <GlassSurface
                        fallbackColor={t.primary}
                        tintColor={t.primary}
                        style={styles.modeChip}>
                        <Text style={[Typography.label, { color: t.onPrimary }]}>{opt.name}</Text>
                      </GlassSurface>
                    ) : (
                      <View style={styles.modeChip}>
                        <Text style={[Typography.label, { color: t.textMuted }]}>{opt.name}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </GlassSurface>

          {/* 시작 화면 (#1139) — 다크 모드와 같은 칩 열. 바꾸면 다음 실행부터. */}
          <GlassSurface
            fallbackColor={t.surface}
            interactive={false}
            style={styles.card}
            testID="settings-start-tab-glass">
            <View style={styles.designHead}>
              <View style={[styles.iconCircle, { backgroundColor: t.primarySoft }]}>
                <Icon name="myRoom" size={20} color={t.primaryText} />
              </View>
              <View style={styles.flex}>
                <Text style={[Typography.label, { color: t.text }]}>시작 화면</Text>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  앱을 열 때 처음 보일 탭 · 다음 실행부터
                </Text>
              </View>
            </View>
            <View style={[styles.modeRow, { backgroundColor: t.surfaceMuted }]}>
              {START_TAB_OPTIONS.map((opt) => {
                const selected = opt.id === startTab;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => onChangeStartTab?.(opt.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    aria-checked={selected}
                    accessibilityLabel={`시작 화면 ${opt.name}`}
                    style={styles.modeOption}>
                    {selected ? (
                      <GlassSurface
                        fallbackColor={t.primary}
                        tintColor={t.primary}
                        style={styles.modeChip}>
                        <Text
                          style={[Typography.label, { color: t.onPrimary }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}>
                          {opt.name}
                        </Text>
                      </GlassSurface>
                    ) : (
                      <View style={styles.modeChip}>
                        <Text
                          style={[Typography.label, { color: t.textMuted }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}>
                          {opt.name}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </GlassSurface>

          {/*
            테마 색상·폰트 — 선택지가 많고 실제로 적용해 봐야 아는 것들이라
            인라인 칩 대신 미리보기가 있는 별도 화면으로 (#459 → 폰트도 #750).
            둘 다 현재 값을 행 오른쪽에 적어 들어가지 않고도 확인되게 했다 —
            폰트는 그 얼굴로, 테마는 이름과 그 테마 색 점으로 (#972). 종전엔
            "화면 전체가 이미 그 색"이라며 테마만 생략했는데, 색은 보여도
            **그게 어떤 테마인지는 알 수 없었다**(5종 중 비슷한 색이 있다).
          */}
          <GlassSurface
            fallbackColor={t.surface}
            interactive={false}
            style={styles.card}
            testID="settings-appearance-glass">
            <View style={styles.cardContent}>
              <Pressable
                onPress={onOpenTheme}
                accessibilityRole="button"
                accessibilityLabel="테마 색상"
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
                  pressed && { backgroundColor: t.primarySoft },
                ]}>
                <View style={[styles.rowLeft, styles.appearanceLabel]}>
                  <View style={[styles.iconCircle, { backgroundColor: t.primarySoft }]}>
                    <Icon name="palette" size={20} color={t.primaryText} />
                  </View>
                  <Text style={[Typography.body, { color: t.text }]}>테마 색상</Text>
                </View>
                {/* 점은 그 테마 색 자체 — 폰트 행이 이름을 그 얼굴로 그리는 것과 같은
                  뜻이다. 글자에 색을 입히지 않은 건 대비가 나빠지기 때문(#232). */}
                {currentTheme ? (
                  // 점과 이름을 한 덩어리로 — 따로 두면 각자 flex 자식이 돼 점만
                  // 왼쪽으로 밀린다.
                  <View style={[styles.rowValue, styles.themeValue]}>
                    <View style={[styles.themeDot, { backgroundColor: currentTheme.swatch }]} />
                    <Text
                      style={[Typography.body, styles.valueText, { color: t.textMuted }]}
                      numberOfLines={1}>
                      {currentTheme.name}
                    </Text>
                  </View>
                ) : null}
                <Icon name="forward" size={16} color={t.textDisabled} />
              </Pressable>
              <Pressable
                onPress={onOpenFont}
                accessibilityRole="button"
                accessibilityLabel="폰트"
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: t.primarySoft },
                ]}>
                <View style={[styles.rowLeft, styles.appearanceLabel]}>
                  <View style={[styles.iconCircle, { backgroundColor: t.primarySoft }]}>
                    <Icon name="edit" size={20} color={t.primaryText} />
                  </View>
                  <Text style={[Typography.body, { color: t.text }]}>폰트</Text>
                </View>
                {/* 현재 폰트 이름은 그 폰트의 얼굴로 — 행 자체가 작은 견본이 된다. */}
                <Text style={[fontPreviewStyle(fontId), styles.rowValue, { color: t.textMuted }]}>
                  {currentFontName}
                </Text>
                <Icon name="forward" size={16} color={t.textDisabled} />
              </Pressable>
            </View>
          </GlassSurface>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[...sectionTitleStyle, { color: t.textMuted }]}>{section.title}</Text>
            <GlassSurface
              fallbackColor={t.surface}
              interactive={false}
              style={styles.card}
              testID={`settings-section-${section.title}`}>
              <View style={styles.cardContent}>
                {section.rows.map((row, idx) => (
                  <ListRow
                    key={row.label}
                    icon={row.icon}
                    label={row.label}
                    onPress={row.onPress}
                    last={idx === section.rows.length - 1}
                  />
                ))}
              </View>
            </GlassSurface>
          </View>
        ))}

        {/* 회원탈퇴 (#547) — 행이 아니라 목록 밖 하단의 낮은 존재감 링크.
            실수로 닿기 어려운 자리 + 파괴 확인 다이얼로그의 2중 방어.
            색만 파괴 토큰으로 (#900): 크기·위치는 그대로 둬 #547의 "낮은
            존재감" 의도와 충돌하지 않게 하고, 색으로 위험만 표시한다.
            직전의 textDisabled는 대비 2.3:1인 데다 "비활성"으로도 읽혀서
            눌리는 링크인데 못 누르는 것처럼 보였다. */}
        <Pressable
          onPress={() => setConfirmWithdraw(true)}
          accessibilityRole="button"
          accessibilityLabel="회원탈퇴"
          style={styles.withdrawLink}>
          <Text style={[Typography.supporting, { color: t.dangerText }]}>회원탈퇴</Text>
        </Pressable>
      </ScrollView>

      <ConfirmDialog
        visible={confirmWithdraw}
        title="정말 탈퇴할까요?"
        body="모든 루틴·기록·프로필이 삭제되고 복구할 수 없어요. 같은 계정으로 다시 로그인해도 새 계정으로 시작하게 돼요."
        confirmLabel="탈퇴하기"
        confirmAccessibilityLabel="회원탈퇴 확인"
        destructive
        onConfirm={() => {
          setConfirmWithdraw(false);
          onWithdraw?.();
        }}
        onCancel={() => setConfirmWithdraw(false)}
      />

      <ConfirmDialog
        visible={confirmLogout}
        title="로그아웃할까요?"
        body="다시 이용하려면 로그인이 필요해요."
        confirmLabel="로그아웃"
        confirmAccessibilityLabel="로그아웃 확인"
        destructive
        onConfirm={() => {
          setConfirmLogout(false);
          onLogout?.();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  ambient: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  ambientPrimary: {
    position: 'absolute',
    top: Spacing.six,
    right: -Spacing.six,
    width: Spacing.six * 4,
    height: Spacing.six * 4,
    borderRadius: Radius.pill,
  },
  ambientWarm: {
    position: 'absolute',
    top: Spacing.six * 6,
    left: -Spacing.six,
    width: Spacing.six * 3,
    height: Spacing.six * 3,
    borderRadius: Radius.pill,
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.two,
  },
  card: {
    borderRadius: Radius.xl,
  },
  // Clip row feedback inside, leaving the outer fallback shadow visible.
  cardContent: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  // 회원탈퇴 링크 (#547) — 목록 아래 중앙, 낮은 존재감.
  withdrawLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  designHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    padding: Spacing.one,
    borderRadius: Radius.pill,
  },
  modeOption: { flex: 1 },
  modeChip: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  iconCircle: {
    width: Spacing.four + Spacing.three,
    height: Spacing.four + Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flexShrink: 1,
  },
  appearanceLabel: { flexShrink: 0, marginRight: Spacing.two },
  valueText: { flexShrink: 1 },
  themeValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeDot: {
    width: 12,
    height: 12,
    borderRadius: Radius.pill,
    marginRight: Spacing.one,
  },
  rowValue: {
    // 이름이 길어도 라벨을 밀지 않고 자기 자리에서 줄어든다.
    flexShrink: 1,
    marginRight: Spacing.one,
  },
});
