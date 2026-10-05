import { Platform } from 'react-native';

/**
 * 가구 거래소 (#1427) — 서버 계약 `rougether-spec/domains/market`.
 *
 * **MARKET_ENABLED = false인 동안 거래소는 사용자에게 전혀 보이지 않는다** — 꾸미기의
 * 거래소 탭·AI 가구 스튜디오의 "거래소에 올리기"·꾸미기의 판매 중 안내 줄 모두 이 플래그로
 * 숨고, 거래소 요청도 나가지 않는다. 거래소 가구는 이용자가 올린 **사진으로 만든 공개
 * 콘텐츠(UGC)** 라, 앱 안에 신고 수단이 있어야 한다(App Store 심사 가이드 1.2). 서버의
 * 신고 API(TripleS-soma/rougether-server#423)가 배포되고 상세 화면의 `onReport`에
 * 연결한 뒤에 켠다. 켤 때는 개인정보 처리방침·스토어 문구도 같이 고친다(AGENTS.md
 * "새 데이터·새 권한").
 *
 * 2026-09-29부터 내부 테스트 채널에서만 켰다가, **2026-10-05 제품 오너 확인으로 스토어 앱에도
 * 연다**(개인정보처리방침 2.0 반영 후). 웹앱은 아직 닫아 둔다 — 실기기로만 확인한 기능이다.
 */
export const MARKET_ENABLED = Platform.OS !== 'web';

/** 주문 가격 1~1,000 코인 정수 (POST /market/orders `price`). */
export const MARKET_PRICE_MIN = 1;
export const MARKET_PRICE_MAX = 1000;
/** 발행 수량 1~10(제작자 보유분 1개 포함), 발행 재고 판매도 한 번에 최대 10개. */
export const MARKET_MAX_SUPPLY = 10;
/** 목록 한 페이지 (서버 기본 20, 최대 100). */
export const MARKET_PAGE_SIZE = 20;
/** 상세의 최근 체결 — 첫 페이지만. */
export const MARKET_TRADES_SIZE = 10;
/** 상세의 호가 요약 — 판매·구매 각각 위에서 3단계. */
export const MARKET_BOOK_DEPTH = 3;

/** 로열티 10%(제작자 지급)·수수료 5%(소각) — 퍼센트 정수로 두고 정수 산술로 내림한다. */
export const MARKET_ROYALTY_PERCENT = 10;
export const MARKET_FEE_PERCENT = 5;

/**
 * 접수 결과 폴링 (spec: "0.5~1초 간격, 몇 번"). 700ms × 8회 ≈ 5.6초 — 그 뒤에도 PENDING이면
 * "내 주문에서 확인해 주세요"로 접는다(주문은 이미 접수됐다).
 */
export const MARKET_POLL_INTERVAL_MS = 700;
export const MARKET_POLL_TRIES = 8;
/** 네트워크 실패의 자동 재시도 횟수 — 같은 requestId로만(서버가 기존 접수를 돌려준다). */
export const MARKET_NETWORK_RETRIES = 2;
