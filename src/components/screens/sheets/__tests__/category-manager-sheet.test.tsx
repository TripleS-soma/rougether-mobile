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

    fireEvent.press(getByLabelText('일정 삭제'));
    expect(onDelete).toHaveBeenCalledWith('일정');
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
