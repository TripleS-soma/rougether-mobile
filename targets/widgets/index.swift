import ImageIO
import SwiftUI
import UIKit
import WidgetKit

// 앱(JS)이 기록하는 App Group 계약 — src/widgets/widget-data.ts와 동일 키.
private let appGroup = "group.com.triples.rougether"
private let summaryKey = "summary"
private let roomImageKey = "roomImage"
private let themeKey = "theme"
/// 마지막 실제 접속 시각 ISO (#1122) — 앱이 포그라운드가 될 때마다 기록한다.
private let lastActiveKey = "lastActive"

// MARK: - 데이터

/// 오늘 요약 — 안드로이드 위젯과 동일 스키마 (done/total/streak/remaining 앞 3개).
/// `date`는 요약이 가리키는 Asia/Seoul 달력 날짜(#1122) — 구버전 앱이 남긴 값엔 없다.
struct WidgetSummary: Decodable {
  var done: Int
  var total: Int
  var streak: Int
  var remaining: [String]
  var date: String?

  init(done: Int, total: Int, streak: Int, remaining: [String], date: String? = nil) {
    self.done = done
    self.total = total
    self.streak = streak
    self.remaining = remaining
    self.date = date
  }

  static let empty = WidgetSummary(done: 0, total: 0, streak: 0, remaining: [])
}

func loadSummary() -> WidgetSummary {
  guard
    let raw = UserDefaults(suiteName: appGroup)?.string(forKey: summaryKey),
    let data = raw.data(using: .utf8),
    let parsed = try? JSONDecoder().decode(WidgetSummary.self, from: data)
  else { return .empty }
  return parsed
}

/// 방 캡처 — 앱이 저장한 data URI(base64)를 디코드한다. 위젯 프로세스는
/// 메모리 상한(~30MB)이 빡빡해 전체 비트맵 디코드 대신 ImageIO 썸네일
/// 다운샘플로 읽는다 (#744) — 구버전 앱이 남긴 1536px PNG 값에도 안전하고,
/// 위젯 표시 크기(최대 4×4)에는 800px이면 충분하다.
func loadRoomImage() -> UIImage? {
  guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: roomImageKey) else {
    return nil
  }
  let base64 = raw.contains(",") ? String(raw.split(separator: ",", maxSplits: 1)[1]) : raw
  guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
    return nil
  }
  let options: [CFString: Any] = [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceCreateThumbnailWithTransform: true,
    kCGImageSourceThumbnailMaxPixelSize: 800,
  ]
  guard
    let source = CGImageSourceCreateWithData(data as CFData, nil),
    let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
  else { return nil }
  return UIImage(cgImage: thumbnail)
}

/// 앱의 테마 모드('system'|'light'|'dark')가 적용된 실효 스킴 (#746).
/// 값이 없으면 nil — 위젯이 시스템 스킴으로 폴백한다.
func loadTheme() -> ColorScheme? {
  switch UserDefaults(suiteName: appGroup)?.string(forKey: themeKey) {
  case "dark": return .dark
  case "light": return .light
  default: return nil
  }
}


/// 마지막 접속 시각 (#1122) — JS `new Date().toISOString()` 형식(소수점 초 포함).
func loadLastActive() -> String? {
  UserDefaults(suiteName: appGroup)?.string(forKey: lastActiveKey)
}

// MARK: - 표정 (#1122) — src/widgets/widget-mood.ts와 같은 규칙·임계값
//
// 우선순위: 오래 안 옴(울음 5일+ > 슬픔 2일+) > 오늘 다 함(왕관 7일 스트릭 > 기쁨)
// > 저녁인데 남음(걱정) > 평소. 숫자는 JS 상수와 같아야 한다 —
// src/widgets/__tests__/widget-mood-ios-parity.test.ts가 이 파일을 읽어 대조한다.

/// 걱정 표정으로 바뀌는 시각(기기 로컬) — WIDGET_EVENING_HOUR.
let widgetEveningHour = 18
/// 미접속 임계 — WIDGET_SAD_DAYS / WIDGET_CRYING_DAYS.
let widgetSadDays = 2
let widgetCryingDays = 5
/// 왕관 — WIDGET_CROWN_STREAK.
let widgetCrownStreak = 7

private let daySeconds: TimeInterval = 24 * 60 * 60

