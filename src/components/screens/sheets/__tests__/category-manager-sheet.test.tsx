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

  it('creates a category with the 비공개 visibility level', async () => {
    const onCreate = jest.fn();
    const { getByText, getByLabelText, getByPlaceholderText } = await render(
      <CategoryManagerSheet
        visible
        categories={[]}
        onCreate={onCreate}
        onDelete={noop}
        onClose={noop}
      />,
    );

    // All four levels render; picking 비공개 round-trips into the payload.
    expect(getByLabelText('전체 공개')).toBeTruthy();
    expect(getByLabelText('일부 공개')).toBeTruthy();
    await fireEvent.press(getByLabelText('비공개'));
    expect(getByText('나만 볼 수 있어요')).toBeTruthy();

    await fireEvent.changeText(getByPlaceholderText('예) 자기계발'), '일기');
    await fireEvent.press(getByLabelText('카테고리 추가'));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' }));
  });

  it('creates a category with a picked color (#340)', async () => {
    const onCreate = jest.fn();
    const { getByLabelText, getByPlaceholderText } = await render(
      <CategoryManagerSheet
        visible
        categories={[]}
        onCreate={onCreate}
        onDelete={noop}
        onClose={noop}
      />,
    );

    await fireEvent.changeText(getByPlaceholderText('예) 자기계발'), '자기계발');
    await fireEvent.press(getByLabelText('색상 #C8869C'));
    await fireEvent.press(getByLabelText('카테고리 추가'));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ color: '#C8869C' }));
  });

  it('edit starts from the current color and saves a changed one (#340)', async () => {
    const onUpdate = jest.fn();
    const cat = ROUTINE_CATEGORIES[0];
    const { getByLabelText } = await render(
      <CategoryManagerSheet
        visible
        categories={ROUTINE_CATEGORIES}
        onCreate={noop}
        onUpdate={onUpdate}
        onDelete={noop}
        onClose={noop}
      />,
    );

    await fireEvent.press(getByLabelText(`${cat.label} 수정`));
    await fireEvent.press(getByLabelText('색상 #6FB7B0'));
    await fireEvent.press(getByLabelText('카테고리 저장'));
    expect(onUpdate).toHaveBeenCalledWith(cat.id, expect.objectContaining({ color: '#6FB7B0' }));
  });

  it('reorders categories via long-press move mode', async () => {
    const onReorder = jest.fn();
    const { getByLabelText, queryByLabelText } = await render(
      <CategoryManagerSheet
        visible
        categories={ROUTINE_CATEGORIES}
        onCreate={noop}
        onDelete={noop}
        onReorder={onReorder}
        onClose={noop}
      />,
    );

    // Move buttons appear only after a long press on the row.
    expect(queryByLabelText('일정 아래로 이동')).toBeNull();
    await fireEvent(getByLabelText('일정 카테고리'), 'longPress');
    await fireEvent.press(getByLabelText('일정 아래로 이동'));

    const ids = ROUTINE_CATEGORIES.map((c) => c.id);
    [ids[0], ids[1]] = [ids[1], ids[0]];
    expect(onReorder).toHaveBeenCalledWith(ids);

    // 완료 exits move mode.
    await fireEvent.press(getByLabelText('순서 이동 완료'));
    expect(queryByLabelText('일정 아래로 이동')).toBeNull();
  });

  it('does not move the first category up', async () => {
    const onReorder = jest.fn();
    const { getByLabelText } = await render(
      <CategoryManagerSheet
        visible
        categories={ROUTINE_CATEGORIES}
        onCreate={noop}
        onDelete={noop}
        onReorder={onReorder}
        onClose={noop}
      />,
    );
    await fireEvent(getByLabelText('일정 카테고리'), 'longPress');
    await fireEvent.press(getByLabelText('일정 위로 이동'));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('blocks deleting a category that still has routines (warning modal)', async () => {
    const onDelete = jest.fn();
    const { getByLabelText, getByText, queryByText } = await render(
      <CategoryManagerSheet
        visible
        categories={ROUTINE_CATEGORIES}
        inUseCategoryIds={['일정']}
        onCreate={noop}
        onDelete={onDelete}
        onClose={noop}
      />,
    );

    await fireEvent.press(getByLabelText('일정 삭제'));
    // Warning instead of the delete confirm — deletion never fires.
    expect(getByText('삭제할 수 없어요')).toBeTruthy();
    expect(queryByText('카테고리 삭제')).toBeNull();
    await fireEvent.press(getByLabelText('삭제 불가 확인'));
    expect(queryByText('삭제할 수 없어요')).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();

    // Categories without routines still delete through the normal confirm.
    await fireEvent.press(getByLabelText('공부 삭제'));
    expect(getByText('카테고리 삭제')).toBeTruthy();
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
      expect.objectContaining({ id: '공부', label: '심화 공부', icon: 'book' }),
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
