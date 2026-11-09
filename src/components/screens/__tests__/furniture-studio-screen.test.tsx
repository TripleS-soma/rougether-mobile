import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { FurnitureStudioScreen } from '@/components/screens/furniture-studio-screen';
import { __resetSheetSerializer } from '@/components/ui/bottom-sheet';

/** JS exit finishes first; UIKit then emits native Modal.onDismiss. */
async function finishNativeSheetDismissal(onDismiss: () => void) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  await act(async () => onDismiss());
}

// 시트 퇴장 대기열은 모듈 전역이다 — 한 테스트가 닫는 중에 끝나도 다음 테스트로 새지 않게.
afterEach(() => __resetSheetSerializer());

/** 내 가구 탭 → 첫(가장 최근) 타일 → 상세 시트 (#1666). 히스토리는 더 이상 첫 화면에 없다. */
async function openHistory(ui: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(ui.getByRole('tab', { name: /^내 가구/ }));
  await fireEvent.press(ui.getAllByLabelText(/^내가 만든 가구 \d+/)[0]);
}

it('prevents generation without either credits or enough coins', async () => {
  const choose = jest.fn();
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 0, reserved: 0 }}
      jobs={[]}
      photo={null}
      onChoosePhoto={choose}
    />,
  );
  expect(ui.getByText('생성권 0회')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('가구 사진 선택'));
  expect(choose).not.toHaveBeenCalled();
});

it('submits the selected photo with an explicit credit cost', async () => {
  const submit = jest.fn();
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 1, reserved: 0 }}
      jobs={[]}
      photo={{ uri: 'file:///chair.jpg', name: 'chair.jpg', type: 'image/jpeg' }}
      onSubmit={submit}
    />,
  );
  await fireEvent.press(ui.getByLabelText('생성권 1회로 만들기'));
  expect(submit).toHaveBeenCalledTimes(1);
});

it('shows resumed progress and completed inventory without a second submission', async () => {
  const place = jest.fn();
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 0, reserved: 1 }}
      photo={null}
      jobs={[
        { id: 'active', status: 'PROCESSING', assetKey: null, userItemId: null, failureCode: null },
        {
          id: 'done',
          status: 'SUCCEEDED',
          assetKey: 'items/chair.png',
          userItemId: 7,
          failureCode: null,
        },
      ]}
      onGoToRoom={place}
    />,
  );
  expect(ui.getByText('가구를 만들고 있어요')).toBeTruthy();
  expect(ui.queryByText('가구 사진 선택')).toBeNull();
  await openHistory(ui);
  await fireEvent.press(ui.getByLabelText('방에 배치하기'));
  expect(place).toHaveBeenCalledTimes(1);
});

const failedJob = {
  id: 'failed',
  status: 'FAILED' as const,
  assetKey: null,
  userItemId: null,
  failureCode: 'PHOTO_REJECTED',
};

it('shows the photo rejection reason, how to fix it, and credit return', async () => {
  const choose = jest.fn();
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 1, reserved: 0 }}
      photo={null}
      jobs={[{ ...failedJob, reason: '두 대상이 비슷하게 보여 하나를 고르기 어려워요.' }]}
      onChoosePhoto={choose}
    />,
  );
  await openHistory(ui);
  expect(ui.getByText('두 대상이 비슷하게 보여 하나를 고르기 어려워요.')).toBeTruthy();
  expect(
    ui.getByText('만들 대상 하나가 또렷하게 보이도록 사진을 잘라 다시 선택해주세요.'),
  ).toBeTruthy();
  expect(ui.getByText('실패한 작업에 사용한 생성권이나 코인은 돌려드렸어요.')).toBeTruthy();
  expect(ui.queryByText('PHOTO_REJECTED')).toBeNull();
  // 시트에선 선택기를 열지 않고 만들기 탭으로만 — 닫히는 시트 위로 네이티브 선택기를 올리지 않는다.
  await fireEvent.press(ui.getByLabelText('다시 만들러 가기'));
  expect(choose).not.toHaveBeenCalled();
  expect(ui.getByRole('tab', { name: '만들기' }).props.accessibilityState).toMatchObject({
    selected: true,
  });
  await fireEvent.press(ui.getByLabelText('가구 사진 선택'));
  expect(choose).toHaveBeenCalledTimes(1);
});