enum WidgetFace: String {
  case neutral, happy, crown, worried, sad, crying

  /// 익스텐션 Assets.xcassets 이미지 이름 — targets/widgets/expo-target.config.js `images`.
  var imageName: String {
    switch self {
    case .neutral: return "faceNeutral"
    case .happy: return "faceHappy"
    case .crown: return "faceCrown"
    case .worried: return "faceWorried"
    case .sad: return "faceSad"
    case .crying: return "faceCrying"
    }
  }

  /// 걱정·슬픔·울음은 눈에 띄게(warningText), 나머지는 브랜드색(primaryText).
  var isConcerned: Bool {
    switch self {
    case .worried, .sad, .crying: return true
    default: return false
    }
  }
}

struct WidgetMood: Equatable {
  let face: WidgetFace
  /// 캐릭터 옆 한 줄 — 평소(neutral)에는 없다(남은 루틴 목록이 그 자리).
  let message: String?
}

/// ISO 8601 파서 — JS `toISOString()`(소수점 초)과 초 단위 둘 다 받는다.
private let isoFractional: ISO8601DateFormatter = {
  let f = ISO8601DateFormatter()
  f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return f
}()
private let isoPlain: ISO8601DateFormatter = {
  let f = ISO8601DateFormatter()
  f.formatOptions = [.withInternetDateTime]
  return f
}()

func parseIsoDate(_ raw: String?) -> Date? {
  guard let raw, !raw.isEmpty else { return nil }
  return isoFractional.date(from: raw) ?? isoPlain.date(from: raw)
}

/// 마지막 접속으로부터 지난 온전한 일수 — 기록이 없거나 깨졌으면 0(구버전 설치본이 갑자기 울지 않게).
func daysSince(_ lastActiveAt: String?, now: Date) -> Int {
  guard let at = parseIsoDate(lastActiveAt) else { return 0 }
  return max(0, Int(floor(now.timeIntervalSince(at) / daySeconds)))
}

/// Asia/Seoul 달력 — 요약의 `date`는 API 날짜 규칙(KST)으로 적힌다(src/utils/datetime.ts `todayIso`).
let kstCalendar: Calendar = {
  var c = Calendar(identifier: .gregorian)
  c.timeZone = TimeZone(identifier: "Asia/Seoul") ?? TimeZone(secondsFromGMT: 9 * 3600)!
  return c
}()

/// 지금 시각의 Asia/Seoul "YYYY-MM-DD" — JS `todayIso()`와 같은 값.
func kstTodayIso(_ now: Date) -> String {
  let d = kstCalendar.dateComponents([.year, .month, .day], from: now)
  return String(format: "%04d-%02d-%02d", d.year ?? 0, d.month ?? 0, d.day ?? 0)
}

func resolveWidgetMood(
  summary: WidgetSummary, todayIso: String, now: Date, lastActiveAt: String?
) -> WidgetMood {
  let inactiveDays = daysSince(lastActiveAt, now: now)
  if inactiveDays >= widgetCryingDays {
    return WidgetMood(face: .crying, message: "\(inactiveDays)일이나 못 봤어요… 흑흑")
  }
  if inactiveDays >= widgetSadDays {
    return WidgetMood(face: .sad, message: "\(inactiveDays)일째 못 봤어요, 보고 싶어요")
  }
  // `date`가 없는 요약은 구버전 앱이 남긴 것 — 오늘 것으로 간주한다(호환).
  let isToday = summary.date == nil || summary.date == todayIso
  let remaining = summary.total - summary.done
  if isToday && summary.total > 0 && remaining <= 0 {
    return summary.streak >= widgetCrownStreak
      ? WidgetMood(face: .crown, message: "\(summary.streak)일 연속! 최고예요")
      : WidgetMood(face: .happy, message: "오늘도 다 해냈어요!")
  }
  // 저녁 판정은 기기 로컬 시각 — JS `now.getHours()`와 같은 기준.
  let hour = Calendar.current.component(.hour, from: now)
  if isToday && remaining > 0 && hour >= widgetEveningHour {
    return WidgetMood(face: .worried, message: "아직 \(remaining)개 남았어요")
  }
  return WidgetMood(face: .neutral, message: nil)
}

