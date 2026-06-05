export type WhatsNewContent = {
  releaseLabel: string;
  title: string;
  subtitle: string;
  features: string[];
  bugFixes: string[];
  guideTip: string;
};

export const WHATS_NEW_CONTENT: WhatsNewContent = {
  "releaseLabel": "1.0.0",
  "title": "KbpsLive 1.0.0",
  "subtitle": "The first KBPS Live release adds a guided onboarding flow, a proper What's New screen, and OTA-ready update tracking.",
  "features": [
    "Added a first-launch guide that explains how to use Live, Recent, Explore, and Settings.",
    "Added a What's New screen that appears after app updates and can be reopened from Settings.",
    "Added OTA update tracking so the app remembers which update the user has already seen."
  ],
  "bugFixes": [
    "Improved startup flow so onboarding only appears once and update notes do not repeat unnecessarily.",
    "Kept launch-state storage isolated from the theme preference storage."
  ],
  "guideTip": "This first release sets up the foundations for KBPS Live's onboarding and release-note experience. New users get a short guide to the app, and returning users can see what changed after an update without hunting through the interface."
};
