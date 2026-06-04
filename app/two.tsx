import { Redirect } from 'expo-router';

// Legacy route compatibility for previously saved /two navigation state.
export default function LegacyRootTwoRedirect() {
  return <Redirect href="/(tabs)" />;
}
