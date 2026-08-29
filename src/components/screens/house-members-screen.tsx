import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import { type HouseCover, HouseCoverPicker } from '@/components/room/house-cover-picker';
import type { House, HouseEditInput, RoomCell } from '@/components/screens/house-screen';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Icon } from '@/components/ui/icon';
import { CrownPictogram, DoorPictogram, PencilPictogram } from '@/components/ui/pictograms';
import { useToast } from '@/components/ui/toast';
import type { CharacterId } from '@/constants/characters';
import { houseCapacityOptions } from '@/constants/house-themes';
import { houseInviteLink } from '@/constants/links';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/** Capacity choices for the edit form (server allows 1~10). */

/**
 * 관리 대상 구성원 (#753) — 정원 채움용 빈 좌석은 타일일 뿐 구성원이 아니다.
 * 층 라벨을 얹어 members prop 형태로 만든다 (구 house-screen 내부 파생의 이동).
 */
export function manageableMembers(house: House | undefined): (RoomCell & { level: string })[] {
  return (house?.floors ?? []).flatMap((f) =>
    f.rooms.filter((r) => !r.vacant).map((r) => ({ ...r, level: f.level })),
  );
}

export type HouseMembersScreenProps = {
  house: House;
  /** Managed members (vacant seats excluded), with their floor label. */
  members: (RoomCell & { level: string })[];
  isOwner: boolean;
  /** Cover catalog (GET /houses/cover-images); empty hides the edit section. */
  covers?: HouseCover[];
  /** Locally-kicked check — the kicked list stays with the parent's tiles. */
  isKicked: (name: string) => boolean;
  /** Each member's own character (room preview) — parent-resolved (#342). */
  memberCharacterId: (member: RoomCell) => CharacterId;
  onBack: () => void;
  /**
   * 초대코드를 손에 쥔 순간 (#841) — 복사·링크 공유 둘 다. 온보딩 미션
   * '집에 친구 초대하기' 완료 판정에 쓴다. 실제 가입까지 기다리면 상대의
   * 행동에 걸려 미션이 영영 안 끝난다.
   */
  onInviteShared?: () => void;
  /** Kick a member via the API (owner only); shown when the house has ids. */
  onKickMember?: (houseId: number, membershipId: number) => void;
  /** 입주 신청 수락 (#526, 방장 전용). */
  onAcceptJoinRequest?: (houseId: number, requestId: number) => void;
  /** 입주 신청 거절 (#526, 방장 전용). */
  onRejectJoinRequest?: (houseId: number, requestId: number) => void;
  /** Demo fallback kick — the parent marks the seat as kicked locally. */
  onLocalKick: (name: string) => void;
  /** Hand the OWNER role to a member via the API (owner only). */
  onTransferOwnership?: (houseId: number, membershipId: number) => void;
  /** Reissue the invite code via the API (owner only; the old code expires). */
  onReissueInviteCode?: (houseId: number) => Promise<string | null> | void;
  /** Edit the house settings via the API (owner only). */
  onUpdateHouse?: (houseId: number, input: HouseEditInput) => void;
  /** Leave the current house via the API. */
  onLeaveHouse?: (houseId: number) => void;
  /** After a confirmed leave — the parent closes this sub-view. */
  onLeaveDone: () => void;
};

/**
 * Member-management sub-view of the group house screen: invite code, owner
 * tools (edit / transfer / reissue), the member list with kick, and leaving
 * the house. Extracted from house-screen (pure move, no behavior change).
 */
