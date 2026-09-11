import { SERVICE_WORKER_REGISTER_SCRIPT } from '@/lib/web-service-worker';

/** 인라인 스크립트를 가짜 브라우저 전역으로 실행하고, load 콜백을 돌려준다. */
function runScript(navigator: object) {
  let onLoad: (() => void) | undefined;
  const addEventListener = (type: string, callback: () => void) => {
    if (type === 'load') onLoad = callback;
  };
  new Function('navigator', 'addEventListener', SERVICE_WORKER_REGISTER_SCRIPT)(
    navigator,
    addEventListener,
  );
  return onLoad;
}

describe('서비스워커 등록 스크립트', () => {
  /**
   * 2026-09-11 Sentry `Error: Rejected` — 등록이 막힌 환경(크롤러·헤드리스·저장소 차단
   * 브라우저)에서 `register`가 거부되면 처리되지 않은 오류로 보고됐다. 앱은 SW 없이도
   * 돌아가므로 실패는 조용히 삼킨다.
   */
  it('등록이 거부돼도 처리되지 않은 오류로 새지 않는다', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const register = jest.fn(() => Promise.reject(new Error('Rejected')));
      runScript({ serviceWorker: { register } })?.();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(register).toHaveBeenCalledWith('/sw.js');
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('서비스워커를 지원하지 않는 브라우저에서는 아무것도 하지 않는다', () => {
    expect(runScript({})).toBeUndefined();
  });
});
