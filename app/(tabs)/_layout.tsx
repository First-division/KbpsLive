import { Ionicons } from '@expo/vector-icons';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
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
      minimizeBehavior={Platform.OS === 'ios' ? 'never' : undefined}
    >
      <NativeTabs.Trigger name="explore">
        <Icon
          sf={{ default: 'safari', selected: 'safari.fill' }}
          androidSrc={<VectorIcon family={Ionicons} name="compass" />}
        />
        <Label>Explore</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: 'dot.radiowaves.left.and.right', selected: 'dot.radiowaves.left.and.right' }}
          androidSrc={<VectorIcon family={Ionicons} name="radio" />}
        />
        <Label>Live</Label>
        <NativeTabs.Trigger.TabBar
          backgroundColor={tabBarBackground}
          blurEffect={Platform.OS === 'ios' ? 'none' : undefined}
          shadowColor={Platform.OS === 'ios' ? 'rgba(0, 0, 0, 0.18)' : undefined}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recent">
        <Icon
          sf={{ default: 'clock', selected: 'clock.fill' }}
          androidSrc={<VectorIcon family={Ionicons} name="time" />}
        />
        <Label>Recent</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          androidSrc={<VectorIcon family={Ionicons} name="settings" />}
        />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
