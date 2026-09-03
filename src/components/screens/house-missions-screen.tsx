import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { House, HouseMission, NewHouseMission } from '@/components/screens/house-screen';
import { DateRangeSheet } from '@/components/screens/sheets/date-range-sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Pictogram, type PictogramName, TrashPictogram } from '@/components/ui/pictograms';
import { useToast } from '@/components/ui/toast';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { MISSION_TYPE_RULES } from '@/constants/missions';
import { missionCtaState } from '@/utils/mission-cta';
import { formatDate, todayIso, toIsoDate } from '@/utils/datetime';

/** "YYYY-MM-DD" + n days → "YYYY-MM-DD" (device-local; noon avoids DST edges). */
function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** 생성 가능한 유형만 — 표시값은 constants/missions의 단일 출처에서 (#887). */
const CREATABLE_TYPES: NewHouseMission['missionType'][] = [
  'DAILY_MEMBER_RATE',
  'WEEKLY_MEMBER_COUNT',
];

const MISSION_TYPE_OPTIONS: {
  type: NewHouseMission['missionType'];
  icon: PictogramName;
  label: string;
}[] = CREATABLE_TYPES.map((type) => ({
  type,
  icon: MISSION_TYPE_RULES[type].icon,
  label: MISSION_TYPE_RULES[type].shortLabel,
}));

export type HouseMissionsScreenProps = {
  house: House;
  missions: HouseMission[];
  isOwner: boolean;
  /** 현재 집 미션에 연동된 내 루틴 (#578) — 연동/기여함 라벨 판정. */
  linkedRoutines?: { missionId: number; completedToday?: boolean }[];
  /** Mission ids contributed this session (기여 직후 즉시 반영용 보조 신호). */
  contributedMissionIds?: number[];
  /** 헤더 뒤로가기 — 셸이 집 화면으로 돌린다. */
  onBack?: () => void;
  /** Create a new group mission. */
  onCreateMission?: (houseId: number, input: NewHouseMission) => void;
  /** Delete a mission (server: OWNER only, COMPLETED not deletable). */
  onDeleteMission?: (houseId: number, missionId: number) => void;
  /** Claim the reward of an achieved mission. */
  onClaimMission?: (houseId: number, missionId: number) => void;
  /** File a mission as a daily routine under the house-named category. */
  onAddMissionRoutine?: (houseId: number, mission: HouseMission) => void;
  /**
   * 내 연동 루틴 정리 (#890). 미션 삭제는 방장만 가능해서, 구성원에게는
   * 자기가 만든 연동 루틴을 되돌릴 길이 이 화면에 없었다.
   */
  onRemoveMissionRoutine?: (mission: HouseMission) => void;
};

/**
 * 눌러서 정리할 수 있는 연동 배지 (#890). 방장의 휴지통과 **결과가 다르므로**
 * 같은 아이콘을 쓰지 않는다 — 휴지통은 미션이 사라지고, 이건 내 루틴만 없앤다.
 * 실제로 무슨 일이 벌어지는지는 확인 다이얼로그가 말한다.
 */
function LinkedBadge({
  label,
  color,
  mission,
  onPress,
}: {
  label: string;
  color: string;
  mission: HouseMission;
  onPress: (m: HouseMission) => void;
}) {
  const Typography = useTypography();
  return (
    <Pressable
      onPress={() => onPress(mission)}
      accessibilityRole="button"
      accessibilityLabel={`${mission.title} 연동 루틴 정리`}
      hitSlop={8}
      style={styles.linkedBadge}>
      <Text style={[Typography.supporting, { color }]}>{label}</Text>
      <Icon name="close" size={12} color={color} />
    </Pressable>
  );
}

/**
 * 공동 미션 시트 (#287) — mission list, the create-mission form, and the
 * delete / add-to-my-routines confirm modals. Extracted from
 * house-screen (pure move, no behavior change); stays mounted so the
 * form state survives closing the sheet, like the parent-held state did.
 */
export function HouseMissionsScreen({
  house: currentHouse,
  missions,
  isOwner,
  linkedRoutines = [],
  contributedMissionIds = [],
  onBack,
  onCreateMission,
  onDeleteMission,
  onClaimMission,
  onAddMissionRoutine,
  onRemoveMissionRoutine,
}: HouseMissionsScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) — 탭 줄이 스크롤 밖이라 여기서 상단 패딩.
  const headerInset = useHeaderContentInset();
  const Typography = useTypography();
  const { show: toast } = useToast();

  const [showCreateMission, setShowCreateMission] = useState(false);
  const [missionTitle, setMissionTitle] = useState('');
  const [missionType, setMissionType] =
    useState<NewHouseMission['missionType']>('WEEKLY_MEMBER_COUNT');
  const [missionTarget, setMissionTarget] = useState('10');
  // Optional mission period (기간 설정 토글) — off sends nothing (즉시 시작·무기한).
  const [missionHasPeriod, setMissionHasPeriod] = useState(false);
  const [missionStart, setMissionStart] = useState(todayIso());
  const [missionEnd, setMissionEnd] = useState<string | undefined>(undefined);
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  // 미션 → 내 루틴 추가 확인 모달의 대상.
  const [missionToAdd, setMissionToAdd] = useState<HouseMission | null>(null);
  // 미션 삭제 확인 모달의 대상 (#305).
  const [missionToDelete, setMissionToDelete] = useState<HouseMission | null>(null);
  const [missionToUnlink, setMissionToUnlink] = useState<HouseMission | null>(null);
  /**
   * 진행 중 / 지난 미션 탭 (#901). 완료 미션은 서버가 삭제를 막아(409) 계속
   * 쌓이기만 하는데, "지금 뭘 하고 있는지" 보러 온 화면에서 그게 자리를
   * 차지했다. 탭으로 나눠 이력은 남기되 기본 화면에서 비켜 둔다 — 삭제로
   * 풀려던 #892를 이 방식으로 대체한다.
   */
  const [tab, setTab] = useState<'active' | 'past'>('active');

  /** 오늘 기여 완료 판정 — 세션 추적 또는 연동 루틴의 오늘 완료에서 파생. */
  const isContributed = (mission: HouseMission) =>
    contributedMissionIds.includes(mission.id) ||
    linkedRoutines.some((r) => r.missionId === mission.id && r.completedToday);
  // 요약 줄용 파생 (#761) — 집 화면 스탯 필이 여기로 옮겨왔다.
  const activeMissions = missions.filter((m) => m.status === 'ACTIVE');
  const contributedToday = activeMissions.filter(isContributed).length;
  /**
   * '지난 미션' = COMPLETED + EXPIRED. 둘을 묶고 '완료'라 부르지 않는 이유는
   * EXPIRED가 **기간 안에 못 채우고 끝난** 것이기 때문이다 (#888처럼 목표
   * 미달인데 COMPLETED인 서버 건도 섞인다). 완료/만료 구분은 카드 안의 상태
   * 배지가 계속 한다.
   *
   * `achieved && ACTIVE`(목표는 채웠고 보상 미수령)는 보상 받기 CTA가 달린
   * 상태라 진행 중에 남는다 — 지난 미션으로 넘기면 보상을 못 받는다.
   */
  const pastMissions = missions.filter((m) => m.status !== 'ACTIVE');
  const shownMissions = tab === 'active' ? activeMissions : pastMissions;

  // Mission creation is owner-only on the server (403 HOUSE_NOT_OWNER).
  const canCreateMission = !!(onCreateMission && isOwner);
  // Mission deletion too; COMPLETED rows hide the button (server 409s them).
  const canDeleteMission = !!(onDeleteMission && isOwner);
  const missionTargetNum = Number(missionTarget);
  const targetRule = MISSION_TYPE_RULES[missionType];
  const targetValid =
    Number.isInteger(missionTargetNum) &&
    missionTargetNum >= 1 &&
    missionTargetNum <= targetRule.max;
  const canSubmitMission = missionTitle.trim().length > 0 && targetValid;
  const submitMission = () => {
    // Blocked taps explain themselves, first unmet condition first.
    if (missionTitle.trim().length === 0) return toast('미션 이름을 입력해주세요', 'error');
    if (!targetValid)
      return toast(
        `목표값은 1~${targetRule.max}${targetRule.unit} 사이 숫자로 입력해주세요`,
        'error',
      );
    if (!currentHouse.houseId) return;
    onCreateMission?.(currentHouse.houseId, {
      title: missionTitle.trim(),
      missionType,
      targetValue: missionTargetNum,
      // KST day bounds: 시작일 자정부터 종료일 하루 끝까지 (종료일 당일 포함).
      ...(missionHasPeriod
        ? {
            startsAt: `${missionStart}T00:00:00+09:00`,
            endsAt: missionEnd ? `${missionEnd}T23:59:59+09:00` : undefined,
          }
        : {}),
    });
    setShowCreateMission(false);
    setMissionTitle('');
    setMissionTarget('10');
    setMissionHasPeriod(false);
  };
  const toggleMissionPeriod = () => {
    setMissionHasPeriod((prev) => {
      const next = !prev;
      if (next) {
        // Re-derive on each enable — the mounted default goes stale overnight.
        const start = todayIso();
        setMissionStart(start);
        setMissionEnd(addDaysIso(start, 7));
      }
      return next;
    });
  };

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="우리 집의 목표" onBack={onBack} />
      {/* 나의 방(방/달력/주간회고)과 같은 언더라인 탭 — 화면 전체 목록이
          바뀌므로 '필터 칩'이 아니라 '탭'이 맞는 뜻이다. 미션이 하나도 없어도
          같이 그린다: 첫 미션을 만든 순간 탭 줄이 생겨 레이아웃이 튀지 않게. */}
      {/* 탭 줄과 본문을 같은 폭으로 묶는다 — 한쪽만 제한하면 넓은 화면에서
          탭 밑줄이 본문 밖으로 삐져나온다 (#725). */}
      <View style={[styles.tabBar, column, headerInset ? { paddingTop: headerInset } : null]}>
        {(
          [
            ['active', '진행 중'],
            ['past', '지난 미션'],
          ] as const
        ).map(([key, label]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label} 탭`}
              style={[styles.tab, active && { borderBottomColor: t.primary }]}>
              <Text style={[Typography.label, { color: active ? t.primaryText : t.textMuted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.body, column]}>
        {/* 제목은 ScreenHeader가 갖는다 (#875). 요약(#761)은 만들기 버튼과 **같은
            줄** 왼쪽에 둔다 — 제목을 헤더로 옮기면서 이 줄이 비어 버튼만 오른쪽에
            혼자 떠 있었다. */}
        <View style={styles.missionHead}>
          <Text style={[Typography.supporting, styles.flex, { color: t.textMuted }]}>
            {tab === 'active' && activeMissions.length > 0
              ? `진행 중 ${activeMissions.length}개 · 오늘 나의 기여 ${contributedToday}/${activeMissions.length}`
              : ''}
          </Text>
          {canCreateMission ? (
            <Pressable
              onPress={() => setShowCreateMission(true)}
              accessibilityRole="button"
              accessibilityLabel="미션 만들기"
              style={[styles.missionAddBtn, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.supporting, { color: t.primaryText }]}>+ 만들기</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView style={styles.editScroll}>
          {shownMissions.length === 0 ? (
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tab === 'past'
                ? '아직 지난 미션이 없어요. 완료했거나 기간이 끝난 미션이 여기에 모여요.'
                : missions.length === 0
                  ? '아직 미션이 없어요. 첫 미션을 만들어 다 같이 도전해보세요!'
                  : '진행 중인 미션이 없어요. 새 미션을 만들어 다 같이 도전해보세요!'}
            </Text>
          ) : (
            <View style={styles.goals}>
              {shownMissions.map((mission) => {
                const pct = Math.min(1, mission.current / mission.target);
                // CTA 결정은 순수 함수(#559) — 렌더는 kind 매핑만.
                const hasLinked = linkedRoutines.some((r) => r.missionId === mission.id);
                // 배지를 눌러 정리할 수 있는 건 **내 연동 루틴이 실제로 있을 때**뿐이다.
                // '기여함'은 직접 수행 체크로도 켜지므로 kind만 보면 안 된다 (#890).
                const canUnlink = hasLinked && !!onRemoveMissionRoutine;
                const cta = missionCtaState({
                  status: mission.status,
                  achieved: mission.achieved,
                  contributed: isContributed(mission),
                  linked: hasLinked,
                  canClaim: !!(currentHouse.houseId && onClaimMission),
                  canAddRoutine: !!(currentHouse.houseId && onAddMissionRoutine),
                });
                return (
                  <View
                    key={mission.id}
                    style={[styles.goalRow, { backgroundColor: t.surfaceMuted }]}>
                    <Pictogram name={mission.icon} size={22} />
                    <View style={styles.flex}>
                      <View style={styles.goalHead}>
                        <Text
                          style={[Typography.label, styles.flex, { color: t.text }]}
                          numberOfLines={1}>
                          {mission.title}
                        </Text>
                        <Text style={[Typography.supporting, { color: t.primaryText }]}>
                          {mission.current}/{mission.target}
                          {mission.unit}
                        </Text>
                        {canDeleteMission && mission.status !== 'COMPLETED' ? (
                          <Pressable
                            onPress={() => setMissionToDelete(mission)}
                            accessibilityRole="button"
                            accessibilityLabel={`${mission.title} 삭제`}
                            hitSlop={8}
                            style={styles.missionDeleteBtn}>
                            <TrashPictogram size={14} color={t.textMuted} />
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={[styles.goalTrack, { backgroundColor: t.border }]}>
                        <View
                          style={[
                            styles.goalFill,
                            { backgroundColor: t.primary, width: `${pct * 100}%` },
                          ]}
                        />
                      </View>
                      <View style={styles.missionFoot}>
                        <Text
                          style={[Typography.supporting, styles.flex, { color: t.textMuted }]}
                          numberOfLines={1}>
                          {mission.desc}
                        </Text>
                        {/* Own node (not a desc suffix) so the long type label
                            truncates instead of the date. */}
                        {/* EXPIRED도 날짜를 보여준다 (#901 리뷰) — '지난 미션'
                            탭에서 "언제 끝났나"가 곧 그 카드를 보는 이유다.
                            COMPLETED는 제외한다: 이미 달성해 받은 미션에
                            기간 종료일은 뜻이 없다. */}
                        {mission.endsOn && mission.status !== 'COMPLETED' ? (
                          <Text style={[Typography.supporting, { color: t.textMuted }]}>
                            ~{mission.endsOn.slice(5).replace('-', '.')}
                          </Text>
                        ) : null}
                        {cta.kind === 'completed' ? (
                          <Text style={[Typography.supporting, { color: t.textMuted }]}>완료</Text>
                        ) : cta.kind === 'ended' ? (
                          // 목표 미달인데 COMPLETED — 서버 쪽 문제지만 화면은 사실만 (#888).
                          <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                            종료
                          </Text>
                        ) : cta.kind === 'expired' ? (
                          <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                            기간 만료
                          </Text>
                        ) : cta.kind === 'claim' ? (
                          <Pressable
                            onPress={() => onClaimMission!(currentHouse.houseId!, mission.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`${mission.title} 보상 받기`}
                            style={[styles.missionBtn, { backgroundColor: t.warning }]}>
                            <Text style={[Typography.supporting, { color: t.text }]}>
                              보상 받기
                            </Text>
                          </Pressable>
                        ) : cta.kind === 'contributed' ? (
                          // 오늘 기여 완료 — 연동 루틴의 오늘 완료 여부로도 파생되어
                          // 앱을 다시 켜도 라벨이 유지된다.
                          canUnlink ? (
                            <LinkedBadge
                              label="기여함"
                              color={t.primaryText}
                              mission={mission}
                              onPress={setMissionToUnlink}
                            />
                          ) : (
                            <Text style={[Typography.supporting, { color: t.primaryText }]}>
                              기여함
                            </Text>
                          )
                        ) : cta.kind === 'linked' ? (
                          // Filed as my routine — completing it contributes.
                          canUnlink ? (
                            <LinkedBadge
                              label="루틴 연동됨"
                              color={t.textMuted}
                              mission={mission}
                              onPress={setMissionToUnlink}
                            />
                          ) : (
                            <Text style={[Typography.supporting, { color: t.textMuted }]}>
                              루틴 연동됨
                            </Text>
                          )
                        ) : cta.kind === 'addRoutine' ? (
                          <Pressable
                            onPress={() => setMissionToAdd(mission)}
                            accessibilityRole="button"
                            accessibilityLabel={`${mission.title} 내 루틴에 추가`}
                            style={[styles.missionBtn, { backgroundColor: t.primary }]}>
                            <Text style={[Typography.supporting, { color: t.onPrimary }]}>
                              + 내 루틴에
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      {/* 단순 [취소|확정] 확인은 공용 ConfirmDialog (#674). */}
      <ConfirmDialog
        visible={!!(missionToAdd && currentHouse.houseId)}
        title="내 루틴에 추가하시겠습니까?"
        body={
          missionToAdd
            ? `'${currentHouse.name}' 카테고리에 '${missionToAdd.title}' 루틴이 만들어져요. 루틴을 완료하면 자동으로 미션에 기여돼요.`
            : ''
        }
        confirmLabel="네"
        confirmAccessibilityLabel="루틴 추가 확인"
        cancelLabel="아니요"
        cancelAccessibilityLabel="루틴 추가 취소"
        onConfirm={() => {
          if (missionToAdd) onAddMissionRoutine?.(currentHouse.houseId!, missionToAdd);
          setMissionToAdd(null);
        }}
        onCancel={() => setMissionToAdd(null)}
      />

      <ConfirmDialog
        visible={!!(missionToDelete && currentHouse.houseId)}
        title="미션 삭제"
        body={
          missionToDelete
            ? `'${missionToDelete.title}' 미션을 삭제할까요?\n지금까지의 기여 기록은 남지만 미션은 목록에서 사라져요. 내 연동 루틴도 함께 삭제되고, 다른 멤버의 루틴은 연동만 끊겨요.`
            : ''
        }
        confirmLabel="삭제"
        confirmAccessibilityLabel="미션 삭제 확인"
        cancelAccessibilityLabel="미션 삭제 취소"
        destructive
        onConfirm={() => {
          if (missionToDelete) onDeleteMission?.(currentHouse.houseId!, missionToDelete.id);
          setMissionToDelete(null);
        }}
        onCancel={() => setMissionToDelete(null)}
      />

      {/* 배지는 '연동됨'인데 결과는 삭제다 — 문구가 그 차이를 메운다 (#890). */}
      <ConfirmDialog
        visible={!!missionToUnlink}
        title="연동 루틴 삭제"
        body={
          missionToUnlink
            ? `'${missionToUnlink.title}' 루틴을 내 루틴에서 삭제할까요?\n지금까지의 기여 기록은 남아요. 미션 자체는 그대로예요.`
            : ''
        }
        confirmLabel="삭제"
        confirmAccessibilityLabel="연동 루틴 삭제 확인"
        cancelAccessibilityLabel="연동 루틴 삭제 취소"
        destructive
        onConfirm={() => {
          if (missionToUnlink) onRemoveMissionRoutine?.(missionToUnlink);
          setMissionToUnlink(null);
        }}
        onCancel={() => setMissionToUnlink(null)}
      />

      {showCreateMission ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>새 미션 만들기</Text>
            <View style={styles.missionForm}>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>미션 제목</Text>
              <TextInput
                value={missionTitle}
                onChangeText={(v) => setMissionTitle(v.slice(0, 160))}
                placeholder="예) 이번 주 다같이 루틴 지키기"
                placeholderTextColor={t.textMuted}
                accessibilityLabel="미션 제목"
                style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
              />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>미션 유형</Text>
              <View style={styles.missionTypeRow}>
                {MISSION_TYPE_OPTIONS.map((opt) => {
                  const selected = opt.type === missionType;
                  return (
                    <Pressable
                      key={opt.type}
                      onPress={() => setMissionType(opt.type)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[
                        styles.missionTypeBtn,
                        { backgroundColor: selected ? t.primary : t.surfaceMuted },
                      ]}>
                      <Pictogram
                        name={opt.icon}
                        size={14}
                        color={selected ? t.onPrimary : t.textMuted}
                      />
                      <Text
                        style={[
                          Typography.supporting,
                          { color: selected ? t.onPrimary : t.textMuted },
                        ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                목표 수치 (1~{targetRule.max}
                {targetRule.unit})
              </Text>
              {/* 단위를 입력칸 안에 붙인다 — 달성률에 500을 적어도 통과하던
                  시절엔 이 값이 %인지 횟수인지 화면 어디에도 없었다. */}
              <View style={[styles.missionInputRow, { backgroundColor: t.surfaceMuted }]}>
                <TextInput
                  value={missionTarget}
                  onChangeText={setMissionTarget}
                  keyboardType="number-pad"
                  accessibilityLabel="목표 수치"
                  style={[styles.missionInput, styles.missionInputField, { color: t.text }]}
                />
                <Text style={[Typography.label, styles.missionUnit, { color: t.textMuted }]}>
                  {targetRule.unit}
                </Text>
              </View>
              <View style={styles.periodRow}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>기간 설정</Text>
                <ToggleSwitch
                  value={missionHasPeriod}
                  onToggle={toggleMissionPeriod}
                  accessibilityLabel="기간 설정"
                />
              </View>
              {missionHasPeriod ? (
                <Pressable
                  onPress={() => setShowPeriodSheet(true)}
                  accessibilityRole="button"
                  accessibilityLabel="미션 기간 선택"
                  style={[styles.missionInput, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.supporting, { color: t.text }]}>
                    {formatDate(missionStart)} ~ {missionEnd ? formatDate(missionEnd) : '무기한'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowCreateMission(false)}
                accessibilityRole="button"
                accessibilityLabel="미션 만들기 취소"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={submitMission}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmitMission }}
                accessibilityLabel="미션 만들기 확인"
                style={[
                  styles.modalBtn,
                  { backgroundColor: canSubmitMission ? t.primary : t.disabledBg },
                ]}>
                <Text
                  style={[
                    Typography.label,
                    { color: canSubmitMission ? t.onPrimary : t.textMuted },
                  ]}>
                  만들기
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Mission period picker — its overlay (zIndex 100) sits above the modal. */}
      <DateRangeSheet
        visible={showPeriodSheet}
        initialStartDate={missionStart}
        initialEndDate={missionEnd}
        onSave={(start, end) => {
          setMissionStart(start);
          setMissionEnd(end);
        }}
        onClose={() => setShowPeriodSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two },
  // 아래 넷은 **미션 만들기 폼**의 모달용이다 (#875에서 목록은 화면이 됐지만
  // 폼은 화면 위 모달로 남는다 — 화면 위 모달은 겹이 하나라 정상이다).
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Overlay.dim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
  },
  flex: {
    flex: 1,
  },
  // 모달 시절엔 목록을 박스 안에 가두느라 flexGrow: 0이었다 (#875) — 화면에선
  // 남는 높이를 다 쓴다.
  editScroll: {
    flex: 1,
  },
  // 나의 방 탭(#825)과 같은 값 — 두 화면의 탭 줄이 같은 높이·같은 밑줄로 읽힌다.
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
  },
  tab: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  missionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  missionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  missionAddBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  goals: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  goalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  goalTrack: {
    height: 6,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  missionFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  missionBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  linkedBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  missionDeleteBtn: {
    marginLeft: Spacing.one,
  },
  missionForm: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  missionInput: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  missionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  missionInputField: { flex: 1 },
  missionUnit: { paddingRight: Spacing.three },
  missionTypeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  missionTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
