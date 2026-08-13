import { fireEvent, render } from '@testing-library/react-native';

import { CurrencyGuide } from '@/components/ui/currency-guide';

describe('CurrencyGuide (#789)', () => {
  it('기본은 접혀 있고, 탭하면 두 재화의 수급처·사용처를 펼친다', async () => {
    const { getByLabelText, getByText, queryByText } = await render(<CurrencyGuide />);

    // 내역을 보러 온 사람을 막지 않는다 — 제목만 보인다.
    expect(queryByText('루틴 완료')).toBeNull();

    await fireEvent.press(getByLabelText('코인·다이아는 어떻게 모으나요?'));

    // 코인 쪽: 적립 규칙은 서버 고정 정책이라 수치를 그대로 적는다.
    expect(getByText('루틴 완료')).toBeTruthy();
    expect(getByText('+10')).toBeTruthy();
    expect(getByText('할 일 완료')).toBeTruthy();
    // "왜 코인이 안 들어오지?"의 답 — 상한을 반드시 노출한다.
    expect(getByText(/하루 4건까지/)).toBeTruthy();
    // 다이아 쪽: 코인 → 뽑기 → 중복 전환 → 가구 구매로 경제가 이어지도록
    // 어느 필을 눌러도 두 재화를 함께 보여준다.
    expect(getByText(/이미 가진 아이템이 나오면 전환/)).toBeTruthy();
    expect(getByText('꾸미기에서 가구 구매')).toBeTruthy();
  });

  it('뽑기 계열 금액은 숫자로 적지 않는다 — 서버 값과 어긋나면 거짓말이 된다', async () => {
    const { getByText, queryByText } = await render(<CurrencyGuide initialOpen />);

    expect(getByText('뽑기')).toBeTruthy();
    expect(getByText('머신마다 다름')).toBeTruthy();
    expect(getByText('아이템마다 다름')).toBeTruthy();
    // 실서버는 뽑기 −25 / 중복 전환 +3 — 스펙 문서의 250·30과 다르다.
    expect(queryByText('+30')).toBeNull();
    expect(queryByText('+200')).toBeNull();
  });

  it('다시 탭하면 접힌다', async () => {
    const { getByLabelText, queryByText } = await render(<CurrencyGuide initialOpen />);

    await fireEvent.press(getByLabelText('코인·다이아는 어떻게 모으나요?'));
    expect(queryByText('루틴 완료')).toBeNull();
  });
});
