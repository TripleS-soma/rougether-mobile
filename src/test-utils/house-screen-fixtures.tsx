import { Pressable } from 'react-native';

import type { House } from '@/components/screens/house-screen';
import { useBrandTheme } from '@/hooks/use-tokens';

/** 집 화면 테스트 공용 — house-screen.*.test.tsx가 나눠 쓴다. */
export function BackgroundModeControl() {
  const { setMode } = useBrandTheme();
  return (
    <>
      <Pressable accessibilityLabel="test-dark-mode" onPress={() => setMode('dark')} />
      <Pressable accessibilityLabel="test-light-mode" onPress={() => setMode('light')} />
    </>
  );
}

export const MISSION_HOUSE: House = {
  houseId: 7,
  name: '실집',
  myRole: 'OWNER',
  description: '아침 루틴 집',
  maxMembers: 4,
  memberCount: 2,
  floors: [
    {
      level: '1층',
      rooms: [
        { name: '친구', color: '#F5E1D8', membershipId: 42 },
        { name: '나', color: '#E8E0D0', isMine: true, membershipId: 43 },
      ],
    },
  ],
  missions: [
    { id: 11, title: '주간 루틴 지키기', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 3, target: 10, status: 'ACTIVE' }, // prettier-ignore
    { id: 12, title: '기상 인증 모으기', desc: '일일 구성원 달성률', icon: 'sun' as const, current: 8, target: 8, status: 'ACTIVE', achieved: true }, // prettier-ignore
    { id: 13, title: '지난 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 5, target: 5, status: 'COMPLETED', achieved: true }, // prettier-ignore
  ],
};