/// 표정이 바뀔 수 있는 다음 시각들 (#1122) — 앱이 안 켜져도 타임라인만으로
/// 저녁·자정·미접속 일수 경계에서 얼굴이 바뀐다. Android는 30분 주기 태스크로
/// 같은 효과를 내지만 WidgetKit은 예산이 있어 경계 시각만 엔트리로 만든다.
func moodChangeDates(now: Date, lastActiveAt: String?, horizon: TimeInterval = 2 * daySeconds) -> [Date] {
  var dates: [Date] = []
  let local = Calendar.current
  // 오늘·내일 로컬 18:00 (걱정 표정 시작).
  for dayOffset in 0...1 {
    if let day = local.date(byAdding: .day, value: dayOffset, to: now),
      let evening = local.date(bySettingHour: widgetEveningHour, minute: 0, second: 0, of: day)
    {
      dates.append(evening)
    }
  }
  // 다음 KST 자정 두 번 — 요약 `date`가 어제가 되어 "다 했다"가 풀리는 순간.
  if let tomorrow = kstCalendar.date(byAdding: .day, value: 1, to: now) {
    let midnight = kstCalendar.startOfDay(for: tomorrow)
    dates.append(midnight)
    dates.append(midnight.addingTimeInterval(daySeconds))
  }
  // 미접속 일수가 하나 늘어나는 순간들 (N일째 문구·슬픔 2일·울음 5일 경계).
  if let at = parseIsoDate(lastActiveAt) {
    let elapsedDays = max(0, Int(floor(now.timeIntervalSince(at) / daySeconds)))
    for k in 1...3 {
      dates.append(at.addingTimeInterval(Double(elapsedDays + k) * daySeconds))
    }
  }
  let limit = now.addingTimeInterval(horizon)
  return Array(Set(dates.filter { $0 > now && $0 <= limit })).sorted()
}

/// 지금 상태 + 경계 시각별 엔트리. 같은 표정·문구가 연달아 나오면 접는다.
func buildMoodEntries(
  now: Date, summary: WidgetSummary, roomImage: UIImage?, theme: ColorScheme?, lastActiveAt: String?
) -> [SummaryEntry] {
  var entries: [SummaryEntry] = []
  for date in [now] + moodChangeDates(now: now, lastActiveAt: lastActiveAt) {
    let mood = resolveWidgetMood(
      summary: summary, todayIso: kstTodayIso(date), now: date, lastActiveAt: lastActiveAt)
    if let last = entries.last, last.mood == mood { continue }
    entries.append(
      SummaryEntry(date: date, summary: summary, roomImage: roomImage, theme: theme, mood: mood))
  }
  return entries
}

struct SummaryEntry: TimelineEntry {
  let date: Date
  let summary: WidgetSummary
  let roomImage: UIImage?
  /// 앱이 기록한 실효 스킴 — nil이면 시스템 설정을 따른다 (#746).
  let theme: ColorScheme?
  /// 캐릭터 표정·문구 (#1122) — 엔트리 시각 기준으로 계산해 둔다.
  let mood: WidgetMood
}

