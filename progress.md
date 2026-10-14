Original prompt: 이 게임 박자가 잘안맞는거같은데... 약간? 박자 맞춰서 이거 루게더 프로젝트 쪽으로 넘겨봐 음악도 루게더 타입으로해서 ㅇㅇ 미니게임에 추가하려고

- 2026-10-14: Isolated mobile worktree `feat/routine-rhythm` based directly on origin/dev; existing dirty main checkout preserved. Issue #1549 opened. Project board registration is unavailable because the existing gh token lacks read:project scope; credentials were not expanded.
- Original Rhythm Doctor game assets are not migrated. Uses existing Rougether cat artwork and live semantic theme tokens.
- User-authorized Suno generation created two instrumental songs. Downloaded first track through user's Chrome UI. Measured approximately116.1 BPM rather than requested120. Selected stable percussion passage and transient-aligned thirty-two targets, including holds and rush cues. Full timing evidence in analysis/rhythm/alignment-report.json.
- Separate graph clock for scheduling and audible output clock for rendering/input; getOutputTimestamp preferred, latency fallback and ten-tap calibration included. Pause/resume/lifecycle and channel-checked bridge included.
- Practice entry added to minigames surface, separate from ranked definitions/API. Dev registry includes RoutineRhythmPreview.
- Completed: real-audio first6 PERFECT including held pause/resume; deterministic32 PERFECT; +60ms calibration measured65ms; real Expo Dev iframe start/pause, no page errors. Provided web-game client screenshot inspected.
- Whole repository run:402 suites/3232 tests PASS (4 existing todo), then new real-picker practice test and lifecycle checks. Typecheck/lint/format pass; targeted post-fix checks cover transition retention.
- Stable percussion passage source39.9318367s→110.2507827s;32 targets with measured/inferred evidence separated, exact measured beats used. Source and playable asset hashes recorded; reproducible alignment script added.
- Remaining product integration: ranked server replay contract and real iOS/Android device/audio route tests. These do not claim to be completed by the local web adapter tests.

- User steering: 화면의 박자 가이드가 너무 쉽고 뒤로 갈수록 어려워져야 한다. Removed all visual cue counts, target circles, rush progress, periodic cat bounce and brand eyebrow. Four levels:4/4/8/16 notes,1x/1x/2x/4x cue speed,0/1/2/3 hidden cues,80/70/60/50ms PERFECT windows. ChartVersion2; ranked replay still excluded.

- Corrected over-removal after user feedback: restored Rhythm Doctor-inspired cue ECG, muted X gaps, single-cue rush wave, hold charge and input-only seventh response. Cue-aligned cat/heart response returns; free-running beat bounce and numbered target guide remain removed. Rising32-note progression and clean header retained.
- ECG revision verified: audible cue/X/rush/hold tests20 PASS; screenshot region byte-identical before/after seventh without input; actual wave/X/hold/rush frames inspected, no page errors. Typecheck/lint pass; full32 stage and real-audio QA rerun.
