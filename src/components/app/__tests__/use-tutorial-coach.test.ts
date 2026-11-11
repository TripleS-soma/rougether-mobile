import { tutorialCoachStep } from '@/components/app/use-tutorial-coach';

describe('tutorialCoachStep (#1324)', () => {
  it('미션·화면마다 대상을 하나(또는 합집합)로 짚고, 흐름 밖 화면은 탭으로 돌려보낸다', () => {
    expect(tutorialCoachStep(undefined, 'myRoom')).toBeNull();
    expect(tutorialCoachStep('complete-routine', 'myRoom')?.target).toBe('room-routine-check');
    expect(tutorialCoachStep('complete-routine', 'gacha')?.target).toBe('nav-myRoom');
    expect(tutorialCoachStep('first-draw', 'myRoom')?.target).toBe('room-gacha');
    expect(tutorialCoachStep('first-draw', 'gacha')?.target).toBe('gacha-draw');
    expect(tutorialCoachStep('place-furniture', 'myRoom')?.target).toBe('room-decor');
    expect(tutorialCoachStep('place-furniture', 'decor')?.targets).toEqual([
      'decor-grid',
      'decor-apply',
    ]);
    expect(tutorialCoachStep('invite-house', 'myRoom')?.target).toBe('nav-house');
    expect(tutorialCoachStep('invite-house', 'house')?.target).toBe('house-manage');
    // 공유와 "지금은 혼자 할게요"를 함께 짚는다 (#1673).
    expect(tutorialCoachStep('invite-house', 'houseMembers')?.targets).toEqual([
      'house-invite-share',
      'house-invite-later',
    ]);
  });

  it('집이 없어 집 탐색으로 간 동안은 초대 미션 코치마크를 접는다', () => {
    expect(tutorialCoachStep('invite-house', 'houseSearch', { noHouses: true })).toBeNull();
    expect(tutorialCoachStep('invite-house', 'houseSearch', { noHouses: false })?.target).toBe(
      'nav-house',
    );
  });

  it('하단 탭이 없는 화면에서는 탭 대신 미션 배너를 짚는다 — 뽑기 직후 3번째 미션 (2026-11-11)', () => {
    const noNav = { navVisible: false, bannerVisible: true };
    // 뽑기를 마쳐 미션이 '가구 배치'로 넘어갔는데 아직 뽑기 화면 — 방 탭은 여기 없다.
    const coach = tutorialCoachStep('place-furniture', 'gacha', noNav);
    expect(coach?.target).toBe('mission-banner');
    expect(coach?.title).toBe('미션을 이어가요');
    expect(tutorialCoachStep('invite-house', 'decor', noNav)?.target).toBe('mission-banner');
    // 그 화면의 대상을 짚는 단계는 그대로다.
    expect(tutorialCoachStep('first-draw', 'gacha', noNav)?.target).toBe('gacha-draw');
    // 탭이 있는 화면은 지금처럼 탭을 짚는다.
    expect(
      tutorialCoachStep('place-furniture', 'house', { navVisible: true, bannerVisible: true })
        ?.target,
    ).toBe('nav-myRoom');
  });

  it('탭도 배너도 없는 화면에서는 잠그지 않는다 — 짚을 곳 없이 잠기면 빠져나올 수 없다', () => {
    expect(
      tutorialCoachStep('place-furniture', 'gacha', { navVisible: false, bannerVisible: false }),
    ).toBeNull();
  });
});
