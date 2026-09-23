import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import { type HouseCover, HouseCoverPicker } from '@/components/room/house-cover-picker';
import type { House, HouseEditInput, RoomCell } from '@/components/screens/house-screen';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Icon } from '@/components/ui/icon';
import { CrownPictogram, DoorPictogram, PencilPictogram } from '@/components/ui/pictograms';
import { useToast } from '@/components/ui/toast';
import { CoachTarget } from '@/components/ui/coach-mark';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { shareOrCopy } from '@/lib/share-link';
import type { CharacterId } from '@/constants/characters';
import { HOUSE_PRIVATE_ACCENT, houseCapacityOptions } from '@/constants/house-themes';
import { houseInviteLink } from '@/constants/links';
import { PrivacyCard } from '@/components/screens/house/privacy-card';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** Capacity choices for the edit form (server allows 1~10). */

/**
 * 관리 대상 구성원 (#753) — 정원 채움용 빈 좌석은 타일일 뿐 구성원이 아니다.
 * 층 라벨을 얹어 members prop 형태로 만든다 (구 house-screen 내부 파생의 이동).
 */
// 순수 함수라 house/members.ts로 이동 (리팩토링 4묶음) — 기존 임포터를 위한 재수출.
export { manageableMembers } from '@/components/screens/house/members';

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
  /**
   * 온보딩 자동 입주 허용의 현재 값 (#1407, `GET /houses/{id}/auto-join`) — 방장에게만 온다.
   * undefined면 아직 모름(조회 전·실패): 토글은 꺼진 채 열리고 안 건드리면 보내지 않는다.
   */
  autoJoinEnabled?: boolean;
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
  autoJoinEnabled,
  onLeaveHouse,
  onLeaveDone,
}: HouseMembersScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const { show: toast } = useToast();
  const tr = useT();
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
      toast(tr('house.members.codeCopied'));
      onInviteShared?.();
    } catch {
      // 클립보드 실패 — 코드는 화면에 그대로 보인다.
    }
  };
  const shareInviteLink = async () => {
    if (!displayCode) return;
    const outcome = await shareOrCopy(
      tr('house.members.shareMessage', {
        name: currentHouse.name,
        link: houseInviteLink(displayCode),
      }),
    );
    // 공유 시트가 없는 브라우저는 복사로 대신했으니 알려 준다. 취소는 조용히.
    if (outcome === 'copied') toast(tr('house.members.linkCopied'));
    if (outcome !== 'cancelled') onInviteShared?.();
  };
  const headerInset = useHeaderInsetStyle();
  const screenStyle = useScreenStyle([]);

  const [memberToKick, setMemberToKick] = useState<RoomCell | null>(null);
  const [showEditHouse, setShowEditHouse] = useState(false);
  const [editName, setEditName] = useState('');
  // 공개 범위 (#1266) — undefined는 '현재 값 모름'(서버가 GET에 아직 안 실어 줌).
  const [editPublic, setEditPublic] = useState<boolean | undefined>(undefined);
  // 자동 입주 허용 (#1407) — undefined는 '안 건드림'(서버 값 유지).
  const [editAutoJoin, setEditAutoJoin] = useState<boolean | undefined>(undefined);
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
    setEditPublic(currentHouse.isPublic);
    setEditAutoJoin(undefined);
    setShowEditHouse(true);
  };
  const editNameValid = editName.trim().length >= 2 && editName.trim().length <= 30;
  const submitEditHouse = () => {
    if (!editNameValid) return toast(tr('house.members.nameLengthError'), 'error');
    if (!currentHouse.houseId) return;
    onUpdateHouse?.(currentHouse.houseId, {
      name: editName.trim(),
      description: editDesc.trim() || undefined,
      maxMembers: editMax,
      // Omitted keeps the server value — only send an actual pick.
      coverImageKey: editCover,
      // 공개 범위도 고른 경우에만 — 미선택(현재 값 모름)이면 유지.
      ...(editPublic === undefined ? {} : { isPublic: editPublic }),
      // 자동 입주도 토글을 건드린 경우에만 (#1407).
      ...(editAutoJoin === undefined ? {} : { autoJoinEnabled: editAutoJoin }),
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
          accessibilityLabel={tr('common.back')}
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="back" size={26} color={t.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[Typography.supporting, { color: t.primaryText }]}>{currentHouse.name}</Text>
          <Text style={[Typography.h3, { color: t.text }]}>{tr('house.members.title')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, column]}>
        {onReissueInviteCode || displayCode ? (
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.codeHead}>
              <Text style={[Typography.label, styles.flex, { color: t.text }]}>
                {tr('house.members.inviteCode')}
              </Text>
              {onReissueInviteCode && displayCode ? (
                <Pressable
                  onPress={() => setShowReissueConfirm(true)}
                  accessibilityRole="button"
                  accessibilityLabel={tr('house.members.reissueA11y')}
                  style={[styles.reissueBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.supporting, { color: t.primaryText }]}>
                    {tr('house.members.reissue')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {isOwner ? tr('house.members.ownerCodeHint') : tr('house.members.memberCodeHint')}
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
                accessibilityLabel={tr('house.members.issueCode')}
                style={[
                  styles.codeBox,
                  { borderColor: t.border, backgroundColor: t.surfaceMuted },
                ]}>
                <Text style={[Typography.label, { color: t.primaryText }]}>
                  {tr('house.members.issueCode')}
                </Text>
              </Pressable>
            )}
            {displayCode ? (
              <View style={styles.inviteActions}>
                <Pressable
                  onPress={() => void copyInviteCode()}
                  accessibilityRole="button"
                  accessibilityLabel={tr('house.members.copyA11y')}
                  style={[styles.inviteActionBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Icon name="copy" size={14} color={t.text} />
                  <Text style={[Typography.supporting, { color: t.text }]}>
                    {tr('house.members.copy')}
                  </Text>
                </Pressable>
                {/* 튜토리얼 '친구 초대' 마지막 대상 (#1324) — 코드 복사가 아니라 링크 공유. */}
                <CoachTarget id="house-invite-share">
                  <Pressable
                    onPress={() => void shareInviteLink()}
                    accessibilityRole="button"
                    accessibilityLabel={tr('house.members.shareA11y')}
                    style={[styles.inviteActionBtn, { backgroundColor: t.primary }]}>
                    <Icon name="gift" size={14} color={t.onPrimary} />
                    <Text style={[Typography.supporting, { color: t.onPrimary }]}>
                      {tr('house.members.share')}
                    </Text>
                  </Pressable>
                </CoachTarget>
              </View>
            ) : null}
          </View>
        ) : null}

        {isOwner && onUpdateHouse ? (
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[Typography.label, { color: t.text }]}>
              {tr('house.members.houseInfo')}
            </Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr('house.members.houseInfoHint')}
            </Text>
            <Pressable
              onPress={openEditHouse}
              accessibilityRole="button"
              accessibilityLabel={tr('house.members.editHouse')}
              style={[styles.editHouseBtn, { backgroundColor: t.surfaceMuted }]}>
              <PencilPictogram size={14} />
              <Text style={[Typography.label, { color: t.primaryText }]}>
                {tr('house.members.editHouse')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isOwner && currentHouse.joinRequests?.length ? (
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[Typography.label, { color: t.text }]}>
              {tr('house.members.joinRequests', { n: currentHouse.joinRequests.length })}
            </Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr('house.members.joinRequestsHint')}
            </Text>
            {currentHouse.joinRequests.map((request) => (
              <View
                key={request.requestId}
                style={[styles.memberRow, { backgroundColor: t.surfaceMuted }]}>
                <View style={styles.flex}>
                  <Text style={[Typography.label, { color: t.text }]}>{request.nickname}</Text>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    {tr('house.members.waiting')}
                  </Text>
                </View>
                {onRejectJoinRequest && currentHouse.houseId ? (
                  <Pressable
                    onPress={() => onRejectJoinRequest(currentHouse.houseId!, request.requestId)}
                    accessibilityRole="button"
                    accessibilityLabel={tr('house.members.rejectA11y', { name: request.nickname })}
                    style={[styles.kickBtn, { backgroundColor: t.dangerSoft }]}>
                    <Text style={[Typography.supporting, { color: t.danger }]}>
                      {tr('house.members.reject')}
                    </Text>
                  </Pressable>
                ) : null}
                {onAcceptJoinRequest && currentHouse.houseId ? (
                  <Pressable
                    onPress={() => onAcceptJoinRequest(currentHouse.houseId!, request.requestId)}
                    accessibilityRole="button"
                    accessibilityLabel={tr('house.members.acceptA11y', { name: request.nickname })}
                    style={[styles.kickBtn, { backgroundColor: t.primarySoft }]}>
                    <Text style={[Typography.supporting, { color: t.primaryText }]}>
                      {tr('house.members.accept')}
                    </Text>
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
                          {tr('house.members.owner')}
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
                          {tr('house.members.bot')}
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
                    {kickedOut ? tr('house.members.kickedMember') : member.level}
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
                    accessibilityLabel={tr('house.members.transferA11y', { name: member.name })}
                    style={[styles.kickBtn, { backgroundColor: t.primarySoft }]}>
                    <Text style={[Typography.supporting, { color: t.primaryText }]}>
                      {tr('house.members.transfer')}
                    </Text>
                  </Pressable>
                ) : null}
                {/* 내 카드에는 강퇴 버튼 자체를 두지 않는다 (disable 아님). */}
                {canKick && !member.isMine ? (
                  <Pressable
                    onPress={() => setMemberToKick(member)}
                    disabled={kickedOut}
                    accessibilityRole="button"
                    accessibilityLabel={tr('house.members.kickA11y', { name: member.name })}
                    style={[
                      styles.kickBtn,
                      { backgroundColor: kickedOut ? t.surfaceMuted : t.dangerSoft },
                    ]}>
                    <Text
                      style={[
                        Typography.supporting,
                        { color: kickedOut ? t.textDisabled : t.danger },
                      ]}>
                      {kickedOut ? tr('house.members.kicked') : tr('house.members.kick')}
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
                {tr('house.members.ownerLeaveHint')}
              </Text>
            ) : (
              <Pressable
                onPress={() => setShowLeaveConfirm(true)}
                accessibilityRole="button"
                accessibilityLabel={
                  isLoneOwner ? tr('house.members.deleteHouse') : tr('house.members.leaveHouse')
                }
                style={[styles.leaveBtn, { backgroundColor: t.dangerSoft }]}>
                <DoorPictogram size={14} />
                <Text style={[Typography.label, { color: t.danger }]}>
                  {isLoneOwner ? tr('house.members.deleteHouse') : tr('house.members.leaveHouse')}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* 단순 [취소|확정] 확인은 공용 ConfirmDialog (#674). */}
      <ConfirmDialog
        visible={showReissueConfirm}
        title={tr('house.members.reissueConfirm.title')}
        body={tr('house.members.reissueConfirm.body')}
        confirmLabel={tr('house.members.reissueConfirm.label')}
        confirmAccessibilityLabel={tr('house.members.reissueConfirm.a11y')}
        cancelAccessibilityLabel={tr('house.members.reissueConfirm.cancelA11y')}
        onConfirm={() => {
          void requestIssue();
          setShowReissueConfirm(false);
        }}
        onCancel={() => setShowReissueConfirm(false)}
      />

      <ConfirmDialog
        visible={showLeaveConfirm}
        title={
          isLoneOwner
            ? tr('house.members.leaveConfirm.deleteTitle')
            : tr('house.members.leaveConfirm.leaveTitle')
        }
        body={
          isLoneOwner
            ? tr('house.members.leaveConfirm.deleteBody', { name: currentHouse?.name })
            : // 나가기는 연동 카테고리를 루틴·할 일째 지운다 (#338, #908에서 유지 결정).
              // 예전 문구는 그 사실을 빼놓고 "이전 기록이 복원돼요"라고만 해서,
              // 되돌릴 수 없는 삭제를 되돌릴 수 있는 것처럼 읽혔다.
              tr('house.members.leaveConfirm.leaveBody')
        }
        confirmLabel={
          isLoneOwner
            ? tr('house.members.leaveConfirm.delete')
            : tr('house.members.leaveConfirm.leave')
        }
        confirmAccessibilityLabel={
          isLoneOwner
            ? tr('house.members.leaveConfirm.deleteA11y')
            : tr('house.members.leaveConfirm.leaveA11y')
        }
        cancelAccessibilityLabel={tr('house.members.leaveConfirm.cancelA11y')}
        destructive
        onConfirm={confirmLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      <ConfirmDialog
        visible={memberToKick != null}
        title={tr('house.members.kickConfirm.title')}
        body={memberToKick ? tr('house.members.kickConfirm.body', { name: memberToKick.name }) : ''}
        confirmLabel={tr('house.members.kickConfirm.label')}
        confirmAccessibilityLabel={tr('house.members.kickConfirm.a11y')}
        destructive
        onConfirm={confirmKick}
        onCancel={() => setMemberToKick(null)}
      />

      <ConfirmDialog
        visible={transferTarget != null}
        title={tr('house.members.transferConfirm.title')}
        body={
          transferTarget
            ? tr('house.members.transferConfirm.body', { name: transferTarget.name })
            : ''
        }
        confirmLabel={tr('house.members.transferConfirm.label')}
        confirmAccessibilityLabel={tr('house.members.transferConfirm.a11y')}
        cancelAccessibilityLabel={tr('house.members.transferConfirm.cancelA11y')}
        onConfirm={confirmTransfer}
        onCancel={() => setTransferTarget(null)}
      />

      {showEditHouse ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>{tr('house.members.edit.title')}</Text>
            <ScrollView style={styles.editScroll} contentContainerStyle={styles.missionForm}>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {tr('house.members.edit.nameLabel')}
              </Text>
              <TextInput
                value={editName}
                onChangeText={(v) => setEditName(v.slice(0, 30))}
                accessibilityLabel={tr('house.members.edit.nameA11y')}
                placeholder={tr('house.members.edit.namePlaceholder')}
                placeholderTextColor={t.textMuted}
                style={[
                  styles.missionInput,
                  emph('normal'),
                  { backgroundColor: t.surfaceMuted, color: t.text },
                ]}
              />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {tr('house.members.edit.descLabel')}
              </Text>
              <TextInput
                value={editDesc}
                onChangeText={setEditDesc}
                accessibilityLabel={tr('house.members.edit.descA11y')}
                placeholder={tr('house.members.edit.descPlaceholder')}
                placeholderTextColor={t.textMuted}
                style={[
                  styles.missionInput,
                  emph('normal'),
                  { backgroundColor: t.surfaceMuted, color: t.text },
                ]}
              />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {currentHouse.memberCount
                  ? tr('house.members.edit.capacityWithCurrent', { n: currentHouse.memberCount })
                  : tr('house.members.edit.capacity')}
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
                          ? toast(tr('house.members.edit.capacityTooSmall'), 'error')
                          : setEditMax(n)
                      }
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: tooSmall }}
                      accessibilityLabel={tr('house.members.edit.capacityOptionA11y', { n })}
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
              {/* 공개 범위 (#1266) — 서버가 현재 값을 안 주면 둘 다 미선택으로 열린다. */}
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {tr('house.members.edit.visibility')}
              </Text>
              <View style={styles.privacyRow}>
                <PrivacyCard
                  selected={editPublic === true}
                  accent={t.primary}
                  title={tr('house.members.edit.public')}
                  subtitle={tr('house.members.edit.publicHint')}
                  onPress={() => setEditPublic(true)}
                  t={t}
                />
                <PrivacyCard
                  selected={editPublic === false}
                  accent={HOUSE_PRIVATE_ACCENT}
                  title={tr('house.members.edit.private')}
                  subtitle={tr('house.members.edit.privateHint')}
                  onPress={() => setEditPublic(false)}
                  t={t}
                />
              </View>
              {/* 온보딩 자동 입주 허용 (#1407) — 공개 집에만 실제 적용된다. */}
              <View style={styles.autoJoinRow}>
                <View style={styles.autoJoinCopy}>
                  <Text style={[Typography.body, { color: t.text }]}>
                    {tr('house.members.edit.autoJoin')}
                  </Text>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    {editPublic === false
                      ? tr('house.members.edit.autoJoinPrivateHint')
                      : tr('house.members.edit.autoJoinHint')}
                  </Text>
                </View>
                <ToggleSwitch
                  value={editAutoJoin ?? autoJoinEnabled ?? false}
                  onToggle={() => setEditAutoJoin(!(editAutoJoin ?? autoJoinEnabled ?? false))}
                  accessibilityLabel={tr('house.members.edit.autoJoinA11y')}
                />
              </View>
              {covers.length > 0 ? (
                <>
                  {/* 커버는 집의 겉모습 자체라 "집 테마"로 (#1112). */}
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    {tr('house.members.edit.theme')}
                  </Text>
                  <HouseCoverPicker
                    covers={covers}
                    selectedKey={editCover}
                    maxMembers={editMax}
                    onSelect={setEditCover}
                  />
                </>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowEditHouse(false)}
                accessibilityRole="button"
                accessibilityLabel={tr('house.members.edit.cancelA11y')}
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>{tr('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={submitEditHouse}
                accessibilityRole="button"
                accessibilityState={{ disabled: !editNameValid }}
                accessibilityLabel={tr('house.members.edit.saveA11y')}
                style={[
                  styles.modalBtn,
                  { backgroundColor: editNameValid ? t.primary : t.disabledBg },
                ]}>
                <Text
                  style={[Typography.label, { color: editNameValid ? t.onPrimary : t.textMuted }]}>
                  {tr('house.members.edit.save')}
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
  privacyRow: { flexDirection: 'row', gap: Spacing.two },
  autoJoinRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  autoJoinCopy: { flex: 1, gap: Spacing.one },
  capacityBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