it.each([undefined, null, '   '])(
  'explains older photo rejections without a detailed reason (%s)',
  async (reason) => {
    const ui = await render(
      <FurnitureStudioScreen
        balance={{ available: 1, reserved: 0 }}
        photo={null}
        jobs={[{ ...failedJob, reason }]}
      />,
    );
    await openHistory(ui);
    expect(ui.getByText('이 사진으로는 가구를 만들기 어려워요.')).toBeTruthy();
  },
);

it('shows quality review details rather than the internal attempt budget', async () => {
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 1, reserved: 0 }}
      photo={null}
      jobs={[
        {
          ...failedJob,
          failureCode: 'GENERATION_BUDGET_EXHAUSTED',
          reason: '투명 배경에 흰 잔상이 남았어요.',
        },
      ]}
    />,
  );
  await openHistory(ui);
  expect(ui.getByText('투명 배경에 흰 잔상이 남았어요.')).toBeTruthy();
  expect(
    ui.getByText('대상의 형태가 선명하고 배경이 단순한 사진으로 다시 시도해주세요.'),
  ).toBeTruthy();
  expect(ui.queryByText('GENERATION_BUDGET_EXHAUSTED')).toBeNull();
});

it.each(['PROVIDER_REQUEST_FAILED', 'PROVIDER_RATE_LIMITED', 'UNKNOWN_FAILURE', null])(
  'allows later retry for %s without displaying stale review details',
  async (failureCode) => {
    const ui = await render(
      <FurnitureStudioScreen
        balance={{ available: 1, reserved: 0 }}
        photo={null}
        jobs={[{ ...failedJob, failureCode, reason: '이전 후보 이미지의 다리를 고쳐야 해요.' }]}
      />,
    );
    await openHistory(ui);
    expect(ui.getByText('처리 중 문제가 생겨 만들기를 마치지 못했어요.')).toBeTruthy();
    expect(
      ui.getByText('잠시 후 다시 시도해주세요. 계속 실패하면 고객센터에 알려주세요.'),
    ).toBeTruthy();
    expect(ui.queryByText('이전 후보 이미지의 다리를 고쳐야 해요.')).toBeNull();
    expect(
      ui.queryByText('만들 대상 하나가 또렷하게 보이도록 사진을 잘라 다시 선택해주세요.'),
    ).toBeNull();
  },
);

it('preserves the completed furniture after a failed re-review without claiming a credit return', async () => {
  const place = jest.fn();
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 0, reserved: 0 }}
      photo={null}
      jobs={[
        {
          ...failedJob,
          userItemId: 7,
          failureCode: 'GENERATION_BUDGET_EXHAUSTED',
          reason: '수정한 배경이 깨끗하지 않아요.',
        },
      ]}
      onGoToRoom={place}
    />,
  );
  await openHistory(ui);
  expect(ui.getByText('이번 검수를 마치지 못했어요')).toBeTruthy();
  expect(ui.getByText('수정한 배경이 깨끗하지 않아요.')).toBeTruthy();
  expect(ui.getByText('이전에 완성한 가구는 가구함에 그대로 있어요.')).toBeTruthy();
  expect(
    ui.queryByText('대상의 형태가 선명하고 배경이 단순한 사진으로 다시 시도해주세요.'),
  ).toBeNull();
  expect(ui.queryByText('실패한 작업에 사용한 생성권이나 코인은 돌려드렸어요.')).toBeNull();
  await fireEvent.press(ui.getByLabelText('방에 배치하기'));
  expect(place).toHaveBeenCalledTimes(1);
});

it('does not show failure information for a successful job', async () => {
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 0, reserved: 0 }}
      photo={null}
      jobs={[
        {
          ...failedJob,
          status: 'SUCCEEDED',
          userItemId: 7,
          failureCode: null,
          reason: '검수를 통과했어요.',
        },
      ]}
    />,
  );
  await openHistory(ui);
  expect(ui.getByText('내 가구함에 담았어요')).toBeTruthy();
  expect(ui.queryByRole('alert')).toBeNull();
});

it.each([
  [
    'SOURCE_UPLOAD_FAILED',
    '사진을 불러오지 못해 만들기를 마치지 못했어요.',
    '연결 상태를 확인하고 사진을 다시 선택해주세요.',
  ],
  [
    'QUEUE_WAIT_EXCEEDED',
    '처리가 제시간에 끝나지 않아 만들기를 중단했어요.',
    '잠시 후 같은 사진으로 다시 시도할 수 있어요.',
  ],
])('explains %s and the appropriate retry action', async (failureCode, reason, hint) => {
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 1, reserved: 0 }}
      photo={null}
      jobs={[{ ...failedJob, failureCode }]}
    />,
  );
  await openHistory(ui);
  expect(ui.getByText(reason)).toBeTruthy();
  expect(ui.getByText(hint)).toBeTruthy();
});

