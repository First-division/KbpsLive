import ExpoModulesCore
public class ReactNativeWidgetExtensionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReactNativeWidgetExtension")

    Events("onAppearanceChange")

    Function("getSystemColorScheme") { () -> String in
      return "light"
    }

    Function("areActivitiesEnabled") { () -> Bool in
      return false
    }

    Function("getActivityDebugSnapshot") { () -> String in
      return "disabled"
    }

    AsyncFunction("startActivity") { (_: String, _: String, _: String, _: String, _: Bool, _: Double) -> String in
      return "disabled"
    }

    AsyncFunction("updateActivity") { (_: String, _: String, _: Bool, _: String, _: Double) -> String in
      return "disabled"
    }

    AsyncFunction("endActivity") { () -> String in
      return "disabled"
    }
  }
}
