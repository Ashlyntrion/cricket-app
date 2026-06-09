import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

const TABS = [
  { name: 'index',      title: 'Dashboard',  icon: 'home' as const },
  { name: 'attendance', title: 'Attendance', icon: 'checkbox' as const },
  { name: 'students',   title: 'Students',   icon: 'people' as const },
  { name: 'fees',       title: 'Fees',       icon: 'wallet' as const },
];

function FloatingTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 4);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      <View style={styles.bar}>
        {state.routes.map((route: any, index: number) => {
          const tab = TABS.find((t) => t.name === route.name) ?? TABS[0];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={[styles.tab, isFocused && styles.tabActive]}
              onPress={onPress}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFocused ? tab.icon : `${tab.icon}-outline` as any}
                size={20}
                color={isFocused ? 'white' : Colors.textSecondaryOnDark}
              />
              {isFocused && (
                <Text style={styles.tabLabel}>{tab.title}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.title }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    // Transparent so page content shows through
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.dark,
    borderRadius: 32,
    paddingHorizontal: 6,
    paddingVertical: 6,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 26,
    flexDirection: 'row',
    gap: 6,
  },
  tabActive: {
    flex: 2,
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
});
