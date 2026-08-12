import ImageIO
import SwiftUI
import UIKit
import WidgetKit

// 앱(JS)이 기록하는 App Group 계약 — src/widgets/widget-data.ts와 동일 키.
private let appGroup = "group.com.triples.rougether"
private let summaryKey = "summary"
private let roomImageKey = "roomImage"
private let themeKey = "theme"

// MARK: - 데이터

/// 오늘 요약 — 안드로이드 위젯과 동일 스키마 (done/total/streak/remaining 앞 3개).
struct WidgetSummary: Decodable {
  var done: Int
  var total: Int
  var streak: Int
  var remaining: [String]

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

struct SummaryEntry: TimelineEntry {
  let date: Date
  let summary: WidgetSummary
  let roomImage: UIImage?
  /// 앱이 기록한 실효 스킴 — nil이면 시스템 설정을 따른다 (#746).
  let theme: ColorScheme?
}

struct SummaryProvider: TimelineProvider {
  func placeholder(in context: Context) -> SummaryEntry {
    SummaryEntry(
      date: Date(),
      summary: WidgetSummary(done: 2, total: 5, streak: 7, remaining: ["아침 스트레칭", "물 마시기", "독서"]),
      roomImage: nil,
      theme: nil
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (SummaryEntry) -> Void) {
    completion(
      SummaryEntry(
        date: Date(), summary: loadSummary(), roomImage: loadRoomImage(), theme: loadTheme()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SummaryEntry>) -> Void) {
    let entry = SummaryEntry(
      date: Date(), summary: loadSummary(), roomImage: loadRoomImage(), theme: loadTheme())
    // 앱이 기록할 때마다 reloadTimelines로 즉시 갱신 — 여기서는 자정에 하루가
    // 넘어가며 어제 요약이 남는 것만 방어한다.
    let midnight = Calendar.current.startOfDay(
      for: Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    )
    completion(Timeline(entries: [entry], policy: .after(midnight)))
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
}

// MARK: - 오늘의 할 일 위젯 (medium)

struct TodayWidgetView: View {
  var entry: SummaryEntry
  @Environment(\.colorScheme) private var systemScheme
  /// 앱이 기록한 실효 스킴 우선, 없으면 시스템 (#746).
  private var scheme: ColorScheme { entry.theme ?? systemScheme }

  // 2×2 컴팩트 (#688) — 안드로이드 TodayListWidget과 같은 구성:
  // 🐾 + 🔥스트릭 + N/M 헤더, 진행 바, 말줄임 제목 최대 3행 + "+N개 더".
  var body: some View {
    let t = CozyPalette(scheme: scheme)
    let s = entry.summary
    let extra = s.total - s.done - s.remaining.count
    VStack(alignment: .leading, spacing: 5) {
      HStack(spacing: 4) {
        Text("🐾").font(.system(size: 12))
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
      if s.total == 0 {
        Text("오늘 예정이 없어요")
          .font(.system(size: 12))
          .foregroundColor(t.textMuted)
          .padding(.top, 2)
      } else if s.remaining.isEmpty {
        Text("모두 완료했어요! 🎉")
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(t.primary)
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

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "RougetherToday", provider: SummaryProvider()) { entry in
      TodayWidgetView(entry: entry)
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
