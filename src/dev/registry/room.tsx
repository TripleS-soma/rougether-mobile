import { StarterSpeakerPreview } from '@/dev/starter-speaker-preview';
import { SpeakerPreview } from '@/dev/speaker-preview';
import { useState } from 'react';
import { View } from 'react-native';
import { Room } from '@/components/room/room';
import { FriendRoomScreen } from '@/components/screens/friend-room-screen';
import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { MarketAssetScreen } from '@/components/screens/market-asset-screen';
import { MarketOrdersScreen } from '@/components/screens/market-orders-screen';
import { MarketScreen } from '@/components/screens/market-screen';
import { MarketList } from '@/components/screens/market/market-list';
import { MarketIssueSheet } from '@/components/screens/market/market-issue-sheet';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { RoomGrowthPill } from '@/components/ui/room-growth-pill';
import { RoomQuickTodoPreview } from '@/dev/todo-compose-preview';
import { Button } from '@/components/ui/button';
import { FurnitureStudioScreen } from '@/components/screens/furniture-studio-screen';
import { FriendWeekStrip } from '@/components/screens/house/friend-week-strip';
import { shiftIso, todayIso } from '@/utils/datetime';
import {
  DEMO_MARKET_ASSET,
  DEMO_MARKET_ASSETS,
  DEMO_MARKET_ORDERS,
  DEMO_MARKET_TRADES,
} from '@/mocks/fixtures';
import { RoomRenderReference } from '@/dev/room-render-reference';
import { MinigamePreview, MINIGAME_PREVIEW_CATALOG } from '@/dev/minigame-preview';
import { MinigamesScreen } from '@/components/screens/minigames-screen';
import { MinigameRunnerScreen } from '@/components/screens/minigame-runner-screen';
import { MinigameLeaderboardScreen } from '@/components/screens/minigame-leaderboard-screen';
import type { GalleryEntry } from '@/dev/registry/types';

/** 친구 방 주간 날짜 줄 데모 (#1423) — 날짜를 누르거나 주를 넘겨 본다. */
function FriendWeekStripDemo() {
  const today = todayIso();
  const [selected, setSelected] = useState(today);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <FriendWeekStrip
        selected={selected}
        today={today}
        onSelect={setSelected}
        doneCounts={{
          [today]: 2,
          [shiftIso(today, -1)]: 1,
          [shiftIso(today, -3)]: 3,
          [shiftIso(today, -8)]: 1,
        }}
      />
    </View>
  );
}

/** 발행 시트 열기 버튼 (#1427). */
function MarketIssueSheetDemo() {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch', minHeight: 120 }}>
      <Button label="거래소에 올리기" onPress={() => setVisible(true)} />
      <MarketIssueSheet
        visible={visible}
        onSubmit={() => setVisible(false)}
        onClose={() => setVisible(false)}
      />
    </View>
  );
}