struct SummaryProvider: TimelineProvider {
  func placeholder(in context: Context) -> SummaryEntry {
    SummaryEntry(
      date: Date(),
      summary: WidgetSummary(done: 2, total: 5, streak: 7, remaining: ["아침 스트레칭", "물 마시기", "독서"]),
      roomImage: nil,
      theme: nil,
      mood: WidgetMood(face: .neutral, message: nil)
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (SummaryEntry) -> Void) {
    let now = Date()
    let summary = loadSummary()
    let lastActive = loadLastActive()
    completion(
      SummaryEntry(
        date: now, summary: summary, roomImage: loadRoomImage(), theme: loadTheme(),
        mood: resolveWidgetMood(
          summary: summary, todayIso: kstTodayIso(now), now: now, lastActiveAt: lastActive)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SummaryEntry>) -> Void) {
    let now = Date()
    let entries = buildMoodEntries(
      now: now, summary: loadSummary(), roomImage: loadRoomImage(), theme: loadTheme(),
      lastActiveAt: loadLastActive())
    // 앱이 기록할 때마다 reloadTimelines로 즉시 갱신 — 여기서는 앱 없이도 저녁·
    // 자정·미접속 경계에서 표정이 바뀌도록 경계 시각마다 엔트리를 두고(#1122),
    // 마지막 엔트리 뒤 KST 자정에 다시 계산한다.
    let lastDate = entries.last?.date ?? now
    let refresh = kstCalendar.startOfDay(
      for: kstCalendar.date(byAdding: .day, value: 1, to: lastDate) ?? lastDate)
    completion(Timeline(entries: entries, policy: .after(refresh)))
  }
}

// MARK: - cozy 토큰 (src/constants/theme.ts 수동 사본 — 위젯은 JS 토큰을 못 읽는다)

extension Color {
  static func cozy(_ light: UInt32, _ dark: UInt32, _ scheme: ColorScheme) -> Color {
    let v = scheme == .dark ? dark : light
    return Color(
      red: Double((v >> 16) & 0xFF) / 255,
      green: Double((v >> 8) & 0xFF) / 255,
      blue: Double(v & 0xFF) / 255
    )
  }
}

private struct CozyPalette {
  let scheme: ColorScheme
  var surface: Color { .cozy(0xFFFFFF, 0x2A2E27, scheme) }
  var text: Color { .cozy(0x4A403A, 0xF0EDE6, scheme) }
  var textMuted: Color { .cozy(0x8B7E74, 0xA8A297, scheme) }
  var primary: Color { .cozy(0x7FA87F, 0x8FB88F, scheme) }
  var track: Color { .cozy(0xF5F1E8, 0x3A3E36, scheme) }
  var warning: Color { .cozy(0xE8A24A, 0xE8B266, scheme) }
  /// 표정 문구 색 (#1122) — 기쁨·왕관은 브랜드색, 걱정·슬픔·울음은 경고색(대비 4.5:1 파생값).
  var primaryText: Color { .cozy(0x517751, 0x93BE93, scheme) }
  var warningText: Color { .cozy(0x9D6014, 0xEDB061, scheme) }
  func moodText(_ face: WidgetFace) -> Color { face.isConcerned ? warningText : primaryText }
}

/// 캐릭터 얼굴 (#1122) — 헤더의 🐾 자리. 아이콘 아트라 모서리를 둥글려 칩처럼(안드와 같은 0.3 비율).
struct FaceView: View {
  let face: WidgetFace
  let size: CGFloat

  var body: some View {
    Image(face.imageName)
      .resizable()
      .scaledToFill()
      .frame(width: size, height: size)
      .clipShape(RoundedRectangle(cornerRadius: (size * 0.3).rounded(), style: .continuous))
      .accessibilityHidden(true)
  }
}

// MARK: - 오늘의 할 일 위젯 (medium)

struct TodayWidgetView: View {
  var entry: SummaryEntry
  @Environment(\.colorScheme) private var systemScheme
  /// 앱이 기록한 실효 스킴 우선, 없으면 시스템 (#746).
  private var scheme: ColorScheme { entry.theme ?? systemScheme }

  // 2×2 컴팩트 (#688) — 안드로이드 TodayListWidget과 같은 구성:
  // 얼굴 + 🔥스트릭 + N/M 헤더, 진행 바, 말줄임 제목 최대 3행 + "+N개 더".
  // 표정 문구 (#1122) — 다 한 날은 축하 한 줄이 목록을 대신하고, 걱정·미접속은
  // 목록 위에 한 줄 얹는다. 평소(neutral)엔 없다.
  var body: some View {
    let t = CozyPalette(scheme: scheme)
    let s = entry.summary
    let mood = entry.mood
    let allDone = s.total > 0 && s.remaining.isEmpty
    let extra = s.total - s.done - s.remaining.count
    VStack(alignment: .leading, spacing: 5) {
      HStack(spacing: 4) {
        FaceView(face: mood.face, size: 18)
        Spacer()
        if s.streak > 0 {
          Text("🔥\(s.streak)")
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(t.warning)
        }
        Text("\(s.done)/\(s.total)")
          .font(.system(size: 13, weight: .semibold))
          .foregroundColor(t.primary)
      }
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(t.track)
          Capsule()
            .fill(t.primary)
            .frame(
              width: s.total > 0
                ? geo.size.width * CGFloat(s.done) / CGFloat(s.total)
                : 0
            )
        }
      }
      .frame(height: 6)
      if let message = mood.message, !allDone {
        Text(message)
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(t.moodText(mood.face))
          .lineLimit(1)
          .truncationMode(.tail)
      }
      if s.total == 0 {
        Text("오늘 예정이 없어요")
          .font(.system(size: 12))
          .foregroundColor(t.textMuted)
          .padding(.top, 2)
      } else if allDone {
        // 다 한 날에도 미접속(슬픔·울음)이 우선이면 그 문구가 오므로 색도 mood를 따른다.
        Text(mood.message ?? "모두 완료했어요! 🎉")
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(t.moodText(mood.face))
          .lineLimit(2)
          .padding(.top, 2)
      } else {
        ForEach(s.remaining.prefix(3), id: \.self) { title in
          HStack(spacing: 5) {
            Circle().strokeBorder(t.textMuted, lineWidth: 1.5).frame(width: 9, height: 9)
            Text(title)
              .font(.system(size: 12))
              .foregroundColor(t.text)
              .lineLimit(1)
              .truncationMode(.tail)
          }
        }
        if extra > 0 {
          Text("+\(extra)개 더")
            .font(.system(size: 11))
            .foregroundColor(t.textMuted)
        }
      }
      Spacer(minLength: 0)
    }
    .containerBackground(t.surface, for: .widget)
  }
}

