import { StarterSpeakerPreview } from '@/dev/starter-speaker-preview';
import { SpeakerPreview } from '@/dev/speaker-preview';
import { useState } from 'react';
import { View } from 'react-native';
import { Room } from '@/components/room/room';
import { FriendRoomScreen } from '@/components/screens/friend-room-screen';
import {
  FixedPriceMarketScreen,
  FixedPriceListingScreen,
} from '@/components/screens/fixed-price-market-screen';
import { MarketIssueSheet } from '@/components/screens/market/market-issue-sheet';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { RoomGrowthPill } from '@/components/ui/room-growth-pill';
import { RoomQuickTodoPreview } from '@/dev/todo-compose-preview';
import { Button } from '@/components/ui/button';
import { FurnitureStudioScreen } from '@/components/screens/furniture-studio-screen';
import { FriendWeekStrip } from '@/components/screens/house/friend-week-strip';
import { shiftIso, todayIso } from '@/utils/datetime';
import { DEMO_MARKET_ASSET, DEMO_MARKET_ASSETS } from '@/mocks/fixtures';
import { RoomRenderReference } from '@/dev/room-render-reference';
import { MinigamePreview, MINIGAME_PREVIEW_CATALOG } from '@/dev/minigame-preview';
import { MinigamesScreen } from '@/components/screens/minigames-screen';
import { YarnGame } from '@/components/minigame/yarn-game';
import { MinigameRunnerScreen } from '@/components/screens/minigame-runner-screen';
import { MINIGAME_DEFINITIONS } from '@/constants/minigames';
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
      '개발 미리보기 전용 5종 카탈로그 → 러너·계단·합치기·탑 쌓기·털실 정리 연습 → 빈 랭킹. API 기록 없음 (#1302).',
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
    name: 'CatTowerPreview',
    description: '고양이 탑 쌓기 연습 미리보기. 탭으로 상자 떨어뜨리기, 실제 랭킹 미기록 (#1529).',
    render: () => <MinigamePreview initialGameCode="cat-tower" />,
  },
  {
    name: 'CatYarnPreview',
    description:
      '고양이 털실 정리 연습 미리보기. 더미 맨 위 털실을 탭해 같은 색 바구니로, 실제 랭킹 미기록.',
    render: () => <MinigamePreview initialGameCode="cat-yarn" />,
  },
  {
    name: 'CatYarnGame',
    description: '고양이 털실 정리 게임 문서 단독 미리보기(시드 42, 연습). 결과는 버린다.',
    render: () => <YarnGame seed={42} practice onFinish={() => {}} />,
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
    name: 'MinigameRunnerScreen · 규칙 카드',
    description:
      '게임을 처음 열 때(게임별·계정별 한 번) 시작 전 자리에 뜨는 규칙 카드 — 조작·점수·끝나는 때. [알겠어요]로 닫고 제목줄 ? 로 다시 봐요.',
    render: () => (
      <MinigameRunnerScreen
        gameName={MINIGAME_DEFINITIONS['cat-tower'].name}
        rules={MINIGAME_DEFINITIONS['cat-tower'].rules}
        showRules
        onDismissRules={() => {}}
        onOpenRules={() => {}}
      />
    ),
  },
  {
    name: 'MinigameRunnerScreen · 새 기록 자랑 제안',
    description:
      '랭킹전 새 최고 기록 + 그 게임 10판 이상 + 피드 켜짐일 때 결과 아래 "새 기록이에요! 피드에 기록을 자랑할까요?" [괜찮아요] / [자랑하기]. 판당 한 번(셸이 판정). 샘플 결과.',
    render: () => (
      <MinigameRunnerScreen
        gameName="고양이 탑 쌓기"
        finished
        game={<View />}
        result={{
          runId: 'demo-run-1',
          score: 1240,
          bestScore: 1240,
          personalBest: true,
          rank: 3,
          playCount: 12,
        }}
        sharePrompt
        onShareRecord={() => {}}
        onDismissShare={() => {}}
        onStart={() => {}}
        onPractice={() => {}}
      />
    ),
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
    name: 'FurnitureStudio',
    description: '출석 생성권 또는 100코인으로 사진 속 가구 만들기.',
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
    name: 'FurnitureStudioCoins',
    description: '생성권 없이 100코인으로 가구를 만드는 상태.',
    render: () => (
      <FurnitureStudioScreen
        balance={{ available: 0, reserved: 0 }}
        coinBalance={100}
        jobs={[]}
        photo={{ uri: 'https://placehold.co/300x300.png', name: 'chair.png', type: 'image/png' }}
      />
    ),
  },
  {
    name: 'FurnitureStudioHistory',
    description: '내 가구 탭 — 2열 타일·완성/실패 거르기·상세 시트 (#1666).',
    render: () => (
      <FurnitureStudioScreen
        balance={{ available: 1, reserved: 0 }}
        coinBalance={3200}
        photo={null}
        onGoToRoom={() => {}}
        onIssue={() => true}
        jobs={[
          {
            id: 'h1',
            status: 'SUCCEEDED',
            assetKey: 'items/furniture/chair.png',
            userItemId: 1,
            failureCode: null,
          },
          {
            id: 'h2',
            status: 'FAILED',
            assetKey: null,
            userItemId: null,
            failureCode: 'PHOTO_REJECTED',
          },
          {
            id: 'h3',
            status: 'SUCCEEDED',
            assetKey: 'items/furniture/sofa.png',
            userItemId: 3,
            failureCode: null,
          },
          {
            id: 'h4',
            status: 'FAILED',
            assetKey: 'items/furniture/lamp.png',
            userItemId: 4,
            failureCode: 'GENERATION_BUDGET_EXHAUSTED',
            reason: '배경에 흰 잔상이 남았어요.',
          },
          {
            id: 'h5',
            status: 'SUCCEEDED',
            assetKey: 'items/furniture/plant.png',
            userItemId: 5,
            failureCode: null,
          },
        ]}
      />
    ),
  },
  {
    name: 'FurnitureStudioFailures',
    description: '사진 거절·품질 검수·일시 오류의 사유와 재시도 안내 (#1503).',
    render: () => (
      <FurnitureStudioScreen
        balance={{ available: 2, reserved: 0 }}
        jobs={[
          {
            id: 'photo',
            status: 'FAILED',
            assetKey: null,
            userItemId: null,
            failureCode: 'PHOTO_REJECTED',
            reason: '여러 대상이 비슷하게 보여 만들 대상을 하나로 고르기 어려워요.',
          },
          {
            id: 'quality',
            status: 'FAILED',
            assetKey: null,
            userItemId: null,
            failureCode: 'GENERATION_BUDGET_EXHAUSTED',
            reason: '배경에 흰색 잔상이 남아 방에 놓기 어려워요.',
          },
          {
            id: 'temporary',
            status: 'FAILED',
            assetKey: null,
            userItemId: null,
            failureCode: 'PROVIDER_REQUEST_FAILED',
          },
        ]}
        photo={null}
        onChoosePhoto={() => {}}
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
        <FriendRoomScreen friendName="민지" friendBio="아침형 인간 도전 중 ☀️ 같이 해요!" />
      </View>
    ),
  },
  {
    name: 'FixedPriceMarketScreen',
    description:
      '고정가 가구 거래소. 제작자 가격으로 즉시 구매하며 수량 선택과 되팔기가 없음. 로컬 픽스처.',
    render: () => (
      <View style={{ height: 640 }}>
        <FixedPriceMarketScreen
          listings={DEMO_MARKET_ASSETS.map((a) => ({
            ...a,
            itemId: a.itemId ?? 1,
            isCreator: false,
            price: a.bestAskPrice ?? 30,
            selling: true,
            owned: false,
          }))}
          coinBalance={120}
        />
      </View>
    ),
  },
  {
    name: 'FixedPriceListingScreen',
    description:
      '제작자 판매 관리. 원본을 보관하면서 판매 가격을 바꾸거나 판매를 중지함. 로컬 픽스처.',
    render: () => (
      <View style={{ height: 720 }}>
        <FixedPriceListingScreen
          listing={{
            ...DEMO_MARKET_ASSET,
            itemId: 1,
            price: 30,
            selling: true,
            owned: true,
            isCreator: true,
          }}
          coinBalance={120}
        />
      </View>
    ),
  },
  {
    name: 'MarketIssueSheet',
    description: 'AI 가구 판매 등록: 판매 가격 설정, 원본 보관, 무제한 판매와 수수료 안내.',
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
