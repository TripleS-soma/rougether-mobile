import { fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  type HousePreviewDetail,
  HouseSearchScreen,
} from '@/components/screens/house-search-screen';
import { ToastProvider } from '@/components/ui/toast';
import { RECOMMENDED_HOUSES } from '@/mocks/fixtures';

describe('HouseSearchScreen', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<HouseSearchScreen />);
    expect(getByText('집 탐색')).toBeTruthy();
  });

  it('renders the server cover on a browse card, pictogram tile otherwise', async () => {
    const houses = [
      { ...RECOMMENDED_HOUSES[0], id: 21, coverImageKey: 'house/cloud-balloon/frame.png' },
      { ...RECOMMENDED_HOUSES[1], id: 22 }, // no cover → pictogram fallback
    ];
    const { queryAllByTestId } = await render(<HouseSearchScreen houses={houses} />);
    expect(queryAllByTestId('house-cover')).toHaveLength(1);
  });

  it('joins by invite code via the API callback', async () => {
    const onJoinByCode = jest.fn(async () => true);
    const { getByText, getByPlaceholderText } = await render(
      <HouseSearchScreen onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    expect(onJoinByCode).toHaveBeenCalledWith('VLG7K2X');
  });

  it('shows an error when the code join fails (expired/unknown)', async () => {
    const onJoinByCode = jest.fn(async () => false);
    const { getByText, getByPlaceholderText } = await render(
      <HouseSearchScreen onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    await waitFor(() => expect(getByText(/초대코드를 확인해주세요/)).toBeTruthy());
  });

  it('shows an error for a short code without calling the API', async () => {
    const onJoinByCode = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <HouseSearchScreen onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'ab');
    await fireEvent.press(getByText('입주'));

    expect(getByText('초대코드는 6자리 이상이에요')).toBeTruthy();
    expect(onJoinByCode).not.toHaveBeenCalled();
  });

  it('explains an empty invite code with a toast', async () => {
    const onJoinByCode = jest.fn();
    const { getByText } = await render(
      <ToastProvider>
        <HouseSearchScreen onJoinByCode={onJoinByCode} />
      </ToastProvider>,
    );

    await fireEvent.press(getByText('입주'));

    expect(getByText('초대 코드를 입력해주세요')).toBeTruthy();
    expect(onJoinByCode).not.toHaveBeenCalled();
  });

  it('초대 링크 진입(initialCode)이면 미리보기가 자동 실행된다 (#624)', async () => {
    const onPreviewCode = jest.fn(async () => ({
      name: '아침 루틴 하우스',
      members: 3,
      capacity: 4,
    }));
    const { getByText } = await render(
      <HouseSearchScreen
        initialCode="VLG7K2X"
        onPreviewCode={onPreviewCode}
        onJoinByCode={jest.fn(async () => true)}
      />,
    );
    // 입력 시드 + 자동 미리보기 → 확인 시트까지 바로.
    await waitFor(() => expect(getByText('아침 루틴 하우스')).toBeTruthy());
    expect(onPreviewCode).toHaveBeenCalledWith('VLG7K2X');
  });

  it("부원 개인 코드는 입주 대신 '승인 대기' 안내 (#646)", async () => {
    const onPreviewCode = jest.fn(async () => ({
      name: '아침 루틴 하우스',
      members: 3,
      capacity: 4,
    }));
    const onJoinByCode = jest.fn(async () => 'pending' as const);
    const { getByText, getByLabelText, getByPlaceholderText, queryByText } = await render(
      <HouseSearchScreen onPreviewCode={onPreviewCode} onJoinByCode={onJoinByCode} />,
    );
    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'member01');
    await fireEvent.press(getByText('입주'));
    await waitFor(() => expect(getByText('아침 루틴 하우스')).toBeTruthy());
    await fireEvent.press(getByLabelText('이 집에 입주'));
    await waitFor(() =>
      expect(getByText('입주 신청을 보냈어요. 방장이 승인하면 집에 들어가요.')).toBeTruthy(),
    );
    // 미리보기는 닫히고 에러 문구는 없다.
    expect(queryByText(/입주에 실패했어요/)).toBeNull();
  });

  it('previews the house behind a code before joining', async () => {
    const onPreviewCode = jest.fn(async () => ({
      name: '아침 루틴 하우스',
      members: 3,
      capacity: 4,
    }));
    const onJoinByCode = jest.fn(async () => true);
    const { getByText, getByLabelText, getByPlaceholderText } = await render(
      <HouseSearchScreen onPreviewCode={onPreviewCode} onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    // The lookup runs first — join waits for explicit confirmation.
    await waitFor(() => expect(getByText('아침 루틴 하우스')).toBeTruthy());
    expect(onPreviewCode).toHaveBeenCalledWith('VLG7K2X');
    expect(onJoinByCode).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('이 집에 입주'));
    await waitFor(() => expect(onJoinByCode).toHaveBeenCalledWith('VLG7K2X'));
  });

  it('rejects an expired code at the preview step', async () => {
    const onPreviewCode = jest.fn(async () => ({ name: '옛집', members: 2, expired: true }));
    const onJoinByCode = jest.fn();
    const { getByText, getByPlaceholderText, queryByText } = await render(
      <HouseSearchScreen onPreviewCode={onPreviewCode} onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    await waitFor(() => expect(getByText(/만료된 초대코드예요/)).toBeTruthy());
    expect(queryByText('옛집')).toBeNull();
    expect(onJoinByCode).not.toHaveBeenCalled();
  });

  it('lists browsable houses and joins one by id', async () => {
    const onJoinHouse = jest.fn();
    const { getByText, getAllByText } = await render(
      <HouseSearchScreen houses={RECOMMENDED_HOUSES} onJoinHouse={onJoinHouse} />,
    );

    expect(getByText('아침형 인간 모임')).toBeTruthy();
    await fireEvent.press(getAllByText('입주 신청')[0]);
    expect(onJoinHouse).toHaveBeenCalledWith(1);
  });

  it('shows group mission progress in a read-only browse preview', async () => {
    const onPreviewHouse = jest.fn(async () => ({
      id: 1,
      name: '아침형 인간 모임',
      description: '같이 아침 루틴 지켜요',
      members: 3,
      capacity: 4,
      level: 2,
      goals: [],
      missions: [
        {
          id: 31,
          title: '오늘 다같이 루틴 지키기',
          desc: '일일 구성원 달성률',
          icon: 'sun' as const,
          current: 66,
          target: 70,
          status: 'ACTIVE' as const,
        },
      ],
    }));
    const onJoinHouse = jest.fn();
    const { getByLabelText, getByText } = await render(
      <HouseSearchScreen
        houses={RECOMMENDED_HOUSES.slice(0, 1)}
        onPreviewHouse={onPreviewHouse}
        onJoinHouse={onJoinHouse}
      />,
    );

    await fireEvent.press(getByLabelText('아침형 인간 모임 미리보기'));

    await waitFor(() => expect(getByText('단체미션 미리보기')).toBeTruthy());
    expect(getByText('오늘 다같이 루틴 지키기')).toBeTruthy();
    expect(getByText('66/70')).toBeTruthy();
    expect(getByText('입주 후 미션에 참여하고 보상을 받을 수 있어요')).toBeTruthy();
    expect(onPreviewHouse).toHaveBeenCalledWith(1);
    expect(onJoinHouse).not.toHaveBeenCalled();
  });

  it('shows a pending join request and prevents duplicate submission', async () => {
    const onJoinHouse = jest.fn();
    const houses = [
      {
        ...RECOMMENDED_HOUSES[0],
        joinRequestStatus: 'PENDING' as const,
      },
    ];
    const { getByText } = await render(
      <ToastProvider>
        <HouseSearchScreen houses={houses} onJoinHouse={onJoinHouse} />
      </ToastProvider>,
    );

    await fireEvent.press(getByText('신청 중'));

    expect(onJoinHouse).not.toHaveBeenCalled();
  });

  it('filters the list by query', async () => {
    const { getByPlaceholderText, queryByText } = await render(
      <HouseSearchScreen houses={RECOMMENDED_HOUSES} />,
    );

    await fireEvent.changeText(getByPlaceholderText('집 이름, 태그로 검색'), '개발자');
    expect(queryByText('개발자 루틴')).toBeTruthy();
    expect(queryByText('아침형 인간 모임')).toBeNull();
  });

  // 로드 실패는 '검색 결과가 없어요'로 위장하지 않는다 (#549).
  it('로드 실패 시 빈 결과 대신 실패 상태 + 다시 시도를 보여준다 (#549)', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <HouseSearchScreen houses={[]} loadError onRetry={onRetry} />,
    );

    expect(getByText('추천 집 목록을 불러오지 못했어요.')).toBeTruthy();
    expect(queryByText('검색 결과가 없어요')).toBeNull();
    await fireEvent.press(getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 네트워크·서버 오류는 잘못된 초대코드 안내와 다른 문구로 (#549).
  it('초대코드 네트워크 오류는 잘못된 코드와 다른 문구를 보여준다 (#549)', async () => {
    const onJoinByCode = jest.fn(async () => 'network' as const);
    const { getByText, getByPlaceholderText } = await render(
      <HouseSearchScreen onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    await waitFor(() => expect(getByText(/네트워크를 확인해주세요/)).toBeTruthy());
  });

  // 미리보기 조회 경로도 같은 분기를 탄다 — 리뷰 반영 (#549).
  it('초대코드 미리보기 조회의 네트워크 오류도 네트워크 문구를 보여준다 (#549)', async () => {
    const onPreviewCode = jest.fn(async () => 'network' as const);
    const { getByText, getByPlaceholderText } = await render(
      <HouseSearchScreen onPreviewCode={onPreviewCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    await waitFor(() => expect(getByText(/네트워크를 확인해주세요/)).toBeTruthy());
    expect(onPreviewCode).toHaveBeenCalledWith('VLG7K2X');
  });

  it('shows the level on the meta line and skips the missing description (#234)', async () => {
    // API houses carry a level and no intro text — the old boilerplate
    // description only ever truncated.
    const houses = [
      {
        id: 9,
        name: '연동 검증 하우스',
        members: 1,
        capacity: 4,
        tag: '건강/운동',
        icon: 'sprout' as const,
        bg: '#EEF5E7',
        border: '#CFE0C3',
        level: 2,
      },
    ];
    const { getByText, queryByText } = await render(<HouseSearchScreen houses={houses} />);

    expect(getByText('연동 검증 하우스')).toBeTruthy();
    expect(getByText(/Lv\.2 · 멤버 1 \/ 4/)).toBeTruthy();
    expect(queryByText(/함께 루틴을 키워요/)).toBeNull();

    // Demo fixtures still carry a real description — it renders as its own line.
    const withDesc = await render(<HouseSearchScreen houses={RECOMMENDED_HOUSES.slice(0, 1)} />);
    expect(withDesc.getByText('오전 7시 전 기상 인증을 함께 해요')).toBeTruthy();
  });
});

describe('HouseSearchScreen — 참여 전 미리보기 (#328)', () => {
  const DETAIL = {
    id: 21,
    name: '아침집',
    description: '아침 루틴을 함께해요',
    members: 2,
    capacity: 4,
    level: 3,
    goals: ['미라클모닝', '운동'],
  };

  it('opens the preview modal from the card body and joins from it', async () => {
    const onPreviewHouse = jest.fn(async () => DETAIL);
    const onJoinHouse = jest.fn();
    const houses = [{ ...RECOMMENDED_HOUSES[0], id: 21, name: '아침집' }];
    const { getByLabelText, getByText } = await render(
      <HouseSearchScreen
        houses={houses}
        onPreviewHouse={onPreviewHouse}
        onJoinHouse={onJoinHouse}
      />,
    );
    await fireEvent.press(getByLabelText('아침집 미리보기'));
    await waitFor(() => expect(getByText('아침 루틴을 함께해요')).toBeTruthy());
    expect(onPreviewHouse).toHaveBeenCalledWith(21);
    expect(getByText('#미라클모닝')).toBeTruthy();
    await fireEvent.press(getByLabelText('이 집에 참여하기'));
    expect(onJoinHouse).toHaveBeenCalledWith(21);
  });

  /**
   * 동거 봇(서버 #309) 이후 정원이 다 찼다고 사람이 못 들어가는 게 아니다 —
   * 봇이 비켜준다. 목록 응답에는 서버가 계산한 isFull이 없어 앱이 봇 수를
   * 알 수 없으므로, 수치로 미리 막지 않는다 (#948).
   */
  describe('정원이 다 찬 집도 신청은 보낸다 (#948)', () => {
    const atCapacity = {
      ...RECOMMENDED_HOUSES[0],
      id: 31,
      name: '가득집',
      members: 4,
      capacity: 4,
    };

    it('4/4 집이어도 입주 신청 버튼이 눌리고 onJoinHouse가 불린다', async () => {
      const onJoinHouse = jest.fn();
      const { getByText } = await render(
        <ToastProvider>
          <HouseSearchScreen houses={[atCapacity]} onJoinHouse={onJoinHouse} />
        </ToastProvider>,
      );
      // 라벨이 '만석'으로 바뀌어 막히지 않는다.
      await fireEvent.press(getByText('입주 신청'));
      expect(onJoinHouse).toHaveBeenCalledWith(31);
    });

    it('정원이 찼다는 사실 자체는 메타 줄에 그대로 보여준다', async () => {
      const { getByText } = await render(<HouseSearchScreen houses={[atCapacity]} />);
      expect(getByText(/만석/)).toBeTruthy();
    });

    it('이미 신청 중·입주 완료는 그대로 막는다 — 앱이 아는 사실이다', async () => {
      const onJoinHouse = jest.fn();
      const { getByText } = await render(
        <ToastProvider>
          <HouseSearchScreen
            houses={[{ ...atCapacity, joinRequestStatus: 'PENDING' }]}
            onJoinHouse={onJoinHouse}
          />
        </ToastProvider>,
      );
      await fireEvent.press(getByText('신청 중'));
      expect(onJoinHouse).not.toHaveBeenCalled();
      expect(getByText('방장의 수락을 기다리고 있어요')).toBeTruthy();
    });
  });

  it('blocks joining a full house with a toast, and shows 이미 참여 중', async () => {
    const onJoinHouse = jest.fn();
    const full = { ...DETAIL, isFull: true };
    const houses = [{ ...RECOMMENDED_HOUSES[0], id: 21, name: '아침집' }];
    const ui = await render(
      <ToastProvider>
        <HouseSearchScreen
          houses={houses}
          onPreviewHouse={jest.fn(async () => full)}
          onJoinHouse={onJoinHouse}
        />
      </ToastProvider>,
    );
    await fireEvent.press(ui.getByLabelText('아침집 미리보기'));
    await waitFor(() => expect(ui.getByLabelText('이 집에 참여하기')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('이 집에 참여하기'));
    expect(onJoinHouse).not.toHaveBeenCalled();
    expect(ui.getByText('정원이 가득 찼어요')).toBeTruthy();
  });

  it('renders the house frame with member-count mock rooms in the windows', async () => {
    const houses = [{ ...RECOMMENDED_HOUSES[0], id: 21, name: '아침집' }];
    const ui = await render(
      <HouseSearchScreen houses={houses} onPreviewHouse={jest.fn(async () => DETAIL)} />,
    );
    await fireEvent.press(ui.getByLabelText('아침집 미리보기'));
    await waitFor(() => expect(ui.getByTestId('house-preview-frame')).toBeTruthy());
    // 멤버 2명 → 창문 2칸에 기본 방 목업, 나머지 2칸은 빈자리 (창문 4칸).
    expect(ui.getAllByTestId('preview-room')).toHaveLength(2);
    expect(ui.getAllByTestId('preview-vacant')).toHaveLength(2);
  });

  it('renders the actual member rooms in the windows when the preview carries them (#386)', async () => {
    const withRooms: HousePreviewDetail = {
      ...DETAIL,
      members: 3,
      rooms: [
        // 실제 방(가구+캐릭터), FREE_V1 방, 방 미생성(기본 빈 방) — 3칸 모두 실렌더.
        { placements: [], wallpaperId: 'wp-1', characterId: 'cat' as const },
        { placements: [{ furnitureId: 'hanok-rug', x: 0.5, y: 0.8, z: 1 }] },
        { placements: [] },
      ],
    };
    const houses = [{ ...RECOMMENDED_HOUSES[0], id: 21, name: '아침집' }];
    const ui = await render(
      <HouseSearchScreen houses={houses} onPreviewHouse={jest.fn(async () => withRooms)} />,
    );
    await fireEvent.press(ui.getByLabelText('아침집 미리보기'));
    await waitFor(() => expect(ui.getByTestId('house-preview-frame')).toBeTruthy());
    // rooms가 있으면 인원수(3)가 아니라 rooms 길이대로 실제 방을 그린다.
    expect(ui.getAllByTestId('preview-room')).toHaveLength(3);
    expect(ui.getAllByTestId('preview-vacant')).toHaveLength(1);
  });

  it('shows 이미 참여 중 instead of the join button for a member', async () => {
    const member = { ...DETAIL, isMember: true };
    const houses = [{ ...RECOMMENDED_HOUSES[0], id: 21, name: '아침집' }];
    const ui = await render(
      <HouseSearchScreen houses={houses} onPreviewHouse={jest.fn(async () => member)} />,
    );
    await fireEvent.press(ui.getByLabelText('아침집 미리보기'));
    await waitFor(() => expect(ui.getByText('이미 참여 중')).toBeTruthy());
    expect(ui.queryByLabelText('이 집에 참여하기')).toBeNull();
  });
});
