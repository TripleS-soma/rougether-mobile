import { fireEvent, render } from '@testing-library/react-native';

import { CategoryFormSheet } from '@/components/screens/sheets/category-form-sheet';
import { ROUTINE_CATEGORIES } from '@/constants/routines';

const noop = () => {};

describe('CategoryFormSheet', () => {
  it('renders the create form', async () => {
    const { getByText, getByLabelText, getByPlaceholderText } = await render(
      <CategoryFormSheet visible onCreate={noop} onClose={noop} />,
    );
    expect(getByText('새 카테고리')).toBeTruthy();
    expect(getByPlaceholderText('예) 자기계발')).toBeTruthy();
    expect(getByLabelText('카테고리 추가')).toBeTruthy();
  });

  it('creates a category with the 비공개 visibility level', async () => {
    const onCreate = jest.fn();
    const onClose = jest.fn();
    const { getByText, getByLabelText, getByPlaceholderText } = await render(
      <CategoryFormSheet visible onCreate={onCreate} onClose={onClose} />,
    );

    // All four levels render; picking 비공개 round-trips into the payload.
    expect(getByLabelText('전체 공개')).toBeTruthy();
    expect(getByLabelText('일부 공개')).toBeTruthy();
    await fireEvent.press(getByLabelText('비공개'));
    expect(getByText('나만 볼 수 있어요')).toBeTruthy();

    await fireEvent.changeText(getByPlaceholderText('예) 자기계발'), '일기');
    await fireEvent.press(getByLabelText('카테고리 추가'));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' }));
    // 제출하면 시트가 닫힌다.
    expect(onClose).toHaveBeenCalled();
  });

  it('creates a category with a picked color (#340)', async () => {
    const onCreate = jest.fn();
    const { getByLabelText, getByPlaceholderText } = await render(
      <CategoryFormSheet visible onCreate={onCreate} onClose={noop} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예) 자기계발'), '자기계발');
    await fireEvent.press(getByLabelText('색상 #C8869C'));
    await fireEvent.press(getByLabelText('카테고리 추가'));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ color: '#C8869C' }));
  });

  it('prefills edit mode and saves the changes', async () => {
    const onUpdate = jest.fn();
    const cat = ROUTINE_CATEGORIES.find((c) => c.id === '공부')!;
    const { getByText, getByDisplayValue, getByLabelText } = await render(
      <CategoryFormSheet visible editing={cat} onUpdate={onUpdate} onClose={noop} />,
    );

    expect(getByText("'공부' 수정하기")).toBeTruthy();
    await fireEvent.changeText(getByDisplayValue('공부'), '심화 공부');
    await fireEvent.press(getByLabelText('색상 #6FB7B0'));
    await fireEvent.press(getByLabelText('카테고리 저장'));

    expect(onUpdate).toHaveBeenCalledWith(
      '공부',
      expect.objectContaining({ id: '공부', name: '심화 공부', icon: 'book', color: '#6FB7B0' }),
    );
  });

  it('renders nothing when hidden', async () => {
    const { queryByText } = await render(
      <CategoryFormSheet visible={false} onCreate={noop} onClose={noop} />,
    );
    expect(queryByText('새 카테고리')).toBeNull();
  });
});
