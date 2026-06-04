import ActivityKit
import ExpoModulesCore
import UIKit



public class ReactNativeWidgetExtensionModule: Module {
  private let appGroupIdentifier = "group.com.firstdivisioncaptain.KbpsLive"
  private let artworkFilename = "live-activity-artwork-expanded.jpg"
  private let compactArtworkFilename = "live-activity-artwork-compact.jpg"
  private let fallbackArtworkFilename = "live-activity-fallback.png"
  private let artworkSourceDefaultsKey = "kbpslive.artworkSource"
  private let artworkFetchedAtDefaultsKey = "kbpslive.artworkFetchedAt"
  private let currentActivityIDDefaultsKey = "kbpslive.currentActivityID"
  private let defaultArtworkURL = "https://d31wsou9chh9ss.cloudfront.net/0/mobile/images/1456856851/9394/900/900/PlayerDefaultAlbumArt.jpg"
  private let currentArtworkEndpoint = "https://api-nowplaying.amperwave.net/api/v1/prtplus/nowplaying/1/2011/nowplaying.json"
  private let artworkRefreshInterval: TimeInterval = 15
  private var appearanceTimer: Timer?
  private var lastReportedScheme: String = ""

  private func startAppearanceTimer() {
    guard appearanceTimer == nil else { return }
    lastReportedScheme = ""
    appearanceTimer = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: true) { [weak self] _ in
      guard let self else { return }
      let scheme: String
      if #available(iOS 13.0, *) {
        scheme = self.currentSystemColorScheme()
      } else {
        scheme = "light"
      }
      guard scheme != self.lastReportedScheme else { return }
      self.lastReportedScheme = scheme
      self.sendEvent("onAppearanceChange", ["colorScheme": scheme])
    }
  }

  private func stopAppearanceTimer() {
    appearanceTimer?.invalidate()
    appearanceTimer = nil
  }

  @available(iOS 13.0, *)
  private func scheme(from style: UIUserInterfaceStyle) -> String? {
    switch style {
    case .dark:
      return "dark"
    case .light:
      return "light"
    default:
      return nil
    }
  }

  @available(iOS 13.0, *)
  private func currentSystemColorScheme() -> String {
    let activeScenes = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .filter { $0.activationState == .foregroundActive }

    let fallbackScenes = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }

    let scene = activeScenes.first ?? fallbackScenes.first
    let keyWindow = scene?.windows.first(where: { $0.isKeyWindow })

    if let keyStyle = keyWindow?.traitCollection.userInterfaceStyle,
       let keyScheme = scheme(from: keyStyle) {
      return keyScheme
    }

    if let rootStyle = keyWindow?.rootViewController?.traitCollection.userInterfaceStyle,
       let rootScheme = scheme(from: rootStyle) {
      return rootScheme
    }

    if let firstWindowStyle = scene?.windows.first?.traitCollection.userInterfaceStyle,
       let firstWindowScheme = scheme(from: firstWindowStyle) {
      return firstWindowScheme
    }

    if let screenScheme = scheme(from: UIScreen.main.traitCollection.userInterfaceStyle) {
      return screenScheme
    }

    if let currentScheme = scheme(from: UITraitCollection.current.userInterfaceStyle) {
      return currentScheme
    }

    return "light"
  }

  private func setCurrentActivityID(_ id: String?) {
    let defaults = UserDefaults(suiteName: appGroupIdentifier)
    if let id {
      defaults?.set(id, forKey: currentActivityIDDefaultsKey)
    } else {
      defaults?.removeObject(forKey: currentActivityIDDefaultsKey)
    }
  }

  private func normalizedURLCandidates(from raw: String) -> [URL] {
    var urls: [URL] = []

    if let direct = URL(string: raw), let scheme = direct.scheme?.lowercased(), scheme == "https" || scheme == "http" {
      urls.append(direct)
    }

    if let encoded = raw.addingPercentEncoding(withAllowedCharacters: .urlFragmentAllowed),
       let encodedURL = URL(string: encoded),
       let scheme = encodedURL.scheme?.lowercased(),
       (scheme == "https" || scheme == "http") {
      urls.append(encodedURL)
    }

    return Array(Set(urls.map(\.absoluteString))).compactMap(URL.init(string:))
  }

  private func dedupedURLs(_ urls: [URL]) -> [URL] {
    var seen = Set<String>()
    var result: [URL] = []

    for url in urls {
      if seen.insert(url.absoluteString).inserted {
        result.append(url)
      }
    }

    return result
  }

  private func currentWebsiteArtworkCandidates() async -> [URL] {
    guard let endpointURL = URL(string: currentArtworkEndpoint) else {
      return []
    }

    do {
      let (data, response) = try await URLSession.shared.data(from: endpointURL)
      if let httpResponse = response as? HTTPURLResponse,
         !(200 ..< 300).contains(httpResponse.statusCode) {
        return []
      }

      guard let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let performances = payload["performances"] as? [[String: Any]],
            let first = performances.first else {
        return []
      }

      let rawValues = [first["largeimage"], first["mediumimage"], first["smallimage"]]
        .compactMap { $0 as? String }

      return dedupedURLs(rawValues.flatMap(normalizedURLCandidates(from:)))
    } catch {
      return []
    }
  }

  private func squareScaledImage(_ image: UIImage, side: CGFloat) -> UIImage {
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
    return renderer.image { _ in
      let sourceSize = image.size
      let scale = max(side / max(sourceSize.width, 1), side / max(sourceSize.height, 1))
      let scaledSize = CGSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
      let origin = CGPoint(x: (side - scaledSize.width) / 2, y: (side - scaledSize.height) / 2)
      image.draw(in: CGRect(origin: origin, size: scaledSize))
    }
  }

  private func bundledFallbackImage() -> UIImage? {
    let directCandidates = [
      Bundle.main.path(forResource: "icon", ofType: "png"),
      Bundle.main.path(forResource: "splash-icon", ofType: "png"),
      Bundle.main.path(forResource: "adaptive-icon", ofType: "png")
    ]

    for path in directCandidates.compactMap({ $0 }) {
      if let image = UIImage(contentsOfFile: path) {
        return image
      }
    }

    if let resourcePath = Bundle.main.resourcePath,
       let enumerator = FileManager.default.enumerator(atPath: resourcePath) {
      for case let item as String in enumerator {
        let lowercased = item.lowercased()
        if lowercased.hasSuffix("icon.png") || lowercased.hasSuffix("adaptive-icon.png") || lowercased.hasSuffix("splash-icon.png") {
          let fullPath = (resourcePath as NSString).appendingPathComponent(item)
          if let image = UIImage(contentsOfFile: fullPath) {
            return image
          }
        }
      }
    }

    return nil
  }

  private func ensureFallbackArtwork(at containerURL: URL) -> String? {
    let fallbackURL = containerURL.appendingPathComponent(fallbackArtworkFilename)
    if FileManager.default.fileExists(atPath: fallbackURL.path) {
      return fallbackURL.path
    }

    guard let image = bundledFallbackImage(), let data = image.pngData() else {
      return nil
    }

    do {
      try data.write(to: fallbackURL, options: .atomic)
      return fallbackURL.path
    } catch {
      return nil
    }
  }

  private func writeArtworkVariants(_ image: UIImage, to containerURL: URL) throws {
    let expandedURL = containerURL.appendingPathComponent(artworkFilename)
    let compactURL = containerURL.appendingPathComponent(compactArtworkFilename)

    let expandedImage = squareScaledImage(image, side: 168)
    let compactImage = squareScaledImage(image, side: 72)

    guard let expandedData = expandedImage.jpegData(compressionQuality: 0.9),
          let compactData = compactImage.jpegData(compressionQuality: 0.9) else {
      throw NSError(domain: "ReactNativeWidgetExtension", code: 10)
    }

    try expandedData.write(to: expandedURL, options: .atomic)
    try compactData.write(to: compactURL, options: .atomic)
  }

  private func writeFallbackVariants(to containerURL: URL, fallbackPath: String?) -> Bool {
    guard let fallbackPath,
          let fallbackImage = UIImage(contentsOfFile: fallbackPath) else {
      return false
    }

    do {
      try writeArtworkVariants(fallbackImage, to: containerURL)
      return true
    } catch {
      return false
    }
  }

  private func artworkVariantsExist(at containerURL: URL) -> Bool {
    let expandedPath = containerURL.appendingPathComponent(artworkFilename).path
    let compactPath = containerURL.appendingPathComponent(compactArtworkFilename).path
    return FileManager.default.fileExists(atPath: expandedPath) && FileManager.default.fileExists(atPath: compactPath)
  }

  private func versionedFileURLString(path: String, version: Int) -> String {
    URL(fileURLWithPath: path).absoluteString + "?v=\(version)"
  }

  private func resolveArtworkReference(_ artworkURL: String, cacheKey: String) async -> String {
    let trimmed = artworkURL.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
      return artworkURL
    }

    let fallbackPath = ensureFallbackArtwork(at: containerURL)
    let destinationURL = containerURL.appendingPathComponent(artworkFilename)
    let defaults = UserDefaults(suiteName: appGroupIdentifier)
    let normalizedSource = cacheKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      ? (trimmed.isEmpty ? "empty" : trimmed)
      : cacheKey
    let previousSource = defaults?.string(forKey: artworkSourceDefaultsKey)
    let lastFetchedAt = defaults?.double(forKey: artworkFetchedAtDefaultsKey) ?? 0
    let now = Date().timeIntervalSince1970
    let isFresh = (now - lastFetchedAt) < artworkRefreshInterval

    if previousSource == normalizedSource, isFresh, artworkVariantsExist(at: containerURL) {
      return versionedFileURLString(path: destinationURL.path, version: Int(lastFetchedAt))
    }

    var candidates: [URL] = []
    var hasDirectArtworkCandidate = false
    if !trimmed.isEmpty && trimmed != defaultArtworkURL {
      let directCandidates = normalizedURLCandidates(from: trimmed)
      hasDirectArtworkCandidate = !directCandidates.isEmpty
      candidates.append(contentsOf: directCandidates)
    }
    if !hasDirectArtworkCandidate {
      candidates.append(contentsOf: await currentWebsiteArtworkCandidates())
    }
    candidates = dedupedURLs(candidates)

    for remoteURL in candidates {
      do {
        var request = URLRequest(url: remoteURL)
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.timeoutInterval = 8

        let (data, response) = try await URLSession.shared.data(for: request)
        if let httpResponse = response as? HTTPURLResponse,
           !(200 ..< 300).contains(httpResponse.statusCode) {
          continue
        }

        guard let image = UIImage(data: data) else {
          continue
        }

        try writeArtworkVariants(image, to: containerURL)
        defaults?.set(normalizedSource, forKey: artworkSourceDefaultsKey)
        defaults?.set(now, forKey: artworkFetchedAtDefaultsKey)
        return versionedFileURLString(path: destinationURL.path, version: Int(now))
      } catch {
        continue
      }
    }

    let sourceChanged = previousSource != normalizedSource
    if sourceChanged,
       writeFallbackVariants(to: containerURL, fallbackPath: fallbackPath) {
      defaults?.set(normalizedSource, forKey: artworkSourceDefaultsKey)
      defaults?.set(now, forKey: artworkFetchedAtDefaultsKey)
      return versionedFileURLString(path: destinationURL.path, version: Int(now))
    }

    if artworkVariantsExist(at: containerURL) {
      defaults?.set(now, forKey: artworkFetchedAtDefaultsKey)
      return versionedFileURLString(path: destinationURL.path, version: Int(now))
    }

    if let fallbackPath {
      return versionedFileURLString(path: fallbackPath, version: Int(now))
    }
    return artworkURL
  }

  @available(iOS 16.2, *)
  private func primaryActivity() -> Activity<RadioActivityAttributes>? {
    let activities = Activity<RadioActivityAttributes>.activities
    guard !activities.isEmpty else {
      setCurrentActivityID(nil)
      return nil
    }

    let defaults = UserDefaults(suiteName: appGroupIdentifier)
    if let savedID = defaults?.string(forKey: currentActivityIDDefaultsKey),
       let saved = activities.first(where: { $0.id == savedID }) {
      return saved
    }

    let first = activities[0]
    setCurrentActivityID(first.id)
    return first
  }

  @available(iOS 16.2, *)
  private func endExtraActivities(keeping activityID: String?) async {
    for activity in Activity<RadioActivityAttributes>.activities {
      if let activityID, activity.id == activityID {
        continue
      }
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }

  public func definition() -> ModuleDefinition {
    Name("ReactNativeWidgetExtension")

    Events("onAppearanceChange")

    OnStartObserving {
      DispatchQueue.main.async {
        self.startAppearanceTimer()
      }
    }

    OnStopObserving {
      DispatchQueue.main.async {
        self.stopAppearanceTimer()
      }
    }

    Function("getSystemColorScheme") { () -> String in
      if #available(iOS 13.0, *) {
        if Thread.isMainThread {
          return self.currentSystemColorScheme()
        }
        return DispatchQueue.main.sync {
          self.currentSystemColorScheme()
        }
      }

      return "light"
    }

    Function("areActivitiesEnabled") { () -> Bool in
      guard #available(iOS 16.2, *) else {
        return false
      }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    Function("getActivityDebugSnapshot") { () -> String in
      guard #available(iOS 16.2, *) else {
        return "unsupported-ios"
      }

      let activities = Activity<RadioActivityAttributes>.activities
      let ids = activities.map(\.id)
      let defaults = UserDefaults(suiteName: self.appGroupIdentifier)
      let saved = defaults?.string(forKey: self.currentActivityIDDefaultsKey) ?? "none"
      return "count:\(activities.count) saved:\(saved) ids:\(ids.joined(separator: ","))"
    }

    AsyncFunction("startActivity") { (title: String, subtitle: String, stationName: String, artworkURL: String, isLive: Bool, waveformLevel: Double) -> String in
      guard #available(iOS 16.2, *) else {
        return "unsupported-ios"
      }

      let attributes = RadioActivityAttributes(stationName: stationName)
      let artworkCacheKey = "\(title)|\(subtitle)|\(artworkURL)"
      let artworkReference = await self.resolveArtworkReference(artworkURL, cacheKey: artworkCacheKey)
      let state = RadioActivityAttributes.ContentState(title: title, subtitle: subtitle, isLive: isLive, artworkURL: artworkReference, waveformLevel: waveformLevel)
      let content = ActivityContent(state: state, staleDate: nil)

      do {
        if let existingActivity = self.primaryActivity() {
          await existingActivity.update(content)
          await self.endExtraActivities(keeping: existingActivity.id)
          self.setCurrentActivityID(existingActivity.id)
          let artMode = artworkReference.hasPrefix("/") || artworkReference.hasPrefix("file://") ? "local" : "remote"
          return "updated-existing art:\(artMode)"
        }

        let requested = try Activity<RadioActivityAttributes>.request(
          attributes: attributes,
          content: content,
          pushType: nil
        )
        self.setCurrentActivityID(requested.id)
        await self.endExtraActivities(keeping: requested.id)
        let artMode = artworkReference.hasPrefix("/") || artworkReference.hasPrefix("file://") ? "local" : "remote"
        return "requested art:\(artMode)"
      } catch {
        return "start-error: \(error.localizedDescription)"
      }
    }

    AsyncFunction("updateActivity") { (title: String, subtitle: String, isLive: Bool, artworkURL: String, waveformLevel: Double) -> String in
      guard #available(iOS 16.2, *) else {
        return "unsupported-ios"
      }

      let artworkCacheKey = "\(title)|\(subtitle)|\(artworkURL)"
      let artworkReference = await self.resolveArtworkReference(artworkURL, cacheKey: artworkCacheKey)
      let state = RadioActivityAttributes.ContentState(title: title, subtitle: subtitle, isLive: isLive, artworkURL: artworkReference, waveformLevel: waveformLevel)
      let content = ActivityContent(state: state, staleDate: nil)

      do {
        if let activity = self.primaryActivity() {
          await activity.update(content)
        } else {
          return "no-activity"
        }

        if let activity = self.primaryActivity() {
          await self.endExtraActivities(keeping: activity.id)
          self.setCurrentActivityID(activity.id)
        }
        let artMode = artworkReference.hasPrefix("/") || artworkReference.hasPrefix("file://") ? "local" : "remote"
        return "updated art:\(artMode)"
      } catch {
        return "update-error: \(error.localizedDescription)"
      }
    }

    AsyncFunction("endActivity") { () -> String in
      guard #available(iOS 16.2, *) else {
        return "unsupported-ios"
      }

      do {
        await self.endExtraActivities(keeping: nil)
        self.setCurrentActivityID(nil)
        return "ended"
      } catch {
        return "end-error: \(error.localizedDescription)"
      }
    }
  }
}
