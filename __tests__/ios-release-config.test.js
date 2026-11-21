const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const appConfig = require('../app.json').expo;
const podProperties = require('../ios/Podfile.properties.json');

describe('iOS release configuration', () => {
  it('enables the React Native architecture required by Expo SDK 58', () => {
    const infoPlist = fs.readFileSync(path.join(root, 'ios/KbpsLive/Info.plist'), 'utf8');

    expect(podProperties.newArchEnabled).toBe('true');
    expect(infoPlist).toMatch(/<key>RCTNewArchEnabled<\/key>\s*<true\s*\/>/);
  });

  it('uses scene lifecycle and isolates SDK 58 updates from older native builds', () => {
    const infoPlist = fs.readFileSync(path.join(root, 'ios/KbpsLive/Info.plist'), 'utf8');
    const expoPlist = fs.readFileSync(path.join(root, 'ios/KbpsLive/Supporting/Expo.plist'), 'utf8');
    const androidStrings = fs.readFileSync(path.join(root, 'android/app/src/main/res/values/strings.xml'), 'utf8');
    const project = fs.readFileSync(path.join(root, 'ios/KbpsLive.xcodeproj/project.pbxproj'), 'utf8');
    const easConfig = require('../eas.json');

    expect(infoPlist).toContain('UIApplicationSceneManifest');
    expect(infoPlist).toContain('$(PRODUCT_MODULE_NAME).SceneDelegate');
    expect(project).toContain('SceneDelegate.swift in Sources');
    expect(appConfig.runtimeVersion).toBe('1.0.0-sdk58');
    expect(expoPlist).toContain(`<string>${appConfig.runtimeVersion}</string>`);
    expect(androidStrings).toContain(`name="expo_runtime_version">${appConfig.runtimeVersion}</string>`);
    expect(easConfig.build.production.ios.image).toBe('macos-tahoe-26.6-xcode-27.2');
  });

  it('uses the configured iOS deployment target for the app and pods', () => {
    const buildProperties = appConfig.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
    );
    const target = buildProperties[1].ios.deploymentTarget;
    const project = fs.readFileSync(path.join(root, 'ios/KbpsLive.xcodeproj/project.pbxproj'), 'utf8');

    expect(podProperties['ios.deploymentTarget']).toBe(target);
    for (const id of ['13B07F941A680F5B00A75B9A', '13B07F951A680F5B00A75B9A']) {
      const settings = project.match(new RegExp(`${id} /\\* (?:Debug|Release) \\*/ = \\{([\\s\\S]*?)\\n\\s*\\};`));
      expect(settings).not.toBeNull();
      expect(settings[1]).toContain(`IPHONEOS_DEPLOYMENT_TARGET = ${target};`);
    }
  });

  it('builds the Live Activity pause intent into both targets and keeps widget sources synchronized', () => {
    const project = fs.readFileSync(path.join(root, 'ios/KbpsLive.xcodeproj/project.pbxproj'), 'utf8');
    const widget = fs.readFileSync(path.join(root, 'ios/KbpsLiveWidgets/KbpsLiveWidgets.swift'), 'utf8');
    const widgetCopy = fs.readFileSync(path.join(root, 'widgets/KbpsLiveWidgets.swift'), 'utf8');
    const intent = fs.readFileSync(path.join(root, 'ios/KbpsLiveWidgets/PauseRadioIntent.swift'), 'utf8');
    const audioPatch = fs.readFileSync(path.join(root, 'patches/expo-audio+58.0.12.patch'), 'utf8');

    expect(widgetCopy).toBe(widget);
    expect(project.match(/\/\* PauseRadioIntent\.swift in Sources \*\/,/g)).toHaveLength(2);
    expect(widget.match(/PauseRadioButton\(/g)).toHaveLength(2);
    expect(intent).toContain('LiveActivityIntent');
    expect(intent).toContain('KbpsLive.pauseRadio');
    expect(audioPatch).toContain('KbpsLive.pauseRadio');
  });
});
