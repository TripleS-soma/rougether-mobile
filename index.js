/**
 * 앱 엔트리 — expo-router 기본 엔트리에 안드로이드 위젯 태스크 핸들러
 * 등록(#604)을 얹는다. 위젯 렌더는 UI 마운트 없이(headless) 이 파일이
 * 실행될 때 등록돼 있어야 한다.
 */
import 'expo-router/entry';

import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { widgetTaskHandler } = require('./src/widgets/rougether-widgets');
  registerWidgetTaskHandler(widgetTaskHandler);
}
