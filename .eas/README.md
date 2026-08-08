# Production OTA fingerprint baseline

`production-fingerprints.json`은 현재 스토어 빌드와 OTA 번들의 네이티브
호환성을 확인하는 기준입니다. `main`은 `runtimeVersion.policy = appVersion`을
사용하므로, 앱 버전이나 네이티브 구성이 바뀌면 새 스토어 빌드와 기준 갱신이
반드시 함께 이루어져야 합니다.

## 새 production 빌드에서 기준 갱신

1. 새 스토어 빌드에 사용할 정확한 소스 커밋을 checkout하고 `npm ci`를 실행합니다.
2. 아래 명령으로 두 플랫폼의 지문을 계산합니다.

   ```bash
   npx expo-updates fingerprint:generate --platform android | jq -r .hash
   npx expo-updates fingerprint:generate --platform ios | jq -r .hash
   ```

3. `production-fingerprints.json`의 `sourceCommit`, `runtimeVersion`, `fingerprints`를
   같은 소스와 `app.json` 버전에 맞게 갱신합니다.
4. `node scripts/check-production-ota-safety.js`가 통과하는지 확인합니다.
5. 해당 커밋으로 EAS `production` 스토어 빌드를 완료한 뒤,
   `node scripts/check-production-build-baseline.js`로 EAS build record의 커밋,
   runtime, 지문이 기준과 모두 일치하는지 확인합니다. 이 명령은 Expo 로그인이
   필요하며 PR에서는 `production-baseline-check` workflow가 대신 실행합니다.

`package.json`에 재생성 script를 추가하면 그 script 목록 자체가 Expo 지문에
포함되므로, 기준 갱신 명령은 이 문서에만 둡니다.
