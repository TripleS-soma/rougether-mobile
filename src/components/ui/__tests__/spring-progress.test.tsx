import { render } from '@testing-library/react-native';

import { SpringProgressBar } from '@/components/ui/spring-progress';

describe('SpringProgressBar (#696)', () => {
  it('exposes progress as an accessible progressbar value', async () => {
    const { getByRole } = await render(
      <SpringProgressBar progress={0.6} color="#8A6E4B" trackColor="#EFE7DA" />,
    );
    expect(getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 60,
    });
  });

  it('re-renders to the new value when progress changes', async () => {
    const view = await render(
      <SpringProgressBar progress={0.5} color="#8A6E4B" trackColor="#EFE7DA" />,
    );
    await view.rerender(<SpringProgressBar progress={1} color="#8A6E4B" trackColor="#EFE7DA" />);
    expect(view.getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 100,
    });
  });
});
