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
    expect(tutorialCoachStep('invite-house', 'houseMembers')?.target).toBe('house-invite-share');
  });

  it('집이 없어 집 탐색으로 간 동안은 초대 미션 코치마크를 접는다', () => {
    expect(tutorialCoachStep('invite-house', 'houseSearch', { noHouses: true })).toBeNull();
    expect(tutorialCoachStep('invite-house', 'houseSearch', { noHouses: false })?.target).toBe(
      'nav-house',
    );
  });
});
