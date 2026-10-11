import { fireEvent, render } from '@testing-library/react-native';

import { FurnitureStudioScreen } from '@/components/screens/furniture-studio-screen';

it('shows credits and prevents generation without a credit', async () => {
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
  expect(ui.getByText('두 대상이 비슷하게 보여 하나를 고르기 어려워요.')).toBeTruthy();
  expect(
    ui.getByText('만들 대상 하나가 또렷하게 보이도록 사진을 잘라 다시 선택해주세요.'),
  ).toBeTruthy();
  expect(ui.getByText('실패한 작업의 생성권은 돌려드렸어요.')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('다시 만들 사진 선택'));
  expect(choose).toHaveBeenCalledTimes(1);
  expect(ui.queryByText('PHOTO_REJECTED')).toBeNull();
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
  expect(ui.getByText('투명 배경에 흰 잔상이 남았어요.')).toBeTruthy();
  expect(
    ui.getByText('대상의 형태가 선명하고 배경이 단순한 사진으로 다시 시도해주세요.'),
  ).toBeTruthy();
  expect(ui.queryByText('GENERATION_BUDGET_EXHAUSTED')).toBeNull();
});

it.each(['PROVIDER_REQUEST_FAILED', 'PROVIDER_RATE_LIMITED', 'UNKNOWN_FAILURE'])(
  'allows later retry for %s without displaying stale review details',
  async (failureCode) => {
    const ui = await render(
      <FurnitureStudioScreen
        balance={{ available: 1, reserved: 0 }}
        photo={null}
        jobs={[{ ...failedJob, failureCode, reason: '이전 후보 이미지의 다리를 고쳐야 해요.' }]}
      />,
    );
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
  expect(ui.getByText('이번 검수를 마치지 못했어요')).toBeTruthy();
  expect(ui.getByText('수정한 배경이 깨끗하지 않아요.')).toBeTruthy();
  expect(ui.getByText('이전에 완성한 가구는 가구함에 그대로 있어요.')).toBeTruthy();
  expect(ui.queryByText('실패한 작업의 생성권은 돌려드렸어요.')).toBeNull();
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
  expect(ui.getByText('내 가구함에 담았어요')).toBeTruthy();
  expect(ui.queryByRole('alert')).toBeNull();
});
