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
