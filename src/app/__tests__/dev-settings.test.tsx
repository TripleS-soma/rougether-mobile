import { render } from '@testing-library/react-native';

import DevSettingsRoute from '@/app/(tabs)/dev-settings';

const mockPreview = jest.fn(() => null);
const mockRedirect = jest.fn((_props: unknown) => null);
jest.mock('@/dev/settings-update-preview', () => ({
  SettingsUpdatePreview: () => mockPreview(),
}));
jest.mock('expo-router', () => ({ Redirect: (props: unknown) => mockRedirect(props) }));

afterEach(() => {
  Object.assign(globalThis, { __DEV__: true });
  jest.clearAllMocks();
});

it('renders simulated update controls only in development', async () => {
  await render(<DevSettingsRoute />);
  expect(mockPreview).toHaveBeenCalled();
  expect(mockRedirect).not.toHaveBeenCalled();
});

it('redirects home in production without mounting simulated updates', async () => {
  Object.assign(globalThis, { __DEV__: false });
  await render(<DevSettingsRoute />);
  expect(mockRedirect).toHaveBeenCalledWith({ href: '/' });
  expect(mockPreview).not.toHaveBeenCalled();
});