export function HouseMembersScreen({
  house: currentHouse,
  members,
  isOwner,
  covers = [],
  isKicked,
  memberCharacterId,
  onBack,
  onInviteShared,
  onKickMember,
  onAcceptJoinRequest,
  onRejectJoinRequest,
  onLocalKick,
  onTransferOwnership,
  onReissueInviteCode,
  onUpdateHouse,
  onLeaveHouse,
  onLeaveDone,
}: HouseMembersScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const { show: toast } = useToast();
  // 부원 개인 초대코드 (#646) — 집 상세에는 없어(소유자 전용) 발급 응답을
  // 화면이 보관한다. 소유자는 상세의 공용 코드를 그대로 쓴다.
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const displayCode = currentHouse.inviteCode ?? issuedCode ?? null;
  const requestIssue = async () => {
    if (!currentHouse.houseId) return;
    const code = await onReissueInviteCode?.(currentHouse.houseId);
    if (typeof code === 'string') setIssuedCode(code);
  };
  // 초대코드 복사·링크 공유 (#624/#621) — 링크는 랜딩 경유 https(메신저에서
  // 눌린다), 랜딩이 rougether:// 딥링크로 앱을 연다.
  const copyInviteCode = async () => {
    if (!displayCode) return;
    try {
      await Clipboard.setStringAsync(displayCode);
      toast('초대코드를 복사했어요');
      onInviteShared?.();
    } catch {
      // 클립보드 실패 — 코드는 화면에 그대로 보인다.
    }
  };
  const shareInviteLink = async () => {
    if (!displayCode) return;
    try {
      await Share.share({
        message: `루게더 '${currentHouse.name}' 집에 초대해요!\n${houseInviteLink(displayCode)}`,
      });
      onInviteShared?.();
    } catch {
      // 공유 시트 취소/실패 — 조용히.
    }
  };
  const headerInset = useHeaderInsetStyle();
  const screenStyle = useScreenStyle([]);

  const [memberToKick, setMemberToKick] = useState<RoomCell | null>(null);
  const [showEditHouse, setShowEditHouse] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMax, setEditMax] = useState<number | undefined>(undefined);
  const [editCover, setEditCover] = useState<string | undefined>(undefined);
  const [transferTarget, setTransferTarget] = useState<RoomCell | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showReissueConfirm, setShowReissueConfirm] = useState(false);

  // Kick is server-side owner-only too; the demo (no houseId) keeps the local
  // placeholder flow so the gallery preview stays interactive.
  const canKick = isOwner || !currentHouse.houseId;

  const openEditHouse = () => {
    setEditName(currentHouse.name ?? '');
    setEditDesc(currentHouse.description ?? '');
    setEditMax(currentHouse.maxMembers);
    setEditCover(currentHouse.coverImageKey);
    setShowEditHouse(true);
  };
  const editNameValid = editName.trim().length >= 2 && editName.trim().length <= 30;
  const submitEditHouse = () => {
    if (!editNameValid) return toast('집 이름은 2~30자로 입력해주세요', 'error');
    if (!currentHouse.houseId) return;
    onUpdateHouse?.(currentHouse.houseId, {
      name: editName.trim(),
      description: editDesc.trim() || undefined,
      maxMembers: editMax,
      // Omitted keeps the server value — only send an actual pick.
      coverImageKey: editCover,
    });
    setShowEditHouse(false);
  };
  const confirmTransfer = () => {
    if (transferTarget?.membershipId && currentHouse.houseId) {
      onTransferOwnership?.(currentHouse.houseId, transferTarget.membershipId);
    }
    setTransferTarget(null);
  };
  // Leaving needs the server house id; the server rejects an OWNER's leave
  // until ownership is transferred, so the owner sees guidance instead.
  const canLeave = !!(onLeaveHouse && currentHouse.houseId);
  // 혼자 남은 방장은 위임 상대가 없어 바로 탈퇴할 수 있고, 마지막 구성원이
  // 나가면 집이 정리된다(서버 계약) — 버튼을 '집 삭제'로 정직하게 표기 (#309).
  const isLoneOwner = isOwner && members.filter((m) => !isKicked(m.name)).length <= 1;
  const confirmLeave = () => {
    if (currentHouse.houseId) onLeaveHouse?.(currentHouse.houseId);
    setShowLeaveConfirm(false);
    onLeaveDone();
  };
  const confirmKick = () => {
    if (memberToKick) {
      // Server kick when wired to the API; local placeholder otherwise (demo).
      if (onKickMember && currentHouse.houseId && memberToKick.membershipId) {
        onKickMember(currentHouse.houseId, memberToKick.membershipId);
      } else {
        onLocalKick(memberToKick.name);
      }
    }
    setMemberToKick(null);
  };

  return (
    <View style={[styles.screen, screenStyle]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="back" size={26} color={t.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[Typography.supporting, { color: t.primaryText }]}>{currentHouse.name}</Text>
          <Text style={[Typography.h3, { color: t.text }]}>구성원 관리</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, column]}>
        {onReissueInviteCode || displayCode ? (
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.codeHead}>
              <Text style={[Typography.label, styles.flex, { color: t.text }]}>초대코드</Text>
              {onReissueInviteCode && displayCode ? (
                <Pressable
                  onPress={() => setShowReissueConfirm(true)}
                  accessibilityRole="button"
                  accessibilityLabel="초대코드 재발급"
                  style={[styles.reissueBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.supporting, { color: t.primaryText }]}>재발급</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {isOwner
                ? '친구에게 코드를 공유해 집에 초대하세요.'
                : '내 개인 초대코드로 친구를 초대해요. 참여는 방장 승인 후 확정돼요.'}
            </Text>
            {displayCode ? (
              <View
                style={[
                  styles.codeBox,
                  { borderColor: t.border, backgroundColor: t.surfaceMuted },
                ]}>
                <Text style={[Typography.h3, styles.code, { color: t.text }]}>{displayCode}</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => void requestIssue()}
                accessibilityRole="button"
                accessibilityLabel="초대코드 발급받기"
                style={[
                  styles.codeBox,
                  { borderColor: t.border, backgroundColor: t.surfaceMuted },
                ]}>
                <Text style={[Typography.label, { color: t.primaryText }]}>초대코드 발급받기</Text>
              </Pressable>
            )}
            {displayCode ? (
              <View style={styles.inviteActions}>
                <Pressable
                  onPress={() => void copyInviteCode()}
                  accessibilityRole="button"
                  accessibilityLabel="초대코드 복사"
                  style={[styles.inviteActionBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Icon name="copy" size={14} color={t.text} />
                  <Text style={[Typography.supporting, { color: t.text }]}>코드 복사</Text>
                </Pressable>
                <Pressable
                  onPress={() => void shareInviteLink()}
                  accessibilityRole="button"
                  accessibilityLabel="초대 링크 공유"
                  style={[styles.inviteActionBtn, { backgroundColor: t.primary }]}>
                  <Icon name="gift" size={14} color={t.onPrimary} />
                  <Text style={[Typography.supporting, { color: t.onPrimary }]}>링크 공유</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {isOwner && onUpdateHouse ? (
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[Typography.label, { color: t.text }]}>집 정보</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              집 이름·소개·정원을 바꿀 수 있어요. (방장 전용)
            </Text>
            <Pressable
              onPress={openEditHouse}
              accessibilityRole="button"
              accessibilityLabel="집 정보 수정"
              style={[styles.editHouseBtn, { backgroundColor: t.surfaceMuted }]}>
              <PencilPictogram size={14} />
              <Text style={[Typography.label, { color: t.primaryText }]}>집 정보 수정</Text>
            </Pressable>
          </View>
        ) : null}

        {isOwner && currentHouse.joinRequests?.length ? (
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[Typography.label, { color: t.text }]}>
              입주 신청 {currentHouse.joinRequests.length}건
            </Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              탐색으로 찾아온 신청을 확인해 주세요.
            </Text>
            {currentHouse.joinRequests.map((request) => (
              <View
                key={request.requestId}
                style={[styles.memberRow, { backgroundColor: t.surfaceMuted }]}>
                <View style={styles.flex}>
                  <Text style={[Typography.label, { color: t.text }]}>{request.nickname}</Text>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>입주 대기 중</Text>
                </View>
                {onRejectJoinRequest && currentHouse.houseId ? (
                  <Pressable
                    onPress={() => onRejectJoinRequest(currentHouse.houseId!, request.requestId)}
                    accessibilityRole="button"
                    accessibilityLabel={`${request.nickname} 입주 거절`}
                    style={[styles.kickBtn, { backgroundColor: t.dangerSoft }]}>
                    <Text style={[Typography.supporting, { color: t.danger }]}>거절</Text>
                  </Pressable>
                ) : null}
                {onAcceptJoinRequest && currentHouse.houseId ? (
                  <Pressable
                    onPress={() => onAcceptJoinRequest(currentHouse.houseId!, request.requestId)}
                    accessibilityRole="button"
                    accessibilityLabel={`${request.nickname} 입주 수락`}
                    style={[styles.kickBtn, { backgroundColor: t.primarySoft }]}>
                    <Text style={[Typography.supporting, { color: t.primaryText }]}>수락</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.memberList}>
          {members.map((member) => {
            const kickedOut = isKicked(member.name);
            return (
              <View
                key={`${member.level}-${member.name}`}
                style={[styles.memberRow, { backgroundColor: t.surface }]}>
                <View
                  style={[
                    styles.memberAvatar,
                    { backgroundColor: kickedOut ? t.surfaceMuted : member.color },
                  ]}>
                  {kickedOut ? (
                    <Icon name="leave" size={22} color={t.textMuted} />
                  ) : (
                    // 각자 자기 캐릭터(방 프리뷰) — 아직 안 실렸으면 남에게 내
                    // 캐릭터를 씌우지 않고 기본 캐릭터로 (#342).
                    <CharacterAvatar characterId={memberCharacterId(member)} size={36} />
                  )}
                </View>
                <View style={styles.flex}>
                  <View style={styles.memberNameRow}>
                    <Text style={[Typography.label, { color: t.text }]}>{member.name}</Text>
                    {member.isOwner ? (
                      <View style={[styles.ownerBadge, { backgroundColor: t.primarySoft }]}>
                        <CrownPictogram size={10} />
                        <Text
                          style={[styles.ownerBadgeText, emph('bold'), { color: t.primaryText }]}>
                          방장
                        </Text>
                      </View>
                    ) : null}
                    {/* 동거 봇 (서버 #307~#310) — 사람인 줄 알고 응원을 보내거나
                        말을 걸지 않게 이름 옆에서 바로 구분한다. */}
                    {member.bot ? (
                      <View
                        testID={`bot-badge-${member.name}`}
                        style={[styles.ownerBadge, { backgroundColor: t.surfaceMuted }]}>
                        <Text style={[styles.ownerBadgeText, emph('bold'), { color: t.textMuted }]}>
                          봇
                        </Text>
                      </View>
                    ) : null}
                    {member.isMine ? (
                      <Text
                        style={[
                          styles.myBadge,
                          emph('bold'),
                          { backgroundColor: t.warning, color: t.onTint },
                        ]}>
                        MY
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    {kickedOut ? '강퇴된 멤버' : member.level}
                  </Text>
                </View>
                {/* 봇에게는 위임할 수 없다 — 서버가 HOUSE_OWNER_TRANSFER_TO_BOT으로
                    거부한다(서버 #309). 고를 수 있는데 눌러야 실패하는 대신 아예 뺀다. */}
                {isOwner &&
                onTransferOwnership &&
                !member.isMine &&
                !member.bot &&
                member.membershipId &&
                !kickedOut ? (
                  <Pressable
                    onPress={() => setTransferTarget(member)}
                    accessibilityRole="button"
                    accessibilityLabel={`${member.name} 방장 위임`}
                    style={[styles.kickBtn, { backgroundColor: t.primarySoft }]}>
                    <Text style={[Typography.supporting, { color: t.primaryText }]}>위임</Text>
                  </Pressable>
                ) : null}
                {/* 내 카드에는 강퇴 버튼 자체를 두지 않는다 (disable 아님). */}
                {canKick && !member.isMine ? (
                  <Pressable
                    onPress={() => setMemberToKick(member)}
                    disabled={kickedOut}
                    accessibilityRole="button"
                    accessibilityLabel={`${member.name} 강퇴`}
                    style={[
                      styles.kickBtn,
                      { backgroundColor: kickedOut ? t.surfaceMuted : t.dangerSoft },
                    ]}>
                    <Text
                      style={[
                        Typography.supporting,
                        { color: kickedOut ? t.textDisabled : t.danger },
                      ]}>
                      {kickedOut ? '강퇴됨' : '강퇴'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        {canLeave ? (
          <View style={styles.leaveWrap}>
            {isOwner && !isLoneOwner ? (
              <Text style={[Typography.supporting, styles.leaveHint, { color: t.textMuted }]}>
                방장은 다른 멤버에게 방장을 위임한 뒤 나갈 수 있어요.
              </Text>
            ) : (
              <Pressable
                onPress={() => setShowLeaveConfirm(true)}
                accessibilityRole="button"
                accessibilityLabel={isLoneOwner ? '집 삭제' : '집 나가기'}
                style={[styles.leaveBtn, { backgroundColor: t.dangerSoft }]}>
                <DoorPictogram size={14} />
                <Text style={[Typography.label, { color: t.danger }]}>
                  {isLoneOwner ? '집 삭제' : '집 나가기'}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* 단순 [취소|확정] 확인은 공용 ConfirmDialog (#674). */}
      <ConfirmDialog
        visible={showReissueConfirm}
        title="초대코드를 재발급할까요?"
        body="기존 코드는 즉시 만료돼요. 이미 공유한 코드로는 더 이상 입주할 수 없어요."
        confirmLabel="재발급"
        confirmAccessibilityLabel="재발급 확인"
        cancelAccessibilityLabel="재발급 취소"
        onConfirm={() => {
          void requestIssue();
          setShowReissueConfirm(false);
        }}
        onCancel={() => setShowReissueConfirm(false)}
      />

      <ConfirmDialog
        visible={showLeaveConfirm}
        title={isLoneOwner ? '집을 삭제할까요?' : '집에서 나갈까요?'}
        body={
          isLoneOwner
            ? `혼자 남은 집이라 나가면 '${currentHouse?.name}' 집이 삭제되고 탐색·조회에서 사라져요.\n이 집과 연동된 카테고리의 루틴·할 일도 함께 삭제돼요.`
            : // 나가기는 연동 카테고리를 루틴·할 일째 지운다 (#338, #908에서 유지 결정).
              // 예전 문구는 그 사실을 빼놓고 "이전 기록이 복원돼요"라고만 해서,
              // 되돌릴 수 없는 삭제를 되돌릴 수 있는 것처럼 읽혔다.
              '나가면 이 집과 연동된 카테고리의 루틴·할 일이 함께 삭제돼요. 다시 참여해도 되돌아오지 않아요.\n집에 남긴 기여 기록은 그대로 유지돼요.'
        }
        confirmLabel={isLoneOwner ? '삭제' : '나가기'}
        confirmAccessibilityLabel={isLoneOwner ? '집 삭제 확인' : '나가기 확인'}
        cancelAccessibilityLabel="나가기 취소"
        destructive
        onConfirm={confirmLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      <ConfirmDialog
        visible={memberToKick != null}
        title="정말 강퇴할까요?"
        body={
          memberToKick ? `${memberToKick.name}님을 강퇴하면 집 화면에서 빈방으로 표시됩니다.` : ''
        }
        confirmLabel="강퇴"
        confirmAccessibilityLabel="강퇴 확인"
        destructive
        onConfirm={confirmKick}
        onCancel={() => setMemberToKick(null)}
      />

      <ConfirmDialog
        visible={transferTarget != null}
        title="방장을 위임할까요?"
        body={
          transferTarget
            ? `${transferTarget.name}님에게 방장을 넘기면 집 관리 권한(정보 수정·강퇴·초대코드)이 이동하고 되돌릴 수 없어요.`
            : ''
        }
        confirmLabel="위임"
        confirmAccessibilityLabel="위임 확인"
        cancelAccessibilityLabel="위임 취소"
        onConfirm={confirmTransfer}
        onCancel={() => setTransferTarget(null)}
      />

      {showEditHouse ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>집 정보 수정</Text>
            <ScrollView style={styles.editScroll} contentContainerStyle={styles.missionForm}>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>집 이름 (2~30자)</Text>
              <TextInput
                value={editName}
                onChangeText={(v) => setEditName(v.slice(0, 30))}
                accessibilityLabel="집 이름"
                placeholder="집 이름"
                placeholderTextColor={t.textMuted}
                style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
              />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>한 줄 소개</Text>
              <TextInput
                value={editDesc}
                onChangeText={setEditDesc}
                accessibilityLabel="집 소개"
                placeholder="어떤 루틴을 함께 하나요?"
                placeholderTextColor={t.textMuted}
                style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
              />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                정원{currentHouse.memberCount ? ` (현재 ${currentHouse.memberCount}명)` : ''}
              </Text>
              <View style={styles.missionTypeRow}>
                {houseCapacityOptions(currentHouse.maxMembers).map((n) => {
                  const selected = n === editMax;
                  // The server rejects a capacity below the current headcount.
                  const tooSmall = !!currentHouse.memberCount && n < currentHouse.memberCount;
                  return (
                    <Pressable
                      key={n}
                      onPress={() =>
                        tooSmall
                          ? toast('현재 인원보다 작게 줄일 수 없어요', 'error')
                          : setEditMax(n)
                      }
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: tooSmall }}
                      accessibilityLabel={`정원 ${n}명`}
                      style={[
                        styles.capacityBtn,
                        {
                          backgroundColor: selected
                            ? t.primary
                            : tooSmall
                              ? t.disabledBg
                              : t.surfaceMuted,
                        },
                      ]}>
                      <Text
                        style={[
                          Typography.supporting,
                          {
                            color: selected ? t.onPrimary : tooSmall ? t.textDisabled : t.textMuted,
                          },
                        ]}>
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {covers.length > 0 ? (
                <>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>대표 이미지</Text>
                  <HouseCoverPicker
                    covers={covers}
                    selectedKey={editCover}
                    onSelect={setEditCover}
                  />
                </>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowEditHouse(false)}
                accessibilityRole="button"
                accessibilityLabel="집 정보 수정 취소"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={submitEditHouse}
                accessibilityRole="button"
                accessibilityState={{ disabled: !editNameValid }}
                accessibilityLabel="집 정보 저장"
                style={[
                  styles.modalBtn,
                  { backgroundColor: editNameValid ? t.primary : t.disabledBg },
                ]}>
                <Text
                  style={[Typography.label, { color: editNameValid ? t.onPrimary : t.textMuted }]}>
                  저장
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingBottom: Spacing.six,
  },
  card: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.two,
  },
  codeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reissueBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  codeBox: {
    marginTop: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  // 코드 복사·링크 공유 (#624) — 코드 박스 아래 나란히.
  inviteActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  inviteActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
  },
  code: {
    letterSpacing: 4,
  },
  editHouseBtn: {
    marginTop: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  memberList: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  ownerBadgeText: {
    fontSize: 11,
  },
  myBadge: {
    fontSize: 11,
    overflow: 'hidden',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  kickBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  leaveWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  leaveHint: {
    textAlign: 'center',
  },
  leaveBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Overlay.dim,
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
  // The edit form scrolls (cover grid makes it taller than small screens).
  editScroll: {
    flexGrow: 0,
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
  missionTypeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  capacityBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
