import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

private struct ArtworkView: View {
  enum Variant {
    case expanded
    case compact
    case minimal
  }

  let urlString: String
  let variant: Variant

  var body: some View {
    if let image = localImage ?? fallbackImage {
      Image(uiImage: image)
        .resizable()
        .scaledToFill()
    } else {
      fallback
    }
  }

  private var localImage: UIImage? {
    let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
    var candidates: [String] = []
    if let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: "group.com.firstdivisioncaptain.KbpsLive"
    ) {
      switch variant {
      case .expanded:
        candidates.append(contentsOf: [
          container.appendingPathComponent("live-activity-artwork-expanded.jpg").path,
          container.appendingPathComponent("live-activity-artwork-compact.jpg").path,
        ])
      case .compact, .minimal:
        candidates.append(contentsOf: [
          container.appendingPathComponent("live-activity-artwork-compact.jpg").path,
          container.appendingPathComponent("live-activity-artwork-expanded.jpg").path,
        ])
      }
    }

    if trimmed.hasPrefix("/"), !trimmed.isEmpty {
      candidates.append(trimmed)
    } else if trimmed.hasPrefix("file://"), let url = URL(string: trimmed) {
      candidates.append(url.path)
    }

    for path in candidates {
      if let img = UIImage(contentsOfFile: path) {
        return img
      }
    }

    return nil
  }

  private var fallbackImage: UIImage? {
    guard let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: "group.com.firstdivisioncaptain.KbpsLive"
    ) else {
      return nil
    }

    let path = container.appendingPathComponent("live-activity-fallback.png").path
    return UIImage(contentsOfFile: path)
  }

  private var fallback: some View {
    ZStack {
      LinearGradient(
        colors: [Color.black.opacity(0.95), Color.green.opacity(0.85)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      Image(systemName: "music.note")
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(.white)
        .padding(6)
        .background(Color.black.opacity(0.35), in: Circle())
    }
  }
}

private struct CompactArtworkView: View {
  let urlString: String
  let useCircle: Bool

  @ViewBuilder
  var body: some View {
    if useCircle {
      ZStack {
        Color.black.opacity(0.35)
        ArtworkView(urlString: urlString, variant: .minimal)
      }
      .frame(width: 24, height: 24)
      .clipShape(Circle())
      .clipped()
      .overlay {
        Circle().stroke(Color.white.opacity(0.18), lineWidth: 0.7)
      }
      .id("compact-art-circle-\(urlString)")
    } else {
      ZStack {
        Color.black.opacity(0.35)
        ArtworkView(urlString: urlString, variant: .compact)
      }
      .frame(width: 24, height: 24)
      .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
      .clipped()
      .overlay {
        RoundedRectangle(cornerRadius: 7, style: .continuous)
          .stroke(Color.white.opacity(0.18), lineWidth: 0.7)
      }
      .id("compact-art-rounded-\(urlString)")
    }
  }
}

private struct WaveformView: View {
  let isLive: Bool
  let level: Double

  private let barHeights: [CGFloat] = [10, 18, 14, 24, 12, 20]

  var body: some View {
    TimelineView(.periodic(from: .now, by: 0.12)) { timeline in
      HStack(alignment: .center, spacing: 4) {
        ForEach(Array(barHeights.enumerated()), id: \.offset) { index, height in
          Capsule()
            .fill(isLive ? Color.green : Color.gray.opacity(0.55))
            .frame(width: 4, height: scaledHeight(base: height, index: index, date: timeline.date))
        }
      }
      .frame(height: 30, alignment: .bottom)
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
  }

  private func scaledHeight(base: CGFloat, index: Int, date: Date) -> CGFloat {
    let clamped = CGFloat(max(0, min(1, level)))
    let responsiveLevel = max(clamped, isLive ? 0.32 : 0.14)
    let t = date.timeIntervalSinceReferenceDate
    let phase = sin((t * 9.8) + Double(index) * 0.85)
    let pulse = CGFloat((phase + 1) / 2)
    let stagger: CGFloat = index.isMultiple(of: 2) ? 0.92 : 1.06
    let amplitude = (0.52 + responsiveLevel * 1.9) * (0.58 + pulse * 1.05)
    return min(30, max(5, base * amplitude * stagger))
  }
}

private struct CompactWaveformView: View {
  let isLive: Bool
  let level: Double

  private let barHeights: [CGFloat] = [8, 14, 10, 16]

  var body: some View {
    TimelineView(.periodic(from: .now, by: 0.1)) { timeline in
      HStack(alignment: .center, spacing: 2) {
        ForEach(Array(barHeights.enumerated()), id: \.offset) { index, height in
          Capsule()
            .fill(isLive ? Color.green : Color.gray.opacity(0.55))
            .frame(width: 2, height: scaledHeight(base: height, index: index, date: timeline.date))
        }
      }
      .frame(height: 18, alignment: .bottom)
    }
  }

  private func scaledHeight(base: CGFloat, index: Int, date: Date) -> CGFloat {
    let clamped = CGFloat(max(0, min(1, level)))
    let responsiveLevel = max(clamped, isLive ? 0.28 : 0.12)
    let t = date.timeIntervalSinceReferenceDate
    let phase = sin((t * 10.6) + Double(index) * 0.95)
    let pulse = CGFloat((phase + 1) / 2)
    let stagger: CGFloat = index.isMultiple(of: 2) ? 0.92 : 1.06
    let amplitude = (0.56 + responsiveLevel * 1.55) * (0.56 + pulse * 0.98)
    return min(18, max(4, base * amplitude * stagger))
  }
}

@main
struct KbpsLiveWidgets: WidgetBundle {
  var body: some Widget {
    if #available(iOSApplicationExtension 16.2, *) {
      RadioLiveActivity()
    }
  }
}

@available(iOSApplicationExtension 16.2, *)
struct RadioLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RadioActivityAttributes.self) { context in
      HStack(spacing: 12) {
        ArtworkView(urlString: context.state.artworkURL, variant: .expanded)
          .frame(width: 54, height: 54)
          .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

        VStack(alignment: .leading, spacing: 6) {
          Text(context.attributes.stationName)
            .font(.headline)
            .lineLimit(1)
          Text(context.state.title)
            .font(.subheadline)
            .lineLimit(1)
          Text(context.state.subtitle)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }

        Spacer(minLength: 8)

        WaveformView(isLive: context.state.isLive, level: context.state.waveformLevel)
      }
      .padding(12)
      .activityBackgroundTint(Color.black)
      .activitySystemActionForegroundColor(Color.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          ArtworkView(urlString: context.state.artworkURL, variant: .expanded)
            .frame(width: 42, height: 42)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        DynamicIslandExpandedRegion(.trailing) {
          WaveformView(isLive: context.state.isLive, level: context.state.waveformLevel)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 2) {
            Text(context.state.title)
              .font(.subheadline)
              .lineLimit(1)
            Text(context.state.subtitle)
              .font(.caption)
              .foregroundStyle(.secondary)
              .lineLimit(1)
          }
          .padding(.horizontal, 4)
        }
      } compactLeading: {
        CompactArtworkView(urlString: context.state.artworkURL, useCircle: false)
      } compactTrailing: {
        CompactWaveformView(isLive: context.state.isLive, level: context.state.waveformLevel)
      } minimal: {
        CompactArtworkView(urlString: context.state.artworkURL, useCircle: true)
      }
      .keylineTint(.green)
    }
  }
}
