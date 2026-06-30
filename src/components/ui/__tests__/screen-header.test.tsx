import { render } from '@testing-library/react-native';

import { ScreenHeader } from '@/components/ui/screen-header';

describe('ScreenHeader', () => {
  it('renders the title', async () => {
    const { getByText, queryByLabelText } = await render(<ScreenHeader title="가챠" />);
    expect(getByText('가챠')).toBeTruthy();
    // No back button without onBack.
    expect(queryByLabelText('뒤로 가기')).toBeNull();
  });

  it('shows a back button when onBack is provided', async () => {
    const { getByLabelText } = await render(<ScreenHeader title="가챠" onBack={() => {}} />);
    expect(getByLabelText('뒤로 가기')).toBeTruthy();
  });
});
