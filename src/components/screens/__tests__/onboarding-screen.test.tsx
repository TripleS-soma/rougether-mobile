import { act, fireEvent, render } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { OnboardingScreen, withRang } from '@/components/screens/onboarding-screen';
import { ToastProvider } from '@/components/ui/toast';

/**
 * 목표 설문까지 최단 경로 (#1023) — 예전엔 '건너뛰기' 한 번이면 됐지만 그
 * 버튼은 이제 다시 보기 진입에만 있다. 도트로 마지막 장에 가서 CTA를 누른다.
 */
async function goToGoalSurvey(ui: {
  getByText: (t: string) => unknown;
  getByLabelText: (t: string) => unknown;
}) {
  await fireEvent.press(ui.getByLabelText('5번째 슬라이드로 이동') as never);
  await fireEvent.press(ui.getByText('목표 선택하기') as never);
}

describe('OnboardingScreen', () => {
  it('renders the first welcome slide', async () => {
    const { getByText } = await render(<OnboardingScreen />);
    expect(getByText('루게더에 오신 걸 환영해요')).toBeTruthy();
  });

  // #1023 — 처음 온 사람은 소개를 지나칠 수 없다. 건너뛰기는 설정 → 튜토리얼
  // 다시 보기로 들어온 경우에만 붙고, 그때는 목표 설문이 아니라 앱으로 나간다.
  describe('건너뛰기는 다시 보기 진입에만 (#1023)', () => {
    it('첫 실행에는 건너뛰기가 없다', async () => {
      const { queryByText, getByText } = await render(<OnboardingScreen />);
      expect(queryByText('건너뛰기')).toBeNull();
      // 슬라이드 자체는 그대로 — 없어진 건 지름길뿐이다.
      expect(getByText('루게더에 오신 걸 환영해요')).toBeTruthy();
    });

    it('다시 보기면 건너뛰기가 보이고, 누르면 온보딩을 끝낸다', async () => {
      const onSkip = jest.fn();
      const onDone = jest.fn();
      const { getByText, queryByText } = await render(
        <OnboardingScreen replay onSkip={onSkip} onDone={onDone} />,
      );

      await fireEvent.press(getByText('건너뛰기'));

      expect(onSkip).toHaveBeenCalled();
      // 목표 설문으로 새지 않는다 — 예전 동작과 갈리는 지점.
      expect(queryByText('관심 있는 목표를 골라주세요')).toBeNull();
      // 저장 경로도 타지 않는다(목표·닉네임은 서버에 이미 있다).
      expect(onDone).not.toHaveBeenCalled();
    });

    it('마지막 장에서는 다시 보기여도 건너뛰기가 없다 (CTA가 그 자리)', async () => {
      const { getByLabelText, queryByText, getByText } = await render(
        <OnboardingScreen replay onSkip={jest.fn()} />,
      );
      await fireEvent.press(getByLabelText('5번째 슬라이드로 이동'));
      expect(queryByText('건너뛰기')).toBeNull();
      expect(getByText('목표 선택하기')).toBeTruthy();
    });
  });

  it('walks all five intro slides with the updated copy (#412)', async () => {
    const { getByText, getByLabelText } = await render(<OnboardingScreen />);
    // 5장 도트 — 마지막 장까지 존재.
    expect(getByLabelText('5번째 슬라이드로 이동')).toBeTruthy();
    await fireEvent.press(getByText('다음'));
    expect(getByText(/곰 체크로 완료해요/)).toBeTruthy();
    await fireEvent.press(getByText('다음'));
    expect(getByText(/내 방을 꾸며요/)).toBeTruthy();
    await fireEvent.press(getByText('다음'));
    expect(getByText(/한 집에서/)).toBeTruthy();
    await fireEvent.press(getByText('다음'));
    expect(getByText(/기록은 달력으로/)).toBeTruthy();
    // 마지막 장 CTA는 목표 선택으로 이어진다.
    await fireEvent.press(getByText('목표 선택하기'));
    expect(getByText('관심 있는 목표를 골라주세요')).toBeTruthy();
  });

  // 인트로 슬라이드 좌우 스와이프 (#825) — 예전 PanResponder는 RNGH와 섞여
  // 실기기에서 잡히지 않았다. 다른 화면과 같은 horizontalFlingGesture로 통일.
  it('좌우 스와이프로 인트로 슬라이드를 넘긴다 (#825)', async () => {
    const ui = await render(<OnboardingScreen />);
    const fling = (translationX: number) =>
      act(async () =>
        fireGestureHandler(getByGestureTestId('onboarding-slide-fling'), [
          { state: State.BEGAN },
          { state: State.ACTIVE },
          { state: State.END, translationX, translationY: 0 },
        ]),
      );

    // 왼쪽으로 밀면 다음 장.
    await fling(-60);
    expect(ui.getByText(/곰 체크로 완료해요/)).toBeTruthy();
    // 오른쪽으로 밀면 이전 장.
    await fling(60);
    expect(ui.getByText('루게더에 오신 걸 환영해요')).toBeTruthy();
    // 첫 장에서 더 뒤로는 안 간다.
    await fling(60);
    expect(ui.getByText('루게더에 오신 걸 환영해요')).toBeTruthy();
    // 임계 미달(±40)은 무시.
    await fling(-30);
    expect(ui.getByText('루게더에 오신 걸 환영해요')).toBeTruthy();
  });

  it('마지막 장에서 왼쪽 스와이프하면 목표 선택으로 넘어간다 (#825)', async () => {
    const ui = await render(<OnboardingScreen />);
    for (let i = 0; i < 4; i += 1) await fireEvent.press(ui.getByText('다음'));
    expect(ui.getByText(/기록은 달력으로/)).toBeTruthy();
    await act(async () =>
      fireGestureHandler(getByGestureTestId('onboarding-slide-fling'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END, translationX: -60, translationY: 0 },
      ]),
    );
    expect(ui.getByText('관심 있는 목표를 골라주세요')).toBeTruthy();
  });

  it('도트로 마지막 장까지 가면 목표 설문이 열린다', async () => {
    const { getByText, getByLabelText } = await render(<OnboardingScreen />);

    await goToGoalSurvey({ getByText, getByLabelText });

    expect(getByText('관심 있는 목표를 골라주세요')).toBeTruthy();
  });

  it('explains a missing goal pick with a toast on 시작하기', async () => {
    const onDone = jest.fn();
    const { getByText, getByLabelText } = await render(
      <ToastProvider>
        <OnboardingScreen onDone={onDone} />
      </ToastProvider>,
    );

    await goToGoalSurvey({ getByText, getByLabelText });
    await fireEvent.press(getByText('시작하기'));

    expect(getByText('목표를 하나 이상 선택해주세요')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('completes the flow and reports goals + character', async () => {
    const onDone = jest.fn();
    const { getByText, getByLabelText } = await render(<OnboardingScreen onDone={onDone} />);

    await goToGoalSurvey({ getByText, getByLabelText });
    await fireEvent.press(getByText('운동'));
    await fireEvent.press(getByText('시작하기'));
    // MVP 고양이 단일 (#637): 목표 시작하기 → 캐러셀 없이 닉네임으로 직행.
    // 닉네임 단계 (#635) — 필수 입력 후 시작(트림 검증 포함).
    expect(onDone).not.toHaveBeenCalled();
    await fireEvent.changeText(getByLabelText('닉네임 입력'), ' 준서 ');
    await fireEvent.press(getByText('시작하기'));

    expect(onDone).toHaveBeenCalledWith(['exercise'], 'cat', '준서');
  });

  it('닉네임 단계에서 키보드를 내릴 수 있다 (#923)', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const { getByText, getByLabelText } = await render(<OnboardingScreen />);

    await goToGoalSurvey({ getByText, getByLabelText });
    await fireEvent.press(getByText('운동'));
    await fireEvent.press(getByText('시작하기'));

    // 완료 키로 내려간다.
    await fireEvent(getByLabelText('닉네임 입력'), 'submitEditing');
    expect(dismiss).toHaveBeenCalled();

    // 입력칸 밖(배경) 탭으로도 내려간다 — 제보의 본체.
    dismiss.mockClear();
    await fireEvent.press(getByLabelText('닉네임 입력').parent!);
    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });

  it('starts the goal survey pre-filled with the previous selections (replay = edit)', async () => {
    const onDone = jest.fn();
    const goals = [
      { id: '10', label: '갓생 살기' },
      { id: '11', label: '아침형 인간' },
    ];
    const { getByText, getByLabelText } = await render(
      <OnboardingScreen onDone={onDone} goals={goals} initialGoals={['10']} />,
    );

    await goToGoalSurvey({ getByText, getByLabelText });
    // Edit: add one more goal on top of the previous pick, then finish. The
    // final onDone payload carrying '10' untouched proves it was pre-checked.
    await fireEvent.press(getByText('아침형 인간'));
    await fireEvent.press(getByText('시작하기'));
    await fireEvent.changeText(getByLabelText('닉네임 입력'), '준서');
    await fireEvent.press(getByText('시작하기'));

    expect(onDone).toHaveBeenCalledWith(['10', '11'], 'cat', '준서');
  });

  it('drops previous goal ids that no longer exist in the option list', async () => {
    const onDone = jest.fn();
    const goals = [{ id: '10', label: '갓생 살기' }];
    const { getByText, getByLabelText } = await render(
      <ToastProvider>
        <OnboardingScreen onDone={onDone} goals={goals} initialGoals={['999']} />
      </ToastProvider>,
    );

    await goToGoalSurvey({ getByText, getByLabelText });
    // The stale id must not count as a selection: 시작하기 stays blocked.
    await fireEvent.press(getByText('시작하기'));
    expect(getByText('목표를 하나 이상 선택해주세요')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('preselects the previously chosen character (characterSelectEnabled)', async () => {
    const onDone = jest.fn();
    const { getByText, getByLabelText } = await render(
      <OnboardingScreen
        onDone={onDone}
        initialGoals={['exercise']}
        initialCharacterId="bear"
        characterSelectEnabled
      />,
    );

    await goToGoalSurvey({ getByText, getByLabelText });
    await fireEvent.press(getByText('시작하기'));
    // 이전 선택(곰)이 활성 카드 — CTA 라벨에 받침 조사('이랑')까지 반영.
    await fireEvent.press(getByText('곰이랑 함께하기'));
    await fireEvent.changeText(getByLabelText('닉네임 입력'), '준서');
    await fireEvent.press(getByText('시작하기'));

    expect(onDone).toHaveBeenCalledWith(['exercise'], 'bear', '준서');
  });

  it('uses server goal options when provided', async () => {
    const onDone = jest.fn();
    const goals = [
      { id: '10', label: '갓생 살기' },
      { id: '11', label: '아침형 인간' },
    ];
    const { getByText, queryByText, getByLabelText } = await render(
      <OnboardingScreen onDone={onDone} goals={goals} />,
    );

    await goToGoalSurvey({ getByText, getByLabelText });
    expect(queryByText('운동')).toBeNull(); // local list replaced
    await fireEvent.press(getByText('갓생 살기'));
    await fireEvent.press(getByText('시작하기'));
    await fireEvent.changeText(getByLabelText('닉네임 입력'), '준서');
    await fireEvent.press(getByText('시작하기'));

    expect(onDone).toHaveBeenCalledWith(['10'], 'cat', '준서');
  });
});

// 목표 선택 상한 (#598 후속) — 집 생성의 서버 제약(goalIds ≤ 3)과 맞춘다.
describe('OnboardingScreen 목표 상한', () => {
  it('4번째 목표 선택은 차단되고 안내 토스트가 뜬다', async () => {
    const { getByText, getByLabelText } = await render(
      <ToastProvider>
        <OnboardingScreen />
      </ToastProvider>,
    );
    await goToGoalSurvey({ getByText, getByLabelText });
    await fireEvent.press(getByText('운동'));
    await fireEvent.press(getByText('공부'));
    await fireEvent.press(getByText('수면'));
    await fireEvent.press(getByText('독서')); // 4번째 — 차단
    expect(getByText('목표는 3개까지 고를 수 있어요')).toBeTruthy();
  });

  it('이전 선택이 4개 이상이어도 앞 3개만 시드된다', async () => {
    const onDone = jest.fn();
    const goals = [
      { id: '1', label: 'ㄱ' },
      { id: '2', label: 'ㄴ' },
      { id: '3', label: 'ㄷ' },
      { id: '4', label: 'ㄹ' },
    ];
    const { getByText, getByLabelText } = await render(
      <OnboardingScreen onDone={onDone} goals={goals} initialGoals={['1', '2', '3', '4']} />,
    );
    await goToGoalSurvey({ getByText, getByLabelText });
    await fireEvent.press(getByText('시작하기'));
    await fireEvent.changeText(getByLabelText('닉네임 입력'), '준서');
    await fireEvent.press(getByText('시작하기'));
    expect(onDone).toHaveBeenCalledWith(['1', '2', '3'], 'cat', '준서');
  });
});

// 캐릭터 카드 캐러셀 (#589) — 스와이프 정착·탭 포커스가 선택을 바꾸고,
// 활성 카드만 서버 포즈 프레임(CDN webp)을 그린다 (#735).
describe('OnboardingScreen 캐릭터 캐러셀', () => {
  const openCarousel = async () => {
    const utils = await render(
      <OnboardingScreen
        initialGoals={['exercise']}
        characterSelectEnabled
        characterFrames={{
          cat: ['characters/cat/animations/wave.webp'],
          otter: ['characters/otter/animations/wave.webp'],
        }}
        onDone={jest.fn()}
      />,
    );
    await goToGoalSurvey(utils);
    await fireEvent.press(utils.getByText('시작하기'));
    return utils;
  };

  it('8장 카드와 도트를 그리고, 활성 카드만 서버 프레임을 재생한다', async () => {
    const { getAllByRole, getAllByTestId, getByLabelText } = await openCarousel();
    expect(getAllByRole('radio')).toHaveLength(8);
    expect(getByLabelText('수달 카드로 이동')).toBeTruthy();
    // 프레임을 가진 카드 중 활성(고양이)만 CDN webp를 그린다 — 수달은
    // 프레임이 있어도 비활성이라 정적 포즈.
    const cdn = getAllByTestId('cdn-animation');
    expect(cdn).toHaveLength(1);
    expect(cdn[0].props.source[0].uri).toContain('characters/cat/animations/wave.webp');
  });

  it('스와이프 정착이 활성 캐릭터·CTA 라벨·프레임 재생 카드를 바꾼다', async () => {
    const { getByTestId, getByText, getAllByTestId } = await openCarousel();
    // 오프셋을 크게 줘 마지막 카드로 클램프 — 폭과 무관하게 결정적이다.
    await fireEvent(getByTestId('character-carousel'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 99999, y: 0 } },
    });
    expect(getByText('수달이랑 함께하기')).toBeTruthy();
    const cdn = getAllByTestId('cdn-animation');
    expect(cdn).toHaveLength(1);
    expect(cdn[0].props.source[0].uri).toContain('characters/otter/animations/wave.webp');
  });

  it('피크 카드를 탭하면 그 캐릭터가 활성이 된다', async () => {
    const { getByLabelText, getByText } = await openCarousel();
    await fireEvent.press(getByLabelText(/판다\. /));
    expect(getByText('판다랑 함께하기')).toBeTruthy();
  });
});

describe('withRang — 이랑/랑 조사', () => {
  it('받침 유무를 판별한다', () => {
    expect(withRang('고양이')).toBe('고양이랑');
    expect(withRang('곰')).toBe('곰이랑');
    expect(withRang('수달')).toBe('수달이랑');
    expect(withRang('판다')).toBe('판다랑');
  });
});
