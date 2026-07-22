import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { House, HouseMission, NewHouseMission } from '@/components/screens/group-house-screen';
import { DateRangeSheet } from '@/components/screens/sheets/date-range-sheet';
import {
  Pictogram,
  type PictogramName,
  TargetPictogram,
  TrashPictogram,
} from '@/components/ui/pictograms';
import { useToast } from '@/components/ui/toast';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { formatDate, todayIso, toIsoDate } from '@/utils/datetime';

/** "YYYY-MM-DD" + n days → "YYYY-MM-DD" (device-local; noon avoids DST edges). */
function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

const MISSION_TYPE_OPTIONS: {
  type: NewHouseMission['missionType'];
  icon: PictogramName;
  label: string;
}[] = [
  { type: 'DAILY_MEMBER_RATE', icon: 'sun', label: '일일 달성률' },
  { type: 'WEEKLY_MEMBER_COUNT', icon: 'calendar', label: '주간 달성 횟수' },
];

export type HouseMissionsSheetProps = {
  visible: boolean;
  house: House;
  missions: HouseMission[];
  isOwner: boolean;
  /** My routines in this house's category — 연동/기여함 라벨 판정. */
  linkedRoutines?: { title: string; completedToday?: boolean }[];
  /** Mission ids contributed this session (기여 직후 즉시 반영용 보조 신호). */
  contributedMissionIds?: number[];
  onClose: () => void;
  /** Create a new group mission. */
  onCreateMission?: (houseId: number, input: NewHouseMission) => void;
  /** Delete a mission (server: OWNER only, COMPLETED not deletable). */
  onDeleteMission?: (houseId: number, missionId: number) => void;
  /** Claim the reward of an achieved mission. */
  onClaimMission?: (houseId: number, missionId: number) => void;
  /** File a mission as a daily routine under the house-named category. */
  onAddMissionRoutine?: (houseId: number, mission: HouseMission) => void;
};

/**
 * 공동 미션 시트 (#287) — mission list, the create-mission form, and the
 * delete / add-to-my-routines confirm modals. Extracted from
 * group-house-screen (pure move, no behavior change); stays mounted so the
 * form state survives closing the sheet, like the parent-held state did.
 */
