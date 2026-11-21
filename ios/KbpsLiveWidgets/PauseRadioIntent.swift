import AppIntents
import Foundation

private let appGroupIdentifier = "group.com.firstdivisioncaptain.KbpsLive"
private let pauseRadioNotification = "KbpsLive.pauseRadio"
private let pauseRequestDefaultsKey = "kbpslive.pause.requestID"
private let pauseHandledDefaultsKey = "kbpslive.pause.handledID"

@available(iOS 17.0, *)
struct PauseRadioIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Pause radio"
  static var openAppWhenRun = false

  @MainActor
  func perform() async throws -> some IntentResult {
    let requestID = UUID().uuidString
    let defaults = UserDefaults(suiteName: appGroupIdentifier)
    defaults?.set(requestID, forKey: pauseRequestDefaultsKey)
    defaults?.removeObject(forKey: pauseHandledDefaultsKey)

    let response = NSMutableDictionary(dictionary: ["requestID": requestID])
    NotificationCenter.default.post(name: Notification.Name(pauseRadioNotification), object: response)
    CFNotificationCenterPostNotification(
      CFNotificationCenterGetDarwinNotifyCenter(),
      CFNotificationName(pauseRadioNotification as CFString),
      nil,
      nil,
      true
    )

    if response["paused"] as? Bool == true {
      return .result()
    }

    let deadline = Date().addingTimeInterval(1.1)
    while Date() < deadline {
      if defaults?.string(forKey: pauseHandledDefaultsKey) == requestID {
        return .result()
      }
      try? await Task.sleep(nanoseconds: 70_000_000)
    }

    defaults?.removeObject(forKey: pauseRequestDefaultsKey)
    defaults?.removeObject(forKey: pauseHandledDefaultsKey)
    guard response["paused"] as? Bool == true else {
      throw PauseRadioError.unavailable
    }

    return .result()
  }
}

private enum PauseRadioError: LocalizedError {
  case unavailable

  var errorDescription: String? {
    "The radio player is unavailable. Open KBPS Live to control playback."
  }
}
