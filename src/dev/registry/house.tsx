import { HouseDioramaDemo } from '@/dev/house-diorama-demo';
import {
  HouseFeedComposeDemo,
  HouseFeedListDemo,
  HouseFeedOwnerPostDemo,
  HouseFeedRailDemo,
  HouseNotificationSheetDemo,
} from '@/dev/house-feed-demo';
import { FeedAuthorHouseSheet } from '@/components/feed/feed-author-house-sheet';
import type { FeedAuthorHouse } from '@/api/feed-houses';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { type HouseCover, HouseCoverPicker } from '@/components/room/house-cover-picker';
import { HouseOrderDots } from '@/components/room/house-order-dots';
import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import { StackedHouseDemo } from '@/dev/stacked-house-demo';
import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { HouseMissionsScreen } from '@/components/screens/house-missions-screen';
import { HouseChatScreen } from '@/components/screens/house-chat-screen';
import { HouseMembersScreen } from '@/components/screens/house-members-screen';
import { manageableMembers } from '@/components/screens/house/members';
import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { InviteFriendsScreen } from '@/components/screens/invite-friends-screen';
import { InviteArrivalSheet } from '@/components/screens/sheets/invite-arrival-sheet';
import { InvitePasteSheet } from '@/components/screens/sheets/invite-paste-sheet';
import { parseInviteText } from '@/lib/invite-code';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { RECOMMENDED_HOUSES } from '@/mocks/fixtures';
import type { GalleryEntry } from '@/dev/registry/types';

function FeedAuthorHouseDemo() {
  const [open, setOpen] = useState(false);
  const home: FeedAuthorHouse = {
    houseId: 1,
    name: '함께하는 비공개 집',
    coverImageKey: null,
    level: 1,
    displayMode: 'DIORAMA',
    isPublic: false,
    requiresApproval: true,
    currentMemberCount: 2,
    maxMembers: 4,
    isMember: false,
    isFull: false,
    myMembershipStatus: null,
    myJoinRequestStatus: null,
    canJoin: true,
  };
  return (
    <View>
      <ScalePressable accessibilityRole="button" onPress={() => setOpen(true)}>
        <Text>작성자의 집 선택 열기</Text>
      </ScalePressable>
      <FeedAuthorHouseSheet
        visible={open}
        houses={[
          home,
          { ...home, houseId: 2, name: '바로 입주 가능한 집', requiresApproval: false },
        ]}
        onClose={() => setOpen(false)}
        onJoin={() => setOpen(false)}
      />
    </View>
  );
}

/** 친구 초대 확인 시트 데모 (#1007). */
function InviteArrivalSheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>친구 초대 확인 열기</Text>
      </ScalePressable>
      <InviteArrivalSheet
        visible={open}
        preview={{
          code: 'ROUGE123',
          inviterNickname: '소마',
          rewardCoin: 50,
          alreadyRedeemed: false,
        }}
        onAccept={() => setOpen(false)}
        onLater={() => setOpen(false)}
      />
    </View>
  );
}

/** 붙여넣기 시트 데모 (#1007) — 붙여넣은 글을 실제 판정기로 돌려 결과를 보여 준다. */
function InvitePasteSheetDemo() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => {
          setError(null);
          setOpen(true);
        }}
        style={{ padding: 8 }}>
        <Text>붙여넣기 시트 열기</Text>
      </ScalePressable>
      {result ? <Text>{result}</Text> : null}
      <InvitePasteSheet
        visible={open}
        error={error}
        onPaste={(text) => {
          const parsed = parseInviteText(text);
          if (!parsed) {
            setError('초대코드를 찾지 못했어요.');
            return;
          }
          setResult(`${parsed.kind} · ${parsed.code}`);
          setOpen(false);
        }}
        onDismiss={() => setOpen(false)}
      />
    </View>
  );
}

/** Server cover catalog snapshot (2026-07-15) for gallery/preview use. */
const SAMPLE_HOUSE_COVERS: HouseCover[] = [
  {
    code: 'cloud_balloon',
    name: '구름 풍선 집',
    coverImageKey: 'house/cloud-balloon/house-unified-cloud-balloon-frame.png',
  },
  {
    code: 'coral_aquarium',
    name: '산호 수족관 집',
    coverImageKey: 'house/coral-aquarium/house-unified-coral-aquarium-frame.png',
  },
  {
    code: 'mushroom_forest',
    name: '버섯 숲 집',
    coverImageKey: 'house/mushroom-forest/house-unified-mushroom-forest-frame.png',
  },
  {
    code: 'night_observatory',
    name: '밤의 천문대 집',
    coverImageKey: 'house/night-observatory/house-unified-night-observatory-frame-v3.png',
  },
];