/// 위젯 탭으로 앱이 열렸음을 앱에 알리는 딥링크 (#805).
/// 앱은 이 URL을 보고 재방문 계기를 `widget`으로 기록한다 — 없으면 아이콘으로
/// 직접 연 것과 구분되지 않아 위젯이 재방문을 만드는지 알 수 없다.
/// 값은 JS의 `WIDGET_OPEN_URL`(src/lib/app-open.ts)과 같아야 한다.
private let widgetOpenURL = URL(string: "rougether://widget")!

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "RougetherToday", provider: SummaryProvider()) { entry in
      TodayWidgetView(entry: entry)
        .widgetURL(widgetOpenURL)
    }
    .configurationDisplayName("오늘의 할 일")
    .description("오늘 진행도와 남은 루틴을 보여줘요.")
    // 2×2 통일 (#688) — 안드 위젯과 같은 소형 규격.
    .supportedFamilies([.systemSmall])
  }
}

// MARK: - 내 방 위젯 (small·large)

struct RoomWidgetView: View {
  var entry: SummaryEntry
  @Environment(\.colorScheme) private var systemScheme
  /// 앱이 기록한 실효 스킴 우선, 없으면 시스템 (#746).
  private var scheme: ColorScheme { entry.theme ?? systemScheme }

  var body: some View {
    let t = CozyPalette(scheme: scheme)
    let s = entry.summary
    ZStack(alignment: .bottom) {
      if let image = entry.roomImage {
        // 위젯 껍데기와 같은 곡률로 깎는다 (#746) — ContainerRelativeShape은
        // 시스템이 정한 위젯 모서리 반경을 그대로 따라가므로, 기기·OS마다
        // 다른 반경에서도 이미지와 껍데기의 둥근 느낌이 어긋나지 않는다.
        // (고정 cornerRadius로는 기기마다 미묘하게 달라진다.)
        Image(uiImage: image)
          .resizable()
          .scaledToFill()
          .clipped()
          .clipShape(ContainerRelativeShape())
      } else {
        VStack(spacing: 4) {
          Text("🏡").font(.system(size: 34))
          Text("루틴을 완료하고\n방을 키워보세요")
            .font(.system(size: 11))
            .multilineTextAlignment(.center)
            .foregroundColor(t.textMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
      HStack(spacing: 6) {
        FaceView(face: entry.mood.face, size: 16)
        Text("\(s.done)/\(s.total)")
          .font(.system(size: 12, weight: .bold))
          .foregroundColor(.white)
        if s.streak > 0 {
          Text("🔥\(s.streak)")
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(.white)
        }
        Spacer()
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(Color.black.opacity(0.35))
    }
    .containerBackground(t.surface, for: .widget)
  }
}

struct RoomWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "RougetherRoom", provider: SummaryProvider()) { entry in
      RoomWidgetView(entry: entry)
        .widgetURL(widgetOpenURL)
    }
    .configurationDisplayName("내 방")
    .description("루틴으로 키운 내 방을 홈 화면에서 봐요.")
    .supportedFamilies([.systemSmall, .systemLarge])
  }
}

// MARK: - 번들

@main
struct RougetherWidgets: WidgetBundle {
  var body: some Widget {
    TodayWidget()
    RoomWidget()
  }
}
