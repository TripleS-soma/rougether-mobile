import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/**
 * 내부 테스트 빌드인가 — EAS `internal` 채널(eas.json preview 프로필, dev 브랜치 OTA).
 * 스토어 빌드(`dev`·`production` 채널)·웹·테스트에서는 false라, 이 값으로 켠 기능은
 * 내부 기기에서만 먼저 보인다. 운영 서버를 그대로 쓰니 내부에서도 실제 데이터가 오간다.
 */
export const IS_INTERNAL_CHANNEL = Platform.OS !== 'web' && Updates.channel === 'internal';
