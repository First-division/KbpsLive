import ActivityKit
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

private struct WaveformView: View {
  let isLive: Bool
  let level: Double
  let accentColor: Color

  private let barHeights: [CGFloat] = [10, 14, 20, 16, 22, 15]
  private let phaseOffsets: [Double] = [0.2, 1.0, 2.3, 3.7, 4.5, 5.2]

  var body: some View {
    TimelineView(.periodic(from: .now, by: 0.09)) { timeline in
      HStack(alignment: .bottom, spacing: 3) {
        ForEach(Array(barHeights.enumerated()), id: \.offset) { index, height in
          Capsule()
            .fill(
              isLive
                ? LinearGradient(
                  colors: [accentColor.opacity(0.98), accentColor.opacity(0.6)],
                  startPoint: .top,
                  endPoint: .bottom
                )
                : LinearGradient(
                  colors: [Color.gray.opacity(0.55), Color.gray.opacity(0.35)],
                  startPoint: .top,
                  endPoint: .bottom
                )
            )
            .frame(width: 3.4, height: barHeight(base: height, index: index, date: timeline.date))
        }
      }
      .frame(height: 30, alignment: .bottom)
      .padding(.horizontal, 8)
      .padding(.vertical, 6)
      .background(Color.black.opacity(0.24), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 11, style: .continuous)
          .stroke(Color.white.opacity(0.1), lineWidth: 0.7)
      }
    }
  }

  private func barHeight(base: CGFloat, index: Int, date: Date) -> CGFloat {
    let clamped = CGFloat(max(0, min(1, level)))
    let reactiveLevel = isLive ? pow(clamped, 0.72) : clamped
    let baseline = isLive ? max(0.18, reactiveLevel) : 0.08
    let t = date.timeIntervalSinceReferenceDate
    let phase = phaseOffsets[index]
    let fast = CGFloat((sin((t * 11.4) + phase) + 1) / 2)
    let slow = CGFloat((sin((t * 3.4) + phase * 0.6) + 1) / 2)
    let motion = (0.56 + fast * 0.78) * (0.8 + slow * 0.36)
    let amplitude = (0.34 + baseline * 1.45) * motion
    return min(30, max(isLive ? 5 : 4, base * amplitude))
  }
}

private struct ExpandedWaveformView: View {
  let isLive: Bool
  let level: Double
  let accentColor: Color

  private let barHeights: [CGFloat] = [12, 18, 24, 20, 28, 19, 26, 22, 30, 17]
  private let phaseOffsets: [Double] = [0.15, 0.8, 1.7, 2.5, 3.1, 3.9, 4.7, 5.3, 6.0, 6.6]

  var body: some View {
    TimelineView(.periodic(from: .now, by: 0.09)) { timeline in
      HStack(alignment: .bottom, spacing: 4) {
        ForEach(Array(barHeights.enumerated()), id: \.offset) { index, height in
          Capsule()
            .fill(
              isLive
                ? LinearGradient(
                  colors: [accentColor.opacity(0.98), accentColor.opacity(0.62)],
                  startPoint: .top,
                  endPoint: .bottom
                )
                : LinearGradient(
                  colors: [Color.gray.opacity(0.58), Color.gray.opacity(0.38)],
                  startPoint: .top,
                  endPoint: .bottom
                )
            )
            .frame(width: 4.2, height: barHeight(base: height, index: index, date: timeline.date))
        }
      }
      .frame(height: 38, alignment: .bottom)
      .padding(.horizontal, 12)
      .padding(.vertical, 7)
      .background(Color.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .stroke(Color.white.opacity(0.12), lineWidth: 0.75)
      }
    }
  }

  private func barHeight(base: CGFloat, index: Int, date: Date) -> CGFloat {
    let clamped = CGFloat(max(0, min(1, level)))
    let reactiveLevel = isLive ? pow(clamped, 0.72) : clamped
    let baseline = isLive ? max(0.2, reactiveLevel) : 0.1
    let t = date.timeIntervalSinceReferenceDate
    let phase = phaseOffsets[index]
    let fast = CGFloat((sin((t * 11.8) + phase) + 1) / 2)
    let slow = CGFloat((sin((t * 3.6) + phase * 0.62) + 1) / 2)
    let motion = (0.58 + fast * 0.8) * (0.82 + slow * 0.34)
    let amplitude = (0.36 + baseline * 1.5) * motion
    return min(38, max(isLive ? 6 : 4, base * amplitude))
  }
}

private struct CompactWaveformView: View {
  let isLive: Bool
  let level: Double
  let accentColor: Color

  private let barHeights: [CGFloat] = [7, 11, 15, 10]
  private let phaseOffsets: [Double] = [0.3, 1.2, 2.8, 4.1]

  var body: some View {
    TimelineView(.periodic(from: .now, by: 0.09)) { timeline in
      HStack(alignment: .bottom, spacing: 1.6) {
        ForEach(Array(barHeights.enumerated()), id: \.offset) { index, height in
          Capsule()
            .fill(isLive ? accentColor.opacity(0.96) : Color.gray.opacity(0.5))
            .frame(width: 2, height: barHeight(base: height, index: index, date: timeline.date))
        }
      }
      .frame(height: 18, alignment: .bottom)
    }
  }

  private func barHeight(base: CGFloat, index: Int, date: Date) -> CGFloat {
    let clamped = CGFloat(max(0, min(1, level)))
    let reactiveLevel = isLive ? pow(clamped, 0.72) : clamped
    let baseline = isLive ? max(0.16, reactiveLevel) : 0.06
    let t = date.timeIntervalSinceReferenceDate
    let phase = phaseOffsets[index]
    let fast = CGFloat((sin((t * 12.6) + phase) + 1) / 2)
    let slow = CGFloat((sin((t * 3.4) + phase * 0.7) + 1) / 2)
    let amplitude = (0.34 + baseline * 1.35) * (0.6 + fast * 0.72) * (0.82 + slow * 0.3)
    return min(18, max(isLive ? 4 : 3, base * amplitude))
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

        WaveformView(isLive: context.state.isLive, level: context.state.waveformLevel, accentColor: waveformTint)
      }
      .padding(12)
      .activityBackgroundTint(Color.black)
      .activitySystemActionForegroundColor(Color.white)
    } dynamicIsland: { context in
      let waveformTint = ArtworkPalette.tintColor(for: context.state.artworkURL)

      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          ArtworkView(urlString: context.state.artworkURL, variant: .expanded)
            .frame(width: 78, height: 78)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .dynamicIsland(verticalPlacement: .belowIfTooWide)
            .padding(.top, 8)
        }
        DynamicIslandExpandedRegion(.trailing) {
          ExpandedWaveformView(isLive: context.state.isLive, level: context.state.waveformLevel, accentColor: waveformTint)
            .frame(width: 182, height: 78, alignment: .trailing)
            .padding(.top, 8)
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
        CompactWaveformView(isLive: context.state.isLive, level: context.state.waveformLevel, accentColor: waveformTint)
      } minimal: {
        CompactArtworkView(urlString: context.state.artworkURL, useCircle: true)
      }
      .keylineTint(waveformTint)
    }
  }
}