/** Interactive cover grid — tap to move the selection ring. */
function HouseCoverPickerDemo() {
  const [selected, setSelected] = useState<string | undefined>(
    SAMPLE_HOUSE_COVERS[0].coverImageKey,
  );
  return (
    <HouseCoverPicker covers={SAMPLE_HOUSE_COVERS} selectedKey={selected} onSelect={setSelected} />
  );
}

export const houseEntries: GalleryEntry[] = [
  {
    name: 'HouseFeedRail',
    description: "집 피드 진입점 — 집 화면 레일의 채팅 아래 '집 피드'. 새 글 배지는 없다.",
    render: () => <HouseFeedRailDemo />,
  },
  {
    name: 'HouseFeedList',
    description:
      '집 피드 목록 — 작성자를 앞세운 줄(아바타·이름·방장 배지), 전체·자유·인증 탭, 종 버튼으로 이 집 알림 시트. 픽스처라 서버에 쓰지 않는다.',
    render: () => <HouseFeedListDemo />,
  },
  {
    name: 'HouseFeedListEmpty',
    description: '집 피드 빈 상태(인증 탭) — 게시판별 문구.',
    render: () => <HouseFeedListDemo empty />,
  },
  {
    name: 'FeedComposeScope',
    description:
      '공개 피드 글쓰기의 올릴 곳 — 기본 전체 공개, 줄을 눌러 내 집 중 하나를 고르면 그 집 구성원만 본다.',
    render: () => <HouseFeedComposeDemo />,
  },
  {
    name: 'HouseFeedCompose',
    description: '집 피드에서 연 글쓰기 — 올릴 곳이 그 집으로 고정되고 안내만 보인다.',
    render: () => <HouseFeedComposeDemo locked />,
  },
  {
    name: 'HouseFeedOwnerPost',
    description:
      '방장이 보는 남의 글 — 더보기(⋮)에 게시물 삭제·신고·차단, 남의 댓글 더보기에 댓글 삭제(서버 deletable).',
    render: () => <HouseFeedOwnerPostDemo />,
  },
  {
    name: 'HouseFeedMemberPost',
    description: '일반 구성원이 보는 남의 글 — 더보기에 신고·차단만.',
    render: () => <HouseFeedOwnerPostDemo owner={false} />,
  },
  {
    name: 'HouseLeaveConfirm',
    description:
      "집 나가기 확인 — 피드가 켜진 설치본은 '이 집의 내 글·댓글도 지우기'를 고를 수 있다(기본 꺼짐). 아래 '집 나가기'를 눌러 연다. 더미 집이라 서버에 쓰지 않는다.",
    render: () => {
      const demoHouse: House = {
        houseId: 3,
        name: '아침을 여는 집',
        myRole: 'MEMBER',
        maxMembers: 4,
        floors: [
          {
            level: '1층',
            rooms: [
              { name: '솜이', color: '#F5E1D8', membershipId: 42, isOwner: true },
              { name: '나', color: '#E8E0D0', isMine: true, membershipId: 43 },
            ],
          },
        ],
      };
      return (
        <View style={{ height: 760, alignSelf: 'stretch' }}>
          <HouseMembersScreen
            house={demoHouse}
            members={manageableMembers(demoHouse)}
            isOwner={false}
            isKicked={() => false}
            memberCharacterId={(m) => (m.isMine ? 'tiger' : 'cat')}
            onBack={() => {}}
            onLocalKick={() => {}}
            onLeaveHouse={() => {}}
            feedCleanupOption
            onLeaveDone={() => {}}
          />
        </View>
      );
    },
  },
  {
    name: 'HouseNotificationSheet',
    description:
      '이 집 알림 시트 — 채팅·자유글·인증글 푸시. 서버에 글 알림 설정이 아직 없으면 두 줄을 잠그고 안내한다.',
    render: () => <HouseNotificationSheetDemo />,
  },
  {
    name: 'FeedAuthorHouseSheet',
    description: '게시물 작성자의 집 선택, 입주 신청과 바로 입주 설정 구분',
    render: () => <FeedAuthorHouseDemo />,
  },
  {
    name: 'HouseDioramaRenewal',
    description: '공동 공간 6종 · 실제 앱 에셋 · 가구 없음 · 별채 · 방 방문/자리 이동',
    render: () => <HouseDioramaDemo />,
  },
  {
    name: 'HouseSixSeatViewport',
    description: '6인 집 최초 구도 · viewport=1로 화면 전체와 안전영역 검증 (#1163).',
    render: () => <StackedHouseDemo viewportOnly />,
  },
  {
    name: 'StackedHouseFrames',
    description: '세로형 집 11테마 · 2/3/4/6인 · 기존형 복귀 · 방 방문/자리 교환 검증 (#1077).',
    render: () => <StackedHouseDemo />,
  },
  {
    name: 'HousePreviewFrame · 기본 프레임 (커버 없음)',
    description: '집 탐색 미리보기 (#328) — 커버 없는 집은 기본 프레임 PNG로 폴백, 멤버 2/4.',
    render: () => (
      <View style={{ width: 280, alignSelf: 'center' }}>
        <HousePreviewFrame memberCount={2} name="데모 집" />
      </View>
    ),
  },
  {
    name: 'InviteArrivalSheet · 친구 초대 확인',
    description:
      '링크·붙여넣기로 들어온 친구 초대코드 확인 (#1007) — 초대자·받을 코인을 보여 주고 [받기]에서만 사용한다(자동 사용 금지).',
    render: () => <InviteArrivalSheetDemo />,
  },
  {
    name: 'InvitePasteSheet · 초대받아 오셨나요?',
    description:
      '온보딩 직후 1회 붙여넣기 (#1007) — iOS 16+는 시스템 붙여넣기 버튼(허용 팝업 없음). 갤러리에서는 붙여넣은 글의 판정 결과를 보여 준다.',
    render: () => <InvitePasteSheetDemo />,
  },
  {
    name: 'InviteFriendsScreen',
    description: '친구 초대 (#518): 내 초대코드 복사 + 보상 현황 + 받은 코드 사용.',
    render: () => (
      <InviteFriendsScreen
        info={{
          code: 'ROUGE123',
          rewardedCount: 2,
          maxRewardedCount: 10,
          inviterRewardCoin: 50,
          inviteeRewardCoin: 30,
        }}
        onRedeem={async () => ({ rewardCoin: 30 })}
      />
    ),
  },
  {
    name: 'HouseScreen',
    description:
      'Ported from the prototype HouseScreen (#10): house switcher, member rooms, 공동 미션 요약 줄. 구성원 관리·공동 미션은 셸 화면으로 승격(#753·#875) — 아래 항목에서 미리보기.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        {/* onOpenMissions를 배선해야 요약 줄이 그려진다 (#875). */}
        <HouseScreen onOpenMissions={() => {}} />
      </View>
    ),
  },
  {
    name: 'HouseMissionsScreen',
    description:
      '집 → 공동 미션 (#875에서 모달 → 셸 화면으로 승격): 미션 목록·진행률, 보상 수령, 만들기 폼(유형별 목표 상한·단위 #872).',
    render: () => {
      const demoHouse: House = {
        houseId: 7,
        name: '데모 하우스',
        myRole: 'OWNER',
        maxMembers: 4,
        memberCount: 2,
        floors: [],
        missions: [
          { id: 11, title: '주간 루틴 지키기', desc: '주간 구성원 달성 횟수', icon: 'calendar', current: 3, target: 10, status: 'ACTIVE' }, // prettier-ignore
          { id: 12, title: '기상 인증 모으기', desc: '일일 구성원 달성률', icon: 'sun', current: 80, target: 80, status: 'ACTIVE', achieved: true }, // prettier-ignore
          { id: 13, title: '지난 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar', current: 5, target: 5, status: 'COMPLETED', achieved: true }, // prettier-ignore
        ],
      };
      return (
        <View style={{ height: 900, alignSelf: 'stretch' }}>
          <HouseMissionsScreen
            house={demoHouse}
            missions={demoHouse.missions ?? []}
            isOwner
            onBack={() => {}}
            onCreateMission={() => {}}
            onDeleteMission={() => {}}
            onClaimMission={() => {}}
            onAddMissionRoutine={() => {}}
          />
        </View>
      );
    },
  },
  {
    name: 'HouseChatScreen',
    description:
      '집 → 채팅 (#1408): 내 말풍선(오른쪽)·다른 구성원(왼쪽·닉네임), 안 읽은 수, 보내는 중·실패 상태. 픽스처라 서버에 쓰지 않는다.',
    render: () => (
      <View style={{ height: 700, alignSelf: 'stretch' }}>
        <HouseChatScreen
          houseName="데모 하우스"
          myUserId={1}
          messages={[
            { key: 's1', sequence: 1, senderUserId: 2, senderNickname: '이웃', content: '오늘 루틴 다들 했어요?', createdAt: '2026-09-21T12:58:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
            { key: 's2', sequence: 2, senderUserId: 2, senderNickname: '이웃', content: '저는 아침 스트레칭 완료!', createdAt: '2026-09-21T12:59:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
            { key: 's3', sequence: 3, senderUserId: 1, senderNickname: '나', content: '저도 방금 끝냈어요 🙌', createdAt: '2026-09-21T13:00:00Z', unreadCount: 2, status: 'sent' }, // prettier-ignore
            {
              key: 'photo',
              senderUserId: 1,
              content: '',
              localImageUri:
                'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22320%22%3E%3Crect fill=%22%23e8eedf%22 width=%22320%22 height=%22320%22/%3E%3Cpath fill=%22%2392ac75%22 d=%22M0 280L100 140L170 220L240 110L320 280Z%22/%3E%3Ccircle fill=%22%23edc66e%22 cx=%2270%22 cy=%2270%22 r=%2230%22/%3E%3C/svg%3E',
              unreadCount: 2,
              status: 'sent',
            },
            { key: 'cA', clientMessageId: 'A', senderUserId: 1, content: '내일도 같이 해요', unreadCount: 0, status: 'pending' }, // prettier-ignore
            { key: 'cB', clientMessageId: 'B', senderUserId: 1, content: '전송 실패 예시', unreadCount: 0, status: 'failed' }, // prettier-ignore
          ]}
          onSend={() => {}}
          onPickPhoto={() => {}}
          onReport={() => {}}
          onRetrySend={() => {}}
          onVisible={() => {}}
          onBack={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'HouseMembersScreen',
    description:
      '집 → 구성원 관리 (#753에서 셸 화면으로 승격): 초대코드, 방장 도구, 강퇴(더미 집이라 로컬 강퇴 플로우).',
    render: () => {
      const demoHouse: House = {
        name: '데모 하우스',
        myRole: 'OWNER',
        maxMembers: 4,
        floors: [
          {
            level: '1층',
            rooms: [
              { name: '친구', color: '#F5E1D8', membershipId: 42 },
              { name: '나', color: '#E8E0D0', isMine: true, isOwner: true, membershipId: 43 },
            ],
          },
        ],
      };
      return (
        <View style={{ height: 900, alignSelf: 'stretch' }}>
          <HouseMembersScreen
            house={demoHouse}
            members={manageableMembers(demoHouse)}
            isOwner
            isKicked={() => false}
            memberCharacterId={(m) => (m.isMine ? 'tiger' : 'cat')}
            onBack={() => {}}
            onLocalKick={() => {}}
            onLeaveDone={() => {}}
          />
        </View>
      );
    },
  },
  {
    name: 'HouseOrderDots · 집 순서 인디케이터',
    description:
      '꾹 누르면 도트가 이름표 줄로 펼쳐지고 좌우로 끌어 순서를 바꾼다 (#820). 마지막 도트는 승인 대기 페이지라 정렬에서 빠진다.',
    render: () => (
      <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 12 }}>
        <HouseOrderDots
          houses={[
            { houseId: 1, name: 'TripleS' },
            { houseId: 2, name: '우리집' },
            { houseId: 3, name: '스터디방' },
          ]}
          pendingCount={1}
          index={0}
          onReorder={(ids) => console.log('reorder', ids)}
        />
        <Text>↑ 꾹 눌러 좌우로 끌어보세요 (대기 페이지 도트 1개 포함)</Text>
      </View>
    ),
  },
  {
    name: 'HouseSearchScreen',
    description:
      'Ported from the prototype HouseSearchScreen (#11): invite code + recommended list.',
    render: () => (
      <View style={{ height: 760, alignSelf: 'stretch' }}>
        <HouseSearchScreen houses={RECOMMENDED_HOUSES} />
      </View>
    ),
  },
  {
    name: 'CreateHouseScreen',
    description:
      'Ported from the prototype CreateHouseScreen (#12): preview, theme, capacity, code.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <CreateHouseScreen covers={SAMPLE_HOUSE_COVERS} />
      </View>
    ),
  },
  {
    name: 'HouseCoverPicker',
    description:
      '집 테마(커버) 선택 그리드 — 서버 커버 카탈로그(GET /houses/cover-images) (#261, 문구 #1112).',
    render: () => <HouseCoverPickerDemo />,
  },
];
