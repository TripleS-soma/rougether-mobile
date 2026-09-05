import { render } from '@testing-library/react-native';

import DevNavigationRoute from '@/app/(tabs)/dev-navigation';

const mockPreview = jest.fn(() => null);
const mockRedirect = jest.fn((_props: unknown) => null);
jest.mock('@/dev/navigation-preview', () => ({ NavigationPreview: () => mockPreview() }));
jest.mock('expo-router', () => ({ Redirect: (props: unknown) => mockRedirect(props) }));

afterEach(() => {
  Object.assign(globalThis, { __DEV__: true });
  jest.clearAllMocks();
});

it('only renders the fixture in development', async () => {
  await render(<DevNavigationRoute />);
  expect(mockPreview).toHaveBeenCalled();
  expect(mockRedirect).not.toHaveBeenCalled();
});

it('redirects to home in production without rendering the fixture', async () => {
  Object.assign(globalThis, { __DEV__: false });
  await render(<DevNavigationRoute />);
  expect(mockRedirect).toHaveBeenCalledWith({ href: '/' });
  expect(mockPreview).not.toHaveBeenCalled();
});
