/**
 * 지문 추가 소스 (#744 후속) — `targets/`(@bacons/apple-targets가 읽는 iOS
 * 위젯 익스텐션 소스)가 기본 지문 입력에 잡히지 않는다. 위젯 Swift만 고치면
 * 지문이 그대로여서 EAS가 "일치하는 빌드 있음"으로 판단해 OTA만 내보내고,
 * 위젯 바이너리는 갱신되지 않는다 — 고쳐도 안 고쳐지는 조용한 함정.
 *
 * @type {import('@expo/fingerprint').Config}
 */
module.exports = {
  extraSources: [{ type: 'dir', filePath: 'targets', reasons: ['appleTargets'] }],
};
