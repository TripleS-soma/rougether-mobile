import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CategoryManageScreen } from '@/components/screens/category-manage-screen';
import { ROUTINE_CATEGORIES } from '@/constants/routines';

describe('CategoryManageScreen', () => {
  it('renders the header, list, and opens the create sheet from +', async () => {
    const { getByText, getByLabelText, queryByText } = await render(
      <CategoryManageScreen categories={ROUTINE_CATEGORIES} />,
    );

    expect(getByText('카테고리 관리')).toBeTruthy();
    expect(getByText(`내 카테고리 (${ROUTINE_CATEGORIES.length})`)).toBeTruthy();

    // 생성 폼은 시트라 + 를 누르기 전엔 없다.
    expect(queryByText('새 카테고리')).toBeNull();
    await fireEvent.press(getByLabelText('새 카테고리 추가'));
    expect(getByText('새 카테고리')).toBeTruthy();
  });

  it('creates a category through the sheet', async () => {
    const onCreate = jest.fn();
    const { getByText, getByLabelText, getByPlaceholderText, queryByText } = await render(
      <CategoryManageScreen categories={[]} onCreate={onCreate} />,
    );

    expect(getByText('아직 카테고리가 없어요.')).toBeTruthy();
    await fireEvent.press(getByLabelText('새 카테고리 추가'));
    await fireEvent.changeText(getByPlaceholderText('예) 자기계발'), '일기');
    await fireEvent.press(getByLabelText('카테고리 추가'));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: '일기' }));
    // 제출 후 시트가 닫힌다 — 퇴장 애니메이션(#448)이 끝나길 기다린다.
    await waitFor(() => expect(queryByText('새 카테고리')).toBeNull());
  });

  it('opens the edit sheet prefilled from a row pencil', async () => {
    const onUpdate = jest.fn();
    const { getByText, getByLabelText, getByDisplayValue } = await render(
      <CategoryManageScreen categories={ROUTINE_CATEGORIES} onUpdate={onUpdate} />,
    );

    await fireEvent.press(getByLabelText('공부 수정'));
    expect(getByText("'공부' 수정하기")).toBeTruthy();
    await fireEvent.changeText(getByDisplayValue('공부'), '심화 공부');
    await fireEvent.press(getByLabelText('카테고리 저장'));
    expect(onUpdate).toHaveBeenCalledWith('공부', expect.objectContaining({ name: '심화 공부' }));
  });

  it('reorders categories via long-press move mode', async () => {
    const onReorder = jest.fn();
    const { getByLabelText, queryByLabelText } = await render(
      <CategoryManageScreen categories={ROUTINE_CATEGORIES} onReorder={onReorder} />,
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
      <CategoryManageScreen categories={ROUTINE_CATEGORIES} onReorder={onReorder} />,
    );
    await fireEvent(getByLabelText('일정 카테고리'), 'longPress');
    await fireEvent.press(getByLabelText('일정 위로 이동'));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('살아있는 루틴이 있으면 삭제를 막고 안내한다 (#517)', async () => {
    const onDelete = jest.fn();
    const { getByLabelText, getByText, queryByText } = await render(
      <CategoryManageScreen
        categories={ROUTINE_CATEGORIES}
        inUseCounts={{ 일정: { routines: 2, todos: 3 } }}
        onDelete={onDelete}
      />,
    );

    await fireEvent.press(getByLabelText('일정 삭제'));
    expect(getByText('루틴을 먼저 정리해주세요')).toBeTruthy();
    expect(getByText(/루틴 2개가 있어요/)).toBeTruthy();
    await fireEvent.press(getByLabelText('삭제 불가 확인'));
    expect(queryByText('루틴을 먼저 정리해주세요')).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('루틴이 없으면 삭제 모드를 고른다 — 미분류 전환/완전 삭제 (#517)', async () => {
    const onDelete = jest.fn();
    const { getByLabelText, getByText } = await render(
      <CategoryManageScreen
        categories={ROUTINE_CATEGORIES}
        inUseCounts={{ 취미: { routines: 0, todos: 3 } }}
        onDelete={onDelete}
      />,
    );

    // 할 일만 있는 카테고리 — 차단 없이 모드 선택 모달.
    await fireEvent.press(getByLabelText('취미 삭제'));
    expect(getByText(/할 일 3개가 남아 있어요/)).toBeTruthy();
    await fireEvent.press(getByLabelText('미분류로 두고 삭제'));
    expect(onDelete).toHaveBeenCalledWith('취미', 'UNASSIGN');

    // 완전 삭제 경로.
    await fireEvent.press(getByLabelText('공부 삭제'));
    await fireEvent.press(getByLabelText('기록까지 완전 삭제'));
    expect(onDelete).toHaveBeenCalledWith('공부', 'PURGE');
  });

  it('deletes an existing category after choosing a mode (#517)', async () => {
    const onDelete = jest.fn();
    const { getByLabelText } = await render(
      <CategoryManageScreen categories={ROUTINE_CATEGORIES} onDelete={onDelete} />,
    );

    await fireEvent.press(getByLabelText('일정 삭제'));
    expect(onDelete).not.toHaveBeenCalled();
    await fireEvent.press(getByLabelText('미분류로 두고 삭제'));
    expect(onDelete).toHaveBeenCalledWith('일정', 'UNASSIGN');
  });

  it('navigates back through the header', async () => {
    const onBack = jest.fn();
    const { getByLabelText } = await render(
      <CategoryManageScreen categories={ROUTINE_CATEGORIES} onBack={onBack} />,
    );
    await fireEvent.press(getByLabelText('뒤로가기'));
    expect(onBack).toHaveBeenCalled();
  });
});
