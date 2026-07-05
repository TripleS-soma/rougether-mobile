import { fireEvent, render } from '@testing-library/react-native';

import { CategoryManagerSheet } from '@/components/screens/sheets/category-manager-sheet';
import { ROUTINE_CATEGORIES } from '@/constants/routines';

const noop = () => {};

describe('CategoryManagerSheet', () => {
  it('renders the create form and the existing categories', async () => {
    const { getByText, getByLabelText, getByPlaceholderText } = await render(
      <CategoryManagerSheet
        visible
        categories={ROUTINE_CATEGORIES}
        onCreate={noop}
        onDelete={noop}
        onClose={noop}
      />,
    );

    expect(getByText('새 카테고리 만들기')).toBeTruthy();
    expect(getByPlaceholderText('예) 자기계발')).toBeTruthy();
    expect(getByLabelText('카테고리 추가')).toBeTruthy();
    expect(getByText(`내 카테고리 (${ROUTINE_CATEGORIES.length})`)).toBeTruthy();
  });

  it('deletes an existing category', async () => {
    const onDelete = jest.fn();
    const { getByLabelText } = await render(
      <CategoryManagerSheet
        visible
        categories={ROUTINE_CATEGORIES}
        onCreate={noop}
        onDelete={onDelete}
        onClose={noop}
      />,
    );

    // Trash opens a confirm modal; delete only fires after confirming.
    await fireEvent.press(getByLabelText('일정 삭제'));
    expect(onDelete).not.toHaveBeenCalled();
    await fireEvent.press(getByLabelText('삭제'));
    expect(onDelete).toHaveBeenCalledWith('일정');
  });

  it('edits an existing category and reports the changes', async () => {
    const onUpdate = jest.fn();
    const { getByText, getByLabelText, getByDisplayValue } = await render(
      <CategoryManagerSheet
        visible
        categories={ROUTINE_CATEGORIES}
        onCreate={noop}
        onUpdate={onUpdate}
        onDelete={noop}
        onClose={noop}
      />,
    );

    // Pencil switches the form into edit mode, prefilled with the category.
    await fireEvent.press(getByLabelText('공부 수정'));
    expect(getByText("'공부' 수정하기")).toBeTruthy();

    await fireEvent.changeText(getByDisplayValue('공부'), '심화 공부');
    await fireEvent.press(getByText('저장하기'));

    expect(onUpdate).toHaveBeenCalledWith(
      '공부',
      expect.objectContaining({ id: '공부', label: '심화 공부', emoji: '📚' }),
    );
    // Submitting resets back to create mode.
    expect(getByText('새 카테고리 만들기')).toBeTruthy();
  });

  it('cancels edit mode back to the create form', async () => {
    const { getByText, getByLabelText } = await render(
      <CategoryManagerSheet
        visible
        categories={ROUTINE_CATEGORIES}
        onCreate={noop}
        onUpdate={noop}
        onDelete={noop}
        onClose={noop}
      />,
    );

    await fireEvent.press(getByLabelText('취미 수정'));
    expect(getByText("'취미' 수정하기")).toBeTruthy();
    await fireEvent.press(getByText('수정 취소'));
    expect(getByText('새 카테고리 만들기')).toBeTruthy();
  });

  it('renders nothing when hidden', async () => {
    const { queryByText } = await render(
      <CategoryManagerSheet
        visible={false}
        categories={ROUTINE_CATEGORIES}
        onCreate={noop}
        onDelete={noop}
        onClose={noop}
      />,
    );
    expect(queryByText('카테고리 관리')).toBeNull();
  });
});