it('allows photo selection and clearly labels a 100-coin submission without credits', async () => {
  const choose = jest.fn();
  const submit = jest.fn();
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 0, reserved: 0 }}
      coinBalance={100}
      jobs={[]}
      photo={{ uri: 'file:///chair.jpg', name: 'chair.jpg', type: 'image/jpeg' }}
      onChoosePhoto={choose}
      onSubmit={submit}
    />,
  );
  expect(ui.getByText('보유 코인 100')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('사진 바꾸기'));
  await fireEvent.press(ui.getByLabelText('100코인으로 만들기'));
  expect(choose).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledTimes(1);
});

it('keeps the credit label when both payment methods are available', async () => {
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 1, reserved: 0 }}
      coinBalance={100}
      jobs={[]}
      photo={{ uri: 'file:///chair.jpg', name: 'chair.jpg', type: 'image/jpeg' }}
    />,
  );
  expect(ui.getByLabelText('생성권 1회로 만들기')).toBeTruthy();
  expect(ui.queryByLabelText('100코인으로 만들기')).toBeNull();
});

it('disables coin creation at 99 coins', async () => {
  const submit = jest.fn();
  const ui = await render(
    <FurnitureStudioScreen
      balance={{ available: 0, reserved: 0 }}
      coinBalance={99}
      jobs={[]}
      photo={{ uri: 'file:///chair.jpg', name: 'chair.jpg', type: 'image/jpeg' }}
      onSubmit={submit}
    />,
  );
  await fireEvent.press(ui.getByLabelText('100코인으로 만들기'));
  expect(submit).not.toHaveBeenCalled();
});

