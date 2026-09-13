import { render } from '@testing-library/react-native';

import { MergeGame } from '@/components/minigame/merge-game';
import { RunnerGame } from '@/components/minigame/runner-game';
import { StairsGame } from '@/components/minigame/stairs-game';

jest.mock('react-native-webview', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    WebView: React.forwardRef(function MockWebView(props: object, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
      return React.createElement(View, props);
    }),
  };
});
jest.mock('@/features/minigame/runner-html', () => ({ createRunnerHtml: () => '<html/>' }));
jest.mock('@/features/minigame/stairs-html', () => ({ createStairsHtml: () => '<html/>' }));
jest.mock('@/features/minigame/merge-html', () => ({ createMergeHtml: () => '<html/>' }));

/**
 * Fabric casts every prop against the RNCWebView codegen spec while creating the shadow
 * node. The iOS wrapper normalizes scalars into arrays, the Android wrapper forwards props
 * as-is — so a scalar in an array-typed prop segfaults in `RawValue::castValue` before the
 * game even mounts (Sentry ROUGETHER-MOBILE-S, 2026-09-13: `dataDetectorTypes="none"` killed
 * all three games on Android). Keep the list in sync with RNCWebViewNativeComponent.ts.
 */
const ARRAY_TYPED_PROPS = ['dataDetectorTypes', 'originWhitelist', 'menuItems'] as const;

describe.each([
  ['runner', 'runner-game', () => <RunnerGame seed={42} onFinish={jest.fn()} />],
  ['stairs', 'stairs-game', () => <StairsGame seed={42} onFinish={jest.fn()} />],
  ['merge', 'merge-game', () => <MergeGame seed={42} onFinish={jest.fn()} />],
])('%s game WebView props are Android-safe', (_name, testID, renderGame) => {
  it.each(ARRAY_TYPED_PROPS)('never passes a scalar as %s', async (prop) => {
    const { getByTestId } = await render(renderGame());
    const value = getByTestId(testID).props[prop];
    expect(value === undefined || Array.isArray(value)).toBe(true);
  });
});
