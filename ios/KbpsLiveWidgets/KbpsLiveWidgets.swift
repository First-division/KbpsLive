import ActivityKit
import AppIntents
import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit
import WidgetKit

private let appGroupIdentifier = "group.com.firstdivisioncaptain.KbpsLive"

private enum ArtworkPalette {
  private static let ciContext = CIContext(options: [
    .workingColorSpace: NSNull(),
    .outputColorSpace: NSNull(),
  ])

  static func tintColor(for urlString: String) -> Color {
    guard
      let image = artworkImage(for: urlString),
      let average = averageColor(from: image)
    else {
      return .green
    }

    let tuned = tunedColor(from: average)
    return Color(uiColor: tuned)
  }

  private static func artworkImage(for urlString: String) -> UIImage? {
    for path in candidatePaths(for: urlString) {
      if let image = UIImage(contentsOfFile: path) {
        return image
      }
    }
    return nil
  }

  private static func candidatePaths(for urlString: String) -> [String] {
    let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
    var candidates: [String] = []

    if let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: appGroupIdentifier
    ) {
      candidates.append(contentsOf: [
        container.appendingPathComponent("live-activity-artwork-compact.jpg").path,
        container.appendingPathComponent("live-activity-artwork-expanded.jpg").path,
      ])
    }

    if trimmed.hasPrefix("/"), !trimmed.isEmpty {
      candidates.append(trimmed)
    } else if trimmed.hasPrefix("file://"), let url = URL(string: trimmed) {
      candidates.append(url.path)
    }

    return candidates
  }

  private static func averageColor(from image: UIImage) -> UIColor? {
    guard let inputImage = CIImage(image: image) else {
      return nil
    }

    let filter = CIFilter.areaAverage()
    filter.inputImage = inputImage
    filter.extent = inputImage.extent

    guard let outputImage = filter.outputImage else {
      return nil
    }

    var bitmap = [UInt8](repeating: 0, count: 4)
    ciContext.render(
      outputImage,
      toBitmap: &bitmap,
      rowBytes: 4,
      bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
      format: .RGBA8,
      colorSpace: nil
    )

    return UIColor(
      red: CGFloat(bitmap[0]) / 255,
      green: CGFloat(bitmap[1]) / 255,
      blue: CGFloat(bitmap[2]) / 255,
      alpha: 1
    )
  }

  private static func tunedColor(from color: UIColor) -> UIColor {
    var hue: CGFloat = 0
    var saturation: CGFloat = 0
    var brightness: CGFloat = 0
    var alpha: CGFloat = 0

    guard color.getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha) else {
      return color
    }

    return UIColor(
      hue: hue,
      saturation: max(0.48, saturation),
      brightness: max(0.62, brightness),
      alpha: 1
    )
  }
}

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
      forSecurityApplicationGroupIdentifier: appGroupIdentifier
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
      forSecurityApplicationGroupIdentifier: appGroupIdentifier
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

private struct LiveWaveformView: View {
  let level: Double
  let color: Color
  let compact: Bool

  private var barCount: Int { compact ? 4 : 5 }
  private var barWidth: CGFloat { compact ? 2.0 : 3.0 }
  private var minHeight: CGFloat { compact ? 4 : 7 }
  private var maxHeight: CGFloat { compact ? 14 : 26 }

  var body: some View {
    TimelineView(.animation(minimumInterval: compact ? 0.22 : 0.16, paused: false)) { timeline in
      let phase = timeline.date.timeIntervalSinceReferenceDate
      HStack(alignment: .bottom, spacing: compact ? 1.6 : 2.4) {
        ForEach(0 ..< barCount, id: \.self) { index in
          RoundedRectangle(cornerRadius: barWidth, style: .continuous)
            .fill(color)
            .frame(width: barWidth, height: barHeight(index: index, phase: phase))
        }
      }
      .frame(height: maxHeight, alignment: .bottom)
      .accessibilityLabel("Live waveform")
    }
  }

  private func barHeight(index: Int, phase: TimeInterval) -> CGFloat {
    let normalizedLevel = max(0.06, min(1, level))
    let fastWave = (sin((phase * 5.3) + Double(index) * 1.2) + 1) / 2
    let slowWave = (sin((phase * 2.4) + Double(index) * 0.45 + normalizedLevel * 2.3) + 1) / 2
    let motion = (fastWave * 0.7) + (slowWave * 0.3)
    let amplitude = minHeight + CGFloat(normalizedLevel) * (maxHeight - minHeight)
    let animatedHeight = minHeight + motion * (amplitude - minHeight)
    return max(minHeight, min(maxHeight, animatedHeight))
  }
}

private struct PauseRadioButton: View {
  let size: CGFloat

  init(size: CGFloat = 40) {
    self.size = size
  }

  var body: some View {
    if #available(iOSApplicationExtension 17.0, *) {
      Button(intent: PauseRadioIntent()) {
        Image(systemName: "pause.fill")
          .font(.system(size: size * 0.42, weight: .bold))
          .foregroundStyle(.white)
          .frame(width: size, height: size)
          .background(Color.white.opacity(0.18), in: Circle())
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Pause radio")
    }
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
      let waveformTint = ArtworkPalette.tintColor(for: context.state.artworkURL)

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

        if context.state.isLive {
          VStack(spacing: 8) {
            LiveWaveformView(level: context.state.waveformLevel, color: waveformTint, compact: false)
            PauseRadioButton()
          }
        }
      }
      .padding(12)
      .activityBackgroundTint(Color.black)
      .activitySystemActionForegroundColor(Color.white)
    } dynamicIsland: { context in
      let waveformTint = ArtworkPalette.tintColor(for: context.state.artworkURL)

      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          ArtworkView(urlString: context.state.artworkURL, variant: .expanded)
            .frame(width: 60, height: 60)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .frame(maxHeight: .infinity, alignment: .center)
        }
        DynamicIslandExpandedRegion(.trailing) {
          HStack(spacing: 0) {
            Spacer(minLength: 0)
            LiveWaveformView(level: context.state.waveformLevel, color: waveformTint, compact: false)
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
          .padding(.trailing, 2)
        }
        DynamicIslandExpandedRegion(.bottom, priority: 1) {
          VStack(alignment: .center, spacing: 2) {
            Text(context.attributes.stationName.uppercased())
              .font(.caption2)
              .fontWeight(.semibold)
              .lineLimit(1)
              .minimumScaleFactor(0.8)
            Text(context.state.title)
              .font(.subheadline)
              .lineLimit(1)
              .minimumScaleFactor(0.82)
            Text(context.state.subtitle)
              .font(.caption)
              .foregroundStyle(.secondary)
              .lineLimit(1)
              .minimumScaleFactor(0.82)
            if context.state.isLive {
              PauseRadioButton(size: 36)
                .padding(.top, 3)
                .padding(.bottom, 3)
            }
          }
          .frame(maxWidth: .infinity, alignment: .center)
          .multilineTextAlignment(.center)
          .padding(.top, 2)
        }
      } compactLeading: {
        CompactArtworkView(urlString: context.state.artworkURL, useCircle: false)
      } compactTrailing: {
        LiveWaveformView(level: context.state.waveformLevel, color: waveformTint, compact: true)
      } minimal: {
        CompactArtworkView(urlString: context.state.artworkURL, useCircle: true)
      }
      .keylineTint(waveformTint)
    }
  }
}
