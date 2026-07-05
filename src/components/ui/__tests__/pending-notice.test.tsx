import { render } from '@testing-library/react-native';

import { PendingNotice } from '@/components/ui/pending-notice';

describe('PendingNotice', () => {
  it('renders the pending text', async () => {
    const { getByText } = await render(<PendingNotice text="서버 준비 중이에요" />);
    expect(getByText('서버 준비 중이에요')).toBeTruthy();
  });
});
