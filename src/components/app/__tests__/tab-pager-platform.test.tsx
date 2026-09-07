import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { type PanGesture, PointerType, State } from 'react-native-gesture-handler';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import type {
  AdaptedEvent,
  ResultEvent,
  ResultTouchEvent,
} from 'react-native-gesture-handler/lib/typescript/web/interfaces';

import { TabPager } from '@/components/app/tab-pager';

// Use the shipped JS and declarations: importing its TS sources directly makes
// tsc check browser timer internals against this project's Node timer globals.
/* eslint-disable @typescript-eslint/no-require-imports -- JS and declarations ship in separate directories. */
const WebPanGestureHandler: typeof import('react-native-gesture-handler/lib/typescript/web/handlers/PanGestureHandler').default =
  require('react-native-gesture-handler/lib/commonjs/web/handlers/PanGestureHandler').default;
const {
  EventTypes,
}: typeof import('react-native-gesture-handler/lib/typescript/web/interfaces') = require('react-native-gesture-handler/lib/commonjs/web/interfaces');
/* eslint-enable @typescript-eslint/no-require-imports */

/** Runs the installed web recognizer's real activation/touch callback order. */
class PointerProbe extends WebPanGestureHandler {
  readonly states: State[] = [];
  connect(pan: PanGesture) {
    this.handlerTag = 100000 + pan.handlerTag;
    const manager = {
      handlerTag: this.handlerTag,
      begin: () => this.begin(),
      activate: () => this.activate(true),
      fail: () => this.fail(),
      end: () => this.end(),
    };
    this.init(1, {
      current: {
        onGestureHandlerStateChange: ({ nativeEvent }: ResultEvent) => {
          this.states.push(nativeEvent.state);
          if (nativeEvent.state === State.ACTIVE) {
            pan.handlers.onStart?.(
              nativeEvent as unknown as Parameters<NonNullable<typeof pan.handlers.onStart>>[0],
            );
          }
        },
        onGestureHandlerEvent: ({ nativeEvent }: ResultTouchEvent) => {
          if (nativeEvent.eventType === 1) pan.handlers.onTouchesDown?.(nativeEvent, manager);
          if (nativeEvent.eventType === 2) pan.handlers.onTouchesMove?.(nativeEvent, manager);
        },
      },
    });
    this.updateGestureConfig({
      enabled: true,
      needsPointerData: true,
      activeOffsetXStart: pan.config.activeOffsetXStart,
      activeOffsetXEnd: pan.config.activeOffsetXEnd,
      manualActivation: pan.config.manualActivation,
      maxPointers: pan.config.maxPointers,
    });
  }

  pointer(x: number, y: number, eventType: AdaptedEvent['eventType']) {
    const event: AdaptedEvent = {
      x,
      y,
      offsetX: x,
      offsetY: y,
      pointerId: 1,
      pointerType: PointerType.TOUCH,
      time: eventType === EventTypes.DOWN ? 0 : 30,
      eventType,
    };
    if (eventType === EventTypes.DOWN) this.onPointerDown(event);
    else this.onPointerMove(event);
  }
}

it.each([
  [30, 80, State.FAILED],
  [-30, 80, State.FAILED],
  [40, 20, State.ACTIVE],
])(
  'classifies the first large pointer move (%i, %i) before automatic activation',
  async (dx, dy, expected) => {
    await render(
      <TabPager index={1} onIndexChange={jest.fn()}>
        <Text>방</Text>
        <Text>집</Text>
      </TabPager>,
    );
    const pan = getByGestureTestId('tab-pager-pan') as PanGesture;
    const probe = new PointerProbe({
      view: {},
      init: () => {},
      reset: () => {},
      destroy: () => {},
      measureView: () => ({ pageX: 0, pageY: 0, width: 400, height: 800 }),
      isPointerInBounds: () => true,
      onBegin: () => {},
      onActivate: () => {},
      onEnd: () => {},
      onCancel: () => {},
      onFail: () => {},
      onEnabledChange: () => {},
    });
    probe.connect(pan);
    try {
      probe.pointer(100, 100, EventTypes.DOWN);
      probe.pointer(100 + dx, 100 + dy, EventTypes.MOVE);
      expect(probe.states).toContain(expected);
      if (expected === State.FAILED) expect(probe.states).not.toContain(State.ACTIVE);
    } finally {
      probe.cancel();
      probe.reset();
    }
  },
);
