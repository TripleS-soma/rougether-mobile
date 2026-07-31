import SwiftUI
import WidgetKit

// 앱(JS)이 기록하는 App Group 계약 — src/widgets/widget-data.ts와 동일 키.
private let appGroup = "group.com.triples.rougether"
private let summaryKey = "summary"
private let roomImageKey = "roomImage"

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

/// 방 캡처 — 앱이 저장한 data URI PNG(base64)를 디코드한다.
func loadRoomImage() -> UIImage? {
  guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: roomImageKey) else {
    return nil
  }
  let base64 = raw.contains(",") ? String(raw.split(separator: ",", maxSplits: 1)[1]) : raw
  guard let data = Data(base64Encoded: base64) else { return nil }
  return UIImage(data: data)
}

struct SummaryEntry: TimelineEntry {
  let date: Date
  let summary: WidgetSummary
  let roomImage: UIImage?
}

struct SummaryProvider: TimelineProvider {
  func placeholder(in context: Context) -> SummaryEntry {
    SummaryEntry(
      date: Date(),
      summary: WidgetSummary(done: 2, total: 5, streak: 7, remaining: ["아침 스트레칭", "물 마시기", "독서"]),
      roomImage: nil
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (SummaryEntry) -> Void) {
    completion(SummaryEntry(date: Date(), summary: loadSummary(), roomImage: loadRoomImage()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SummaryEntry>) -> Void) {
    let entry = SummaryEntry(date: Date(), summary: loadSummary(), roomImage: loadRoomImage())
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
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    let t = CozyPalette(scheme: scheme)
    let s = entry.summary
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text("오늘의 할 일")
          .font(.system(size: 14, weight: .bold))
          .foregroundColor(t.text)
        Spacer()
        Text("\(s.done) / \(s.total)")
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
        Text("오늘 할 일을 모두 마쳤어요!")
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(t.primary)
          .padding(.top, 2)
      } else {
        ForEach(s.remaining.prefix(3), id: \.self) { title in
          HStack(spacing: 6) {
            Circle().strokeBorder(t.textMuted, lineWidth: 1.5).frame(width: 10, height: 10)
            Text(title)
              .font(.system(size: 12))
              .foregroundColor(t.text)
              .lineLimit(1)
          }
        }
      }
      Spacer(minLength: 0)
      if s.streak > 0 {
        Text("🔥 \(s.streak)일 연속")
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(t.warning)
      }
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
    .supportedFamilies([.systemMedium])
  }
}

// MARK: - 내 방 위젯 (small·large)

struct RoomWidgetView: View {
  var entry: SummaryEntry
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    let t = CozyPalette(scheme: scheme)
    let s = entry.summary
    ZStack(alignment: .bottom) {
      if let image = entry.roomImage {
        Image(uiImage: image)
          .resizable()
          .scaledToFill()
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
