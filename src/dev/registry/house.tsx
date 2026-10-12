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
            { key: 'cA', clientMessageId: 'A', senderUserId: 1, content: '내일도 같이 해요', unreadCount: 0, status: 'pending' }, // prettier-ignore
            { key: 'cB', clientMessageId: 'B', senderUserId: 1, content: '전송 실패 예시', unreadCount: 0, status: 'failed' }, // prettier-ignore
          ]}
          onSend={() => {}}
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
