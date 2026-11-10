import { fireEvent, waitFor } from '@testing-library/react-native';

import { AppShell } from '@/components/app/app-shell';
import { renderWithProviders } from '@/test-utils/render';
import { jsonRes } from '@/test-utils/fetch';

jest.mock('@/components/app/use-christmas-surface', () => ({
  useChristmasSurface: (props: { onGoGacha: (id: number) => void }) => {
    const React = jest.requireActual('react');
    const { Pressable, Text } = jest.requireActual('react-native');
    return {
      active: false,
      pending: false,
      open: jest.fn(),
      overlays: React.createElement(
        Pressable,
        { accessibilityLabel: 'event CTA', onPress: () => props.onGoGacha(812) },
        React.createElement(Text, null, 'event CTA'),
      ),
    };
  },
}));
jest.mock('@/components/app/use-gacha-surface', () => ({
  useGachaSurface: (props: { screen: string; initialMachineId?: number; goBack: () => void }) => {
    const React = jest.requireActual('react');
    const { Pressable, Text, View } = jest.requireActual('react-native');
    return {
      subScreen:
        props.screen === 'gacha'
          ? React.createElement(
              View,
              null,
              React.createElement(Text, null, `request:${props.initialMachineId ?? 'ordinary'}`),
              React.createElement(
                Pressable,
                { accessibilityLabel: 'gacha back', onPress: props.goBack },
                React.createElement(Text, null, 'back'),
              ),
            )
          : null,
    };
  },
}));
jest.mock('@/components/screens/my-room-screen', () => ({
  MyRoomScreen: (props: { onOpenGacha?: () => void }) => {
    const React = jest.requireActual('react');
    const { Pressable, Text } = jest.requireActual('react-native');
    return React.createElement(
      Pressable,
      { accessibilityLabel: 'ordinary gacha', onPress: props.onOpenGacha },
      React.createElement(Text, null, 'ordinary gacha'),
    );
  },
}));
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
it('batches the event ID with navigation, clears it on exit and preserves the next ordinary entry', async () => {
  global.fetch = jest.fn(async () => jsonRes({ items: [] })) as unknown as typeof fetch;
  const ui = await renderWithProviders(<AppShell />);
  await fireEvent.press(ui.getByLabelText('event CTA'));
  await waitFor(() => expect(ui.getByText('request:812')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('gacha back'));
  await waitFor(() => expect(ui.queryByText('request:812')).toBeNull());
  await fireEvent.press(ui.getAllByLabelText('ordinary gacha')[0]);
  await waitFor(() => expect(ui.getByText('request:ordinary')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('gacha back'));
  await waitFor(() => expect(ui.queryByText('request:ordinary')).toBeNull());
  await fireEvent.press(ui.getByLabelText('event CTA'));
  await waitFor(() => expect(ui.getByText('request:812')).toBeTruthy());
});
