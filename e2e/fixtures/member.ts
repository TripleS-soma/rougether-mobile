import type {
  CharacterItem,
  GoalItem,
  MeResponse,
  MyCharacterItem,
  OnboardingResponse,
  WalletResponse,
} from '../../src/api/types';
import { E2E_USER_ID, type List, NOW_ISO } from './common';

const me = {
  userId: E2E_USER_ID,
  nickname: '테스트',
  bio: '',
  lastAccessedAt: NOW_ISO,
  onboarding: { completed: true, primaryGoalId: 1, selectedCharacterId: 1 },
  language: 'ko',
  timeZone: 'Asia/Seoul',
} satisfies MeResponse;

const goals = [
  { id: 1, code: 'HEALTH', name: '건강', sortOrder: 1 },
  { id: 2, code: 'STUDY', name: '공부', sortOrder: 2 },
] satisfies GoalItem[];

const characters = [
  { id: 1, code: 'cat', name: '고양이', baseAssetKey: 'characters/cat.png', sortOrder: 1 },
] satisfies CharacterItem[];

/** 회원 — 사용자 1명(닉네임 `테스트`), 온보딩 완료. */
export const MEMBER_FIXTURES = {
  'GET /me': me,
  'PATCH /me': me,
  'GET /me/wallets': {
    items: [
      { currencyType: 'COIN', balance: 1200 },
      { currencyType: 'DIAMOND', balance: 30 },
    ],
  } satisfies List<WalletResponse>,
  'GET /me/characters': {
    items: [
      {
        userCharacterId: 1,
        characterId: 1,
        code: 'cat',
        name: '고양이',
        baseAssetKey: 'characters/cat.png',
        selected: true,
        accessories: [],
        acquiredAt: NOW_ISO,
      },
    ],
  } satisfies List<MyCharacterItem>,
  'GET /onboarding': {
    goals: [{ goalId: 1, code: 'HEALTH', name: '건강' }],
    primaryGoalId: 1,
    selectedCharacterId: 1,
    completed: true,
  } satisfies OnboardingResponse,
  'GET /goals': { items: goals } satisfies List<GoalItem>,
  'GET /characters': { items: characters } satisfies List<CharacterItem>,
};