export const roomEntries: GalleryEntry[] = [
  {
    name: 'StarterSpeakerPreview',
    description: '온보딩 스피커 뽑기와 직접 배치 (API 호출 없음)',
    render: () => <StarterSpeakerPreview />,
  },
  {
    name: 'SpeakerPreview',
    description: '첫 가구 스피커 · 애니메이션 · 배경음 4종 · 볼륨 · 실제 재생 (API 호출 없음)',
    render: () => <SpeakerPreview />,
  },
  {
    name: 'MinigamesPreview',
    description:
      '개발 미리보기 전용 3종 카탈로그 → 러너·계단·합치기 연습 → 빈 랭킹. API 기록 없음 (#1302).',
    render: () => <MinigamePreview />,
  },
  {
    name: 'CatStairsPreview',
    description: '고양이 계단 연습 미리보기. 좌우 방향 조작, 실제 랭킹 미기록.',
    render: () => <MinigamePreview initialGameCode="cat-stairs" />,
  },
  {
    name: 'CatMergePreview',
    description: '고양이 합치기 연습 미리보기. 4×4 타일 퍼즐, 실제 랭킹 미기록.',
    render: () => <MinigamePreview initialGameCode="cat-merge" />,
  },
  {
    name: 'MinigamesScreen',
    description: '샘플 카탈로그 미리보기. 실제 서비스는 API에서 게임 목록을 받아요.',
    render: () => <MinigamesScreen games={MINIGAME_PREVIEW_CATALOG} />,
  },
  {
    name: 'MinigameRunnerScreen',
    description: '루틴 러너 시작 화면 미리보기.',
    render: () => <MinigameRunnerScreen />,
  },
  {
    name: 'MinigameLeaderboardScreen',
    description: '샘플 랭킹 미리보기. 아래 닉네임과 점수는 실제 유저 데이터가 아니에요.',
    render: () => (
      <MinigameLeaderboardScreen
        leaderboard={{
          items: [
            { rank: 1, userId: 1, nickname: '샘플 고양이', score: 320 },
            { rank: 1, userId: 2, nickname: '샘플 친구', score: 320 },
            { rank: 3, userId: 3, nickname: '샘플 나', score: 150 },
          ],
          myEntry: { rank: 3, userId: 3, nickname: '샘플 나', score: 150 },
          totalPlayers: 3,
        }}
      />
    ),
  },
  {
    name: 'MinigamesUnavailable',
    description: '게임 목록 API 실패 미리보기. 랭킹 미기록 연습 진입이 분리돼요.',
    render: () => (
      <MinigamesScreen
        error
        practiceGames={MINIGAME_PREVIEW_CATALOG}
        onRetry={() => {}}
        onPractice={() => {}}
      />
    ),
  },
  {
    name: 'MoruRoom',
    description: '레벨 5 보상 모루. 캐릭터를 누르면 대기·인사·기쁨·눕기를 순환합니다.',
    render: () => (
      <View style={{ flex: 1, minHeight: 720 }}>
        <MyRoomScreen
          userName="모루의 친구"
          characterId="moru"
          characterFrames={['idle', 'wave', 'pose-cycle', 'lying'].map(
            (motion) => `characters/moru/animations/${motion}.webp`,
          )}
          routines={[]}
        />
      </View>
    ),
  },
  {
    name: 'FurnitureStudio',
    description: '7일 출석 생성권으로 사진 속 가구 만들기 (#1173).',
    render: () => (
      <FurnitureStudioScreen
        balance={{ available: 1, reserved: 0 }}
        jobs={[]}
        photo={null}
        onAttendance={() => {}}
      />
    ),
  },
  {
    name: 'Room · renderer contract v2 reference',
    description: '가로:세로 1:1.2 캔버스 · 폭 기준 가구·캐릭터 · 여름 바다 CDN fixture.',
    render: () => <RoomRenderReference />,
  },
  {
    name: 'Room · default',
    description: 'Room renderer — wallpaper + slot-placed furniture (dummy resources) + character.',
    render: () => (
      <View style={{ width: 280, alignSelf: 'center' }}>
        <Room />
      </View>
    ),
  },
  {
    name: 'Room · CDN character poses',
    description:
      'Server poses[] art in registration order — tap the character to cycle (#263, #735).',
    render: () => (
      <View style={{ width: 280, alignSelf: 'center' }}>
        <Room
          characterId="panda"
          characterFrames={[
            'characters/panda/animations/idle.webp',
            'characters/panda/animations/pose-cycle.webp',
            'characters/panda/animations/wave.webp',
          ]}
          interactiveCharacter
        />
      </View>
    ),
  },
  {
    name: 'Room · hanok theme',
    description: 'Same renderer, hanok furniture + tiger character.',
    render: () => (
      <View style={{ width: 280, alignSelf: 'center' }}>
        <Room wallpaperId="hanok-simple" characterId="tiger" />
      </View>
    ),
  },
  {
    name: 'MyRoomScreen',
    description:
      'Ported from the prototype MyRoomZoomScreen (#7): room view + today’s routines + reward.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <RoomQuickTodoPreview />
      </View>
    ),
  },
  {
    name: 'RoomDecorScreen',
    description:
      'Ported from the prototype RoomDecorScreen (#8): live room preview + wallpaper/furniture catalog.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <RoomDecorScreen />
      </View>
    ),
  },
  {
    name: 'FriendRoomScreen',
    description:
      'Ported from the prototype FriendRoomScreen (#9): read-only room + routines + cheers.',
    render: () => (
      <View style={{ height: 860, alignSelf: 'stretch' }}>
        <FriendRoomScreen friendName="민지" />
      </View>
    ),
  },
  {
    name: 'MarketList',
    description:
      '가구 거래소 목록 (#1427, MARKET_ENABLED로 숨김) — 거래소 화면 안 카드 격자: 그림·이름·제작자(탈퇴 시 탈퇴한 회원)·최저 판매가/판매 대기 없음·최근 거래가, 내 주문·새로고침. 로컬 픽스처.',
    render: () => <MarketList assets={DEMO_MARKET_ASSETS} hasNext />,
  },
  {
    name: 'MarketScreen',
    description:
      '가구 거래소 화면 (#1502) — 방 화면 전체 메뉴(≡)에서 여는 독립 화면: 헤더(뒤로·코인), 판매 중 N개 · 내 주문 보기, 목록. 로컬 픽스처.',
    render: () => (
      <View style={{ height: 640 }}>
        <MarketScreen assets={DEMO_MARKET_ASSETS} hasNext coinBalance={1200} sellingCount={2} />
      </View>
    ),
  },
  {
    name: 'MarketAssetScreen',
    description:
      '거래소 가구 상세 (#1427): 그림·제작자·발행 수·최저 판매가·최근 거래가, 구매하기/판매하기/발행 재고 판매(보유·제작자 여부로), 호가 위 3단계, 최근 거래, 신고하기(onReport 있을 때만). 버튼을 누르면 주문 시트(가격 1~1,000·예상 수령액). 로컬 픽스처.',
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <MarketAssetScreen
          asset={{ ...DEMO_MARKET_ASSET, owned: true, isCreator: true }}
          trades={DEMO_MARKET_TRADES}
          coinBalance={120}
          onPlaceOrder={() => true}
          onReport={() => true}
        />
      </View>
    ),
  },
  {
    name: 'MarketOrdersScreen',
    description:
      '거래소 내 주문 (#1427): 대기 중/완료 탭, 행(그림·이름·구매/판매·가격·체결 수량·상태·만료까지), 대기 중은 확인 후 취소. 로컬 픽스처.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <MarketOrdersScreen orders={DEMO_MARKET_ORDERS} onCancel={() => {}} />
      </View>
    ),
  },
  {
    name: 'MarketIssueSheet',
    description:
      '거래소에 올리기 (#1427) — AI 가구 스튜디오의 발행 시트: 발행 수량 1~10, 추가 발행·재검수 불가 안내.',
    render: () => <MarketIssueSheetDemo />,
  },
  {
    name: 'FriendWeekStrip',
    description: '친구 방 주간 날짜 줄 — 날짜별 완료 점, 누르면 그날 목록 (#1423).',
    render: () => <FriendWeekStripDemo />,
  },
  {
    name: 'RoomGrowthPill',
    description: '나의 방 왼쪽 상단 Liquid Glass 레벨 배지.',
    render: () => <RoomGrowthPill growthLevel={2} growthPoints={50} pointsToNextLevel={16} />,
  },
];
