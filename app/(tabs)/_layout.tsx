import { Ionicons } from '@expo/vector-icons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import Colors from '@/constants/Colors';
import { supportsIOSNativeTabCompaction } from '@/constants/platform';
import { useColorScheme } from '@/components/useColorScheme';

const { Icon, Label, VectorIcon } = NativeTabs.Trigger;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const supportsTabCompaction =
    Platform.OS === 'ios' && supportsIOSNativeTabCompaction(Platform.Version);
  const tabBarBackground = Platform.OS === 'ios' ? '#0E1013' : theme.card;
  const selectedIconColor = colorScheme === 'dark' ? '#1A73E8' : theme.tabIconSelected;

  return (
    <NativeTabs
      blurEffect={Platform.OS === 'ios' ? 'none' : undefined}
      backgroundColor={tabBarBackground}
      tintColor={theme.tabIconSelected}
      iconColor={{ default: theme.tabIconDefault, selected: selectedIconColor }}
      labelStyle={{
        default: {
          color: theme.tabIconDefault,
          fontSize: 12,
          fontWeight: '600',
        },
        selected: {
          color: theme.tabIconSelected,
          fontSize: 12,
          fontWeight: '600',
        },
      }}
      shadowColor={Platform.OS === 'ios' ? 'rgba(0, 0, 0, 0.35)' : undefined}
      disableTransparentOnScrollEdge
      minimizeBehavior={supportsTabCompaction ? 'onScrollDown' : undefined}
    >
      <NativeTabs.Trigger name="explore">
        <Icon
          sf={{ default: 'safari', selected: 'safari.fill' }}
          src={<VectorIcon family={Ionicons} name="compass" />}
        />
        <Label>Explore</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: 'dot.radiowaves.left.and.right', selected: 'dot.radiowaves.left.and.right' }}
          src={<VectorIcon family={Ionicons} name="radio" />}
        />
        <Label>Live</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recent">
        <Icon
          sf={{ default: 'clock', selected: 'clock.fill' }}
          src={<VectorIcon family={Ionicons} name="time" />}
        />
        <Label>Recent</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          src={<VectorIcon family={Ionicons} name="settings" />}
        />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
