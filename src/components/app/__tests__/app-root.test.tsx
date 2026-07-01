import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, waitFor } from '@testing-library/react-native';

import { AppRoot } from '@/components/app/app-root';

const KEY = 'rougether.onboarding.v1';

describe('AppRoot', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('shows onboarding on first launch', async () => {
    const { getByText } = await render(<AppRoot />);
    await waitFor(() => expect(getByText('루게더에 오신 걸 환영해요')).toBeTruthy());
  });

  it('goes straight to the app when onboarding was already completed', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: [] }));

    const { getByText } = await render(<AppRoot />);

    await waitFor(() => expect(getByText('준서의 방')).toBeTruthy()); // MyRoom title
  });
});
