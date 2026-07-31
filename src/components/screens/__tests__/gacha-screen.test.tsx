import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { GachaMachine } from '@/api/adapters';
import type { DrawResult } from '@/api/types';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { ToastProvider } from '@/components/ui/toast';

const machine: GachaMachine = {
  id: 1,
  name: '작은 베이커리 아침 뽑기',
  costCurrencyType: 'COIN',
  costAmount: 250,
  drawCount: 1,
  icon: 'croissant' as const,
  accent: '#F7E6C8',
  kind: 'furniture',
};

const characterMachine: GachaMachine = {
  id: 12,
  name: '캐릭터 뽑기',
  costCurrencyType: 'COIN',
  costAmount: 1000,
  drawCount: 1,
  icon: 'paw' as const,
  accent: '#D6E4D2',
  kind: 'character',
};

describe('GachaScreen', () => {
  it('renders the title and balance', async () => {
    const { getByText } = await render(<GachaScreen coinBalance={5600} />);
    expect(getByText('뽑기')).toBeTruthy();
    expect(getByText('5,600')).toBeTruthy();
  });

  it('splits the selector into furniture and character rows', async () => {
    const both = await render(
      <GachaScreen gachas={[machine, characterMachine]} coinBalance={5600} />,
    );
    expect(both.getByText('가구 뽑기')).toBeTruthy();
    expect(both.getByText('캐릭터 뽑기')).toBeTruthy();

    // Without a character machine the character row disappears entirely.
    const onlyFurniture = await render(<GachaScreen gachas={[machine]} coinBalance={5600} />);
    expect(onlyFurniture.queryByText('캐릭터 뽑기')).toBeNull();
  });

  it('뽑기 상자 선택 상태를 accessibilityState로 전달한다 (#550)', async () => {
    const { getByLabelText } = await render(
      <GachaScreen gachas={[machine, characterMachine]} coinBalance={5600} />,
    );
    // 첫 머신이 기본 선택 — 다른 머신을 탭하면 선택이 옮겨간다.
    expect(getByLabelText('작은 베이커리 아침 뽑기').props.accessibilityState?.selected).toBe(true);
    await fireEvent.press(getByLabelText('캐릭터 뽑기'));
    expect(getByLabelText('캐릭터 뽑기').props.accessibilityState?.selected).toBe(true);
    expect(getByLabelText('작은 베이커리 아침 뽑기').props.accessibilityState?.selected).toBe(
      false,
    );
  });

  it('draws from the API and reveals the reward', async () => {
    const onDraw = jest.fn(async (): Promise<DrawResult[]> => [
      { name: '허브 화분', rarity: '희귀', converted: false },
    ]);
    const { getByText } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} />,
    );

    await fireEvent.press(getByText('1회 뽑기'));

    expect(onDraw).toHaveBeenCalledWith(1, 1);
    // 차지(1.8s) → 버스트(0.65s)를 지나 리빌 — 실제 타이머라 여유를 둔다 (#431).
    await waitFor(() => expect(getByText('허브 화분')).toBeTruthy(), { timeout: 8000 });
  });

  it('다연차는 뒷면 카드로 깔리고 탭하면 즉시 뒤집힌다 (#431, 5+1 라벨 #520)', async () => {
    const onDraw = jest.fn(async (): Promise<DrawResult[]> => [
      { name: '허브 화분', rarity: '희귀', converted: false },
      { name: '나무 의자', rarity: '일반', converted: false },
    ]);
    const { getByText, getByLabelText } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} />,
    );

    await fireEvent.press(getByText('5+1회 뽑기'));
    await waitFor(() => expect(getByText('축하해요!')).toBeTruthy(), { timeout: 8000 });

    // 두 장 모두 뒷면 카드로 깔린다 (자동 플립 전).
    const first = getByLabelText('1번째 카드 뒤집기');
    expect(getByLabelText('2번째 카드 뒤집기')).toBeTruthy();

    // 탭하면 그 카드는 즉시 뒤집혀 아이템 라벨이 된다.
    await fireEvent.press(first);
    await waitFor(() => expect(getByLabelText('허브 화분')).toBeTruthy());
  });

  it("신규 획득 가구 카드에 '방에 놓기'가 뜨고 탭하면 배치됨으로 바뀐다 (#622)", async () => {
    const onDraw = jest.fn(async (): Promise<DrawResult[]> => [
      { itemId: 7, name: '허브 화분', rarity: '희귀', converted: false },
    ]);
    const onPlaceInRoom = jest.fn(async () => true);
    const { getByText, getByLabelText, queryByLabelText } = await render(
      <ToastProvider>
        <GachaScreen
          gachas={[machine]}
          coinBalance={5600}
          onDraw={onDraw}
          placeableItemIds={['7']}
          onPlaceInRoom={onPlaceInRoom}
        />
      </ToastProvider>,
    );

    await fireEvent.press(getByText('1회 뽑기'));
    await waitFor(() => expect(getByLabelText('방에 놓기')).toBeTruthy(), { timeout: 8000 });
    // 단챠 1장에는 전부 놓기가 없다.
    expect(queryByLabelText('전부 놓기')).toBeNull();

    await fireEvent.press(getByLabelText('방에 놓기'));
    expect(onPlaceInRoom).toHaveBeenCalledWith([
      expect.objectContaining({ itemId: 7, name: '허브 화분' }),
    ]);
    await waitFor(() => expect(getByLabelText('방에 배치됨')).toBeTruthy());
  });

  it('중복(전환)·비가구 카드에는 배치 버튼이 없다 (#622)', async () => {
    const onDraw = jest.fn(async (): Promise<DrawResult[]> => [
      { itemId: 7, name: '중복 화분', rarity: '희귀', converted: true, refundAmount: 3 },
      { characterId: 2, name: '판다', rarity: '전설', converted: false },
    ]);
    const { getByText, getByLabelText, queryByLabelText } = await render(
      <GachaScreen
        gachas={[machine]}
        coinBalance={5600}
        onDraw={onDraw}
        placeableItemIds={['7']}
        onPlaceInRoom={jest.fn(async () => true)}
      />,
    );

    await fireEvent.press(getByText('5+1회 뽑기'));
    await waitFor(() => expect(getByText('축하해요!')).toBeTruthy(), { timeout: 8000 });
    await fireEvent.press(getByLabelText('1번째 카드 뒤집기'));
    await fireEvent.press(getByLabelText('2번째 카드 뒤집기'));
    await waitFor(() => expect(getByLabelText('판다')).toBeTruthy());
    expect(queryByLabelText('방에 놓기')).toBeNull();
    expect(queryByLabelText('전부 놓기')).toBeNull();
  });

  it("배치 가능 카드가 2장 이상이면 '전부 놓기'가 한 번의 호출로 다 놓는다 (#622)", async () => {
    const onDraw = jest.fn(async (): Promise<DrawResult[]> => [
      { itemId: 7, name: '허브 화분', rarity: '희귀', converted: false },
      { itemId: 8, name: '나무 의자', rarity: '일반', converted: false },
    ]);
    const onPlaceInRoom = jest.fn(async () => true);
    const { getByText, getByLabelText, queryByLabelText } = await render(
      <GachaScreen
        gachas={[machine]}
        coinBalance={5600}
        onDraw={onDraw}
        placeableItemIds={['7', '8']}
        onPlaceInRoom={onPlaceInRoom}
      />,
    );

    await fireEvent.press(getByText('5+1회 뽑기'));
    await waitFor(() => expect(getByLabelText('전부 놓기')).toBeTruthy(), { timeout: 8000 });
    await fireEvent.press(getByLabelText('전부 놓기'));
    expect(onPlaceInRoom).toHaveBeenCalledTimes(1);
    expect(onPlaceInRoom).toHaveBeenCalledWith([
      expect.objectContaining({ itemId: 7 }),
      expect.objectContaining({ itemId: 8 }),
    ]);
    // 전부 배치되면 버튼이 사라진다.
    await waitFor(() => expect(queryByLabelText('전부 놓기')).toBeNull());
  });

  it('draws six for the price of five with the 5+1 button', async () => {
    const onDraw = jest.fn(async (): Promise<DrawResult[]> => []);
    const { getByText } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} />,
    );

    // 5+1 costs costAmount × 5 (1,250) and requests six results.
    expect(getByText('1,250')).toBeTruthy();
    await fireEvent.press(getByText('5+1회 뽑기'));
    expect(onDraw).toHaveBeenCalledWith(1, 6);
  });

  it('explains an unaffordable pull with a toast instead of drawing', async () => {
    const onDraw = jest.fn();
    const { getByText } = await render(
      <ToastProvider>
        <GachaScreen gachas={[machine]} coinBalance={100} onDraw={onDraw} />
      </ToastProvider>,
    );

    // The blocked button stays tappable — the tap says why nothing happens.
    await fireEvent.press(getByText('1회 뽑기'));
    expect(getByText('잔액이 부족해요')).toBeTruthy();
    expect(onDraw).not.toHaveBeenCalled();
  });

  // 로드 실패는 빈 상태('뽑기 없음')로 위장하지 않는다 (#549).
  it('로드 실패 시 빈 상태 대신 실패 + 다시 시도를 보여준다 (#549)', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <GachaScreen gachas={[]} loadError onRetry={onRetry} />,
    );

    expect(getByText('뽑기 목록을 불러오지 못했어요.')).toBeTruthy();
    expect(queryByText('지금은 뽑을 수 있는 뽑기가 없어요.')).toBeNull();
    await fireEvent.press(getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 온보딩 미션 완료 타이밍 (#571 후속) — 뽑기 연출이 끝나고 확인을 누른
  // 순간에만 셸에 알린다. 뽑기 직후 완료시키면 미션 시트가 연출을 덮는다.
  it('결과 확인을 누른 순간에만 onResultsConfirmed가 불린다', async () => {
    const onDraw = jest.fn(async (): Promise<DrawResult[]> => [
      { name: '허브 화분', rarity: '희귀', converted: false },
    ]);
    const onResultsConfirmed = jest.fn();
    const { getByText, getByLabelText } = await render(
      <GachaScreen
        gachas={[machine]}
        coinBalance={5600}
        onDraw={onDraw}
        onResultsConfirmed={onResultsConfirmed}
      />,
    );

    await fireEvent.press(getByText('1회 뽑기'));
    // 연출이 도는 동안(리빌 전)에는 아직 아니다.
    expect(onResultsConfirmed).not.toHaveBeenCalled();
    await waitFor(() => expect(getByText('허브 화분')).toBeTruthy(), { timeout: 8000 });
    expect(onResultsConfirmed).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('확인'));
    expect(onResultsConfirmed).toHaveBeenCalledTimes(1);
  });
});