export function HouseMissionsSheet({
  visible,
  house: currentHouse,
  missions,
  isOwner,
  linkedRoutines = [],
  contributedMissionIds = [],
  onClose,
  onCreateMission,
  onDeleteMission,
  onClaimMission,
  onAddMissionRoutine,
}: HouseMissionsSheetProps) {
  const t = useTokens();
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

  /** 오늘 기여 완료 판정 — 세션 추적 또는 연동 루틴의 오늘 완료에서 파생. */
  const isContributed = (mission: HouseMission) =>
    contributedMissionIds.includes(mission.id) ||
    linkedRoutines.some((r) => r.title === mission.title && r.completedToday);

  // Mission creation is owner-only on the server (403 HOUSE_NOT_OWNER).
  const canCreateMission = !!(onCreateMission && isOwner);
  // Mission deletion too; COMPLETED rows hide the button (server 409s them).
  const canDeleteMission = !!(onDeleteMission && isOwner);
  const missionTargetNum = Number(missionTarget);
  const canSubmitMission =
    missionTitle.trim().length > 0 &&
    Number.isInteger(missionTargetNum) &&
    missionTargetNum >= 1 &&
    missionTargetNum <= 1000;
  const submitMission = () => {
    // Blocked taps explain themselves, first unmet condition first.
    if (missionTitle.trim().length === 0) return toast('미션 이름을 입력해주세요', 'error');
    if (!Number.isInteger(missionTargetNum) || missionTargetNum < 1 || missionTargetNum > 1000)
      return toast('목표값은 1~1000 사이 숫자로 입력해주세요', 'error');
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
    <>
      {visible ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <View style={styles.missionHead}>
              <View style={[styles.flex, styles.missionTitleRow]}>
                <TargetPictogram size={18} />
                <Text style={[Typography.h3, { color: t.text }]}>우리 집의 목표</Text>
              </View>
              {canCreateMission ? (
                <Pressable
                  onPress={() => setShowCreateMission(true)}
                  accessibilityRole="button"
                  accessibilityLabel="미션 만들기"
                  style={[styles.missionAddBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.supporting, { color: t.primaryText }]}>＋ 만들기</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView style={styles.editScroll}>
              {missions.length === 0 ? (
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  아직 미션이 없어요. 첫 미션을 만들어 다 같이 도전해보세요!
                </Text>
              ) : (
                <View style={styles.goals}>
                  {missions.map((mission) => {
                    const pct = Math.min(1, mission.current / mission.target);
                    const claimable = mission.status === 'ACTIVE' && mission.achieved;
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
                            {mission.endsOn && mission.status === 'ACTIVE' ? (
                              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                                ~{mission.endsOn.slice(5).replace('-', '.')}
                              </Text>
                            ) : null}
                            {mission.status === 'COMPLETED' ? (
                              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                                완료
                              </Text>
                            ) : mission.status === 'EXPIRED' ? (
                              <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                                기간 만료
                              </Text>
                            ) : claimable && currentHouse.houseId && onClaimMission ? (
                              <Pressable
                                onPress={() => onClaimMission(currentHouse.houseId!, mission.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`${mission.title} 보상 받기`}
                                style={[styles.missionBtn, { backgroundColor: t.warning }]}>
                                <Text style={[Typography.supporting, { color: t.text }]}>
                                  보상 받기
                                </Text>
                              </Pressable>
                            ) : mission.status === 'ACTIVE' && isContributed(mission) ? (
                              // 오늘 기여 완료 — 연동 루틴의 오늘 완료 여부로도 파생되어
                              // 앱을 다시 켜도 라벨이 유지된다.
                              <Text style={[Typography.supporting, { color: t.primaryText }]}>
                                기여함
                              </Text>
                            ) : mission.status === 'ACTIVE' &&
                              linkedRoutines.some((r) => r.title === mission.title) ? (
                              // Filed as my routine — completing it contributes.
                              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                                루틴 연동됨
                              </Text>
                            ) : mission.status === 'ACTIVE' &&
                              currentHouse.houseId &&
                              onAddMissionRoutine ? (
                              <Pressable
                                onPress={() => setMissionToAdd(mission)}
                                accessibilityRole="button"
                                accessibilityLabel={`${mission.title} 내 루틴에 추가`}
                                style={[styles.missionBtn, { backgroundColor: t.primary }]}>
                                <Text style={[Typography.supporting, { color: t.onPrimary }]}>
                                  ＋ 내 루틴에
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
            <View style={styles.modalActions}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="공동 미션 닫기"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>닫기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {missionToAdd && currentHouse.houseId ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>내 루틴에 추가하시겠습니까?</Text>
            <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
              {`'${currentHouse.title}' 카테고리에 '${missionToAdd.title}' 루틴이 만들어져요. 루틴을 완료하면 자동으로 미션에 기여돼요.`}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setMissionToAdd(null)}
                accessibilityRole="button"
                accessibilityLabel="루틴 추가 취소"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>아니요</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onAddMissionRoutine?.(currentHouse.houseId!, missionToAdd);
                  setMissionToAdd(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="루틴 추가 확인"
                style={[styles.modalBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>네</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {missionToDelete && currentHouse.houseId ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>미션 삭제</Text>
            <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
              {`'${missionToDelete.title}' 미션을 삭제할까요?\n지금까지의 기여 기록은 남지만 미션은 목록에서 사라져요. 멤버들이 만든 연동 루틴은 삭제되지 않아요.`}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setMissionToDelete(null)}
                accessibilityRole="button"
                accessibilityLabel="미션 삭제 취소"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onDeleteMission?.(currentHouse.houseId!, missionToDelete.id);
                  setMissionToDelete(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="미션 삭제 확인"
                style={[styles.modalBtn, { backgroundColor: t.danger }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>삭제</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

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
                목표 수치 (1~1000)
              </Text>
              <TextInput
                value={missionTarget}
                onChangeText={setMissionTarget}
                keyboardType="number-pad"
                accessibilityLabel="목표 수치"
                style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
              />
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
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  // The mission list scrolls when it grows taller than small screens.
  editScroll: {
    flexGrow: 0,
  },
  modalBody: {
    marginTop: Spacing.two,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  modalBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
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
    fontSize: 14,
  },
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