describe('내 가구 탭 — 2열 타일 + 상세 시트 (#1666)', () => {
  const done = (id: string) => ({
    id,
    status: 'SUCCEEDED' as const,
    assetKey: `items/${id}.png`,
    userItemId: Number(id.replace(/\D/g, '')) || 1,
    failureCode: null,
  });

  it('만들기와 히스토리를 탭으로 나누고, 히스토리는 버튼 없이 타일만 보인다', async () => {
    const ui = await render(
      <FurnitureStudioScreen
        balance={{ available: 1, reserved: 0 }}
        photo={null}
        jobs={[done('d1'), done('d2'), done('d3')]}
        onGoToRoom={jest.fn()}
      />,
    );
    // 첫 화면은 만들기 — 히스토리가 만들기를 밀어내지 않는다.
    expect(ui.getByText('가구 사진 선택')).toBeTruthy();
    expect(ui.queryAllByLabelText(/^내가 만든 가구 \d+/)).toHaveLength(0);
    await fireEvent.press(ui.getByRole('tab', { name: '내 가구 3' }));
    expect(ui.getAllByLabelText(/^내가 만든 가구 \d+/)).toHaveLength(3);
    // 버튼은 시트에만 — 목록엔 '방에 배치하기'가 없다.
    expect(ui.queryByLabelText('방에 배치하기')).toBeNull();
    // 실패가 없으면 거르기 칩도 없다.
    expect(ui.queryByText(/^실패 /)).toBeNull();
  });

  it('실패가 있으면 완성·실패로 거른다', async () => {
    const ui = await render(
      <FurnitureStudioScreen
        balance={{ available: 1, reserved: 0 }}
        photo={null}
        jobs={[done('d1'), failedJob, done('d2')]}
      />,
    );
    await fireEvent.press(ui.getByRole('tab', { name: '내 가구 3' }));
    await fireEvent.press(ui.getByRole('tab', { name: '실패 1' }));
    const tiles = ui.getAllByLabelText(/^내가 만든 가구 \d+/);
    expect(tiles).toHaveLength(1);
    expect(tiles[0].props.accessibilityLabel).toMatch(/이번에는 완성하지 못했어요$/);
    await fireEvent.press(ui.getByRole('tab', { name: '완성 2' }));
    expect(ui.getAllByLabelText(/^내가 만든 가구 \d+/)).toHaveLength(2);
  });

  it('검수 실패도 실패로 거른다 — 배지가 달린 타일은 전부 실패 칸에 (#1667 리뷰)', async () => {
    const reviewFailed = { ...failedJob, id: 'r', userItemId: 9, failureCode: 'HARD_QA_REJECTED' };
    const ui = await render(
      <FurnitureStudioScreen
        balance={{ available: 1, reserved: 0 }}
        photo={null}
        jobs={[done('d1'), reviewFailed]}
      />,
    );
    await fireEvent.press(ui.getByRole('tab', { name: '내 가구 2' }));
    // 순수 실패가 없어도 검수 실패가 있으면 거르기가 뜬다.
    await fireEvent.press(ui.getByRole('tab', { name: '실패 1' }));
    const tiles = ui.getAllByLabelText(/^내가 만든 가구 \d+/);
    expect(tiles).toHaveLength(1);
    expect(tiles[0].props.accessibilityLabel).toMatch(/이번 검수를 마치지 못했어요$/);
    await fireEvent.press(ui.getByRole('tab', { name: '완성 1' }));
    expect(ui.getAllByLabelText(/^내가 만든 가구 \d+/)[0].props.accessibilityLabel).toMatch(
      /내 가구함에 담았어요$/,
    );
  });

  it('실패 칸을 보다가 실패가 0건이 되면 전체로 돌아온다 — 칩이 사라진 빈 그리드에 갇히지 않게 (#1668 리뷰)', async () => {
    const props = { balance: { available: 1, reserved: 0 }, photo: null };
    const ui = await render(<FurnitureStudioScreen {...props} jobs={[done('d1'), failedJob]} />);
    await fireEvent.press(ui.getByRole('tab', { name: '내 가구 2' }));
    await fireEvent.press(ui.getByRole('tab', { name: '실패 1' }));
    expect(ui.getAllByLabelText(/^내가 만든 가구 \d+/)).toHaveLength(1);
    // 목록 갱신으로 실패 건이 빠졌다.
    await ui.rerender(<FurnitureStudioScreen {...props} jobs={[done('d1')]} />);
    expect(ui.queryByText(/^실패 /)).toBeNull();
    expect(ui.getAllByLabelText(/^내가 만든 가구 \d+/)).toHaveLength(1);
  });

  it('만들던 가구가 끝나면 내 가구 탭으로 넘어간다', async () => {
    const props = { balance: { available: 0, reserved: 0 }, photo: null };
    const ui = await render(
      <FurnitureStudioScreen
        {...props}
        jobs={[
          { id: 'a', status: 'PROCESSING', assetKey: null, userItemId: null, failureCode: null },
        ]}
      />,
    );
    expect(ui.getByText('가구를 만들고 있어요')).toBeTruthy();
    await ui.rerender(<FurnitureStudioScreen {...props} jobs={[done('a1')]} />);
    expect(ui.getByRole('tab', { name: '내 가구 1' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(ui.getAllByLabelText(/^내가 만든 가구 \d+/)).toHaveLength(1);
  });

  it('시트의 판매하기는 시트를 닫고 판매 시트를 연다 — 모달을 겹치지 않는다', async () => {
    const ui = await render(
      <FurnitureStudioScreen
        balance={{ available: 1, reserved: 0 }}
        photo={null}
        jobs={[done('d7')]}
        onIssue={jest.fn()}
      />,
    );
    await openHistory(ui);
    expect(ui.getByLabelText('내가 만든 가구 자세히')).toBeTruthy();
    expect(ui.queryByLabelText('가구 판매하기')).toBeNull();
    const onDetailDismissed = ui.getByTestId('bottom-sheet-modal').props.onDismiss;
    await fireEvent.press(ui.getByLabelText('판매하기'));
    // 상세 시트의 내용은 바로 비고, 판매 시트는 상세 시트가 다 닫힌 뒤에 뜬다 — BottomSheet의
    // iOS Modal 직렬화(퇴장 중인 시트 위에 새 Modal을 올리지 못함)가 그 순서를 지킨다.
    expect(ui.queryByLabelText('방에 배치하기')).toBeNull();
    expect(ui.queryByLabelText('가구 판매하기')).toBeNull();
    await finishNativeSheetDismissal(onDetailDismissed);
    await waitFor(() => expect(ui.getAllByLabelText('가구 판매하기').length).toBeGreaterThan(0));
  });
});
