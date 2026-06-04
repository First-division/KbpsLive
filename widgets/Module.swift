import ActivityKit
import ExpoModulesCore

public class ReactNativeWidgetExtensionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReactNativeWidgetExtension")

    Function("areActivitiesEnabled") { () -> Bool in
      guard #available(iOS 16.2, *) else {
        return false
      }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("startActivity") { (title: String, subtitle: String, stationName: String, artworkURL: String, isLive: Bool) in
      guard #available(iOS 16.2, *) else {
        return
      }

      let attributes = RadioActivityAttributes(stationName: stationName)
      let state = RadioActivityAttributes.ContentState(title: title, subtitle: subtitle, isLive: isLive, artworkURL: artworkURL)
      let content = ActivityContent(state: state, staleDate: nil)

      Task {
        if let existingActivity = Activity<RadioActivityAttributes>.activities.first {
          await existingActivity.update(content)
          return
        }

        _ = try? Activity<RadioActivityAttributes>.request(
          attributes: attributes,
          content: content,
          pushType: nil
        )
      }
    }

    AsyncFunction("updateActivity") { (title: String, subtitle: String, isLive: Bool, artworkURL: String) in
      guard #available(iOS 16.2, *) else {
        return
      }

      let state = RadioActivityAttributes.ContentState(title: title, subtitle: subtitle, isLive: isLive, artworkURL: artworkURL)
      let content = ActivityContent(state: state, staleDate: nil)

      Task {
        for activity in Activity<RadioActivityAttributes>.activities {
          await activity.update(content)
        }
      }
    }

    AsyncFunction("endActivity") {
      guard #available(iOS 16.2, *) else {
        return
      }

      Task {
        for activity in Activity<RadioActivityAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }
  }
}
