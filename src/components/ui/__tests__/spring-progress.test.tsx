import { render } from '@testing-library/react-native';

import { SpringProgressBar } from '@/components/ui/spring-progress';

// 값은 aria-value* 로 내보낸다 — RN Web은 accessibilityValue 객체를 DOM으로 옮기지 않아 웹 progressbar에
// 값·이름이 빠졌다(#1389). 네이티브는 aria-value*를 accessibilityValue로 합친다.
const valueOf = (props: Record<string, unknown>) => ({
  min: props['aria-valuemin'],
  max: props['aria-valuemax'],
  now: props['aria-valuenow'],
});

describe('SpringProgressBar (#696)', () => {
  it('exposes progress as an accessible progressbar value', async () => {
    const { getByRole } = await render(
      <SpringProgressBar progress={0.6} color="#8A6E4B" trackColor="#EFE7DA" />,
    );
    expect(valueOf(getByRole('progressbar').props)).toEqual({ min: 0, max: 100, now: 60 });
  });

  it('re-renders to the new value when progress changes', async () => {
    const view = await render(
      <SpringProgressBar progress={0.5} color="#8A6E4B" trackColor="#EFE7DA" />,
    );
    await view.rerender(<SpringProgressBar progress={1} color="#8A6E4B" trackColor="#EFE7DA" />);
    expect(valueOf(view.getByRole('progressbar').props)).toEqual({ min: 0, max: 100, now: 100 });
  });

  it('progressbar에 이름을 준다 — 없으면 기본 "진행률", 주면 그 이름 (#1389)', async () => {
    const plain = await render(
      <SpringProgressBar progress={0.2} color="#8A6E4B" trackColor="#EFE7DA" />,
    );
    expect(plain.getByLabelText('진행률')).toBeTruthy();
    const named = await render(
      <SpringProgressBar
        progress={0.2}
        color="#8A6E4B"
        trackColor="#EFE7DA"
        accessibilityLabel="오늘 루틴 진행"
      />,
    );
    expect(named.getByLabelText('오늘 루틴 진행')).toBeTruthy();
  });
});
