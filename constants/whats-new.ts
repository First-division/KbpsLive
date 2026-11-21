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
  "subtitle": "Listen to KBPS Live, explore the schedule, and find help in the app guide.",
  "features": [
    "Listen live and view recently played songs.",
    "Explore the show schedule, news, interviews, and song requests.",
    "Open the App Guide and What's New from Settings."
  ],
  "bugFixes": [
    "Improved the App Guide and What's New screens with clear navigation."
  ],
  "guideTip": "Find the App Guide and What's New in Settings whenever you need them."
};
