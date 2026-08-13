/**
 * @bacons/apple-targets mock (#606) — 네이티브 App Group 브리지 없이
 * ExtensionStorage 표면만. 인스턴스별 메모리 저장이라 왕복 테스트도 가능.
 */
const stores = new Map();

class ExtensionStorage {
  constructor(appGroup) {
    this.appGroup = appGroup;
    if (!stores.has(appGroup)) stores.set(appGroup, new Map());
  }
  set(key, value) {
    stores.get(this.appGroup).set(key, value);
  }
  get(key) {
    return stores.get(this.appGroup).get(key) ?? null;
  }
  remove(key) {
    stores.get(this.appGroup).delete(key);
  }
}
ExtensionStorage.reloadWidget = jest.fn();
ExtensionStorage.reloadControls = jest.fn();

module.exports = { ExtensionStorage };
