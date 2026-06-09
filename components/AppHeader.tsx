import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Animated, Dimensions, ScrollView, TouchableWithoutFeedback, Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataContext';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.76;

const NAV_ITEMS = [
  { icon: 'home-outline', iconActive: 'home', label: 'Dashboard', route: '/(tabs)' },
  { icon: 'checkmark-circle-outline', iconActive: 'checkmark-circle', label: 'Attendance', route: '/(tabs)/attendance' },
  { icon: 'people-outline', iconActive: 'people', label: 'Students', route: '/(tabs)/students' },
  { icon: 'wallet-outline', iconActive: 'wallet', label: 'Fees', route: '/(tabs)/fees' },
];

interface AppHeaderProps {
  title: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();

  const { coachName, coachInitials, academyName, students, batches, notifs } = useData();
  const coachRole = 'Head Coach';
  const studentCount = students.length;
  const batchCount = batches.length;

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 230, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 230, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  const isActive = (route: string) => {
    if (route === '/(tabs)') return pathname === '/' || pathname === '/index' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    return pathname.includes(route.replace('/(tabs)/', ''));
  };

  return (
    <>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={openDrawer} style={styles.headerBtn}>
            <Ionicons name="menu" size={24} color={Colors.textOnDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setNotifOpen(true)}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textOnDark} />
            {notifs.length > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{notifs.length > 9 ? '9+' : String(notifs.length)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── SIDEBAR DRAWER ── */}
      <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={closeDrawer}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={closeDrawer}>
            <Animated.View style={[styles.drawerOverlay, { opacity: overlayAnim }]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
            <SafeAreaView edges={['top', 'bottom']} style={styles.drawerInner}>

              {/* Coach profile */}
              <View style={styles.profileSection}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileInitials}>{coachInitials}</Text>
                </View>
                <Text style={styles.profileName}>{coachName}</Text>
                <Text style={styles.profileRole}>{coachRole}</Text>
                <View style={styles.profileBadge}>
                  <Ionicons name="shield-checkmark" size={12} color={Colors.accent} />
                  <Text style={styles.profileAcademy}>{academyName}</Text>
                </View>
                <View style={styles.profileStats}>
                  <View style={styles.profileStat}>
                    <Text style={styles.profileStatNum}>{studentCount}</Text>
                    <Text style={styles.profileStatLbl}>Students</Text>
                  </View>
                  <View style={styles.profileStatDivider} />
                  <View style={styles.profileStat}>
                    <Text style={styles.profileStatNum}>{batchCount}</Text>
                    <Text style={styles.profileStatLbl}>Batches</Text>
                  </View>
                </View>
              </View>

              {/* Nav */}
              <View style={styles.navSection}>
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.route);
                  return (
                    <TouchableOpacity
                      key={item.route}
                      style={[styles.navItem, active && styles.navItemActive]}
                      onPress={() => { closeDrawer(); setTimeout(() => router.push(item.route as any), 260); }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                        <Ionicons name={(active ? item.iconActive : item.icon) as any} size={20} color={active ? Colors.primary : Colors.textSecondaryOnDark} />
                      </View>
                      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
                      {active && <View style={styles.navActivePill} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Footer */}
              <View style={styles.drawerFooter}>
                <View style={styles.footerDivider} />
                <TouchableOpacity
                  style={styles.footerRow}
                  onPress={() => { closeDrawer(); setTimeout(() => router.push('/settings' as any), 260); }}
                >
                  <Ionicons name="settings-outline" size={20} color={Colors.textSecondaryOnDark} />
                  <Text style={styles.footerText}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerRow}
                  onPress={async () => {
                    const doSignOut = async () => {
                      closeDrawer();
                      await supabase.auth.signOut();
                      router.replace('/login');
                    };
                    if (Platform.OS === 'web') {
                      // eslint-disable-next-line no-restricted-globals
                      if (confirm('Are you sure you want to sign out?')) doSignOut();
                    } else {
                      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
                      ]);
                    }
                  }}
                >
                  <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
                  <Text style={[styles.footerText, { color: Colors.danger }]}>Sign Out</Text>
                </TouchableOpacity>
              </View>

            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      {/* ── NOTIFICATIONS PANEL ── */}
      <Modal visible={notifOpen} transparent animationType="slide" onRequestClose={() => setNotifOpen(false)}>
        <TouchableOpacity style={styles.notifOverlay} activeOpacity={1} onPress={() => setNotifOpen(false)}>
          {/* Inner TouchableOpacity absorbs taps so they don't bubble up and close the sheet */}
          <TouchableOpacity activeOpacity={1} style={styles.notifSheet}>
            <View style={styles.notifHandle} />
            <View style={styles.notifHeaderRow}>
              <Text style={styles.notifTitle}>Notifications</Text>
              {notifs.length > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{notifs.length}</Text>
                </View>
              )}
              <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={() => setNotifOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {notifs.length === 0 ? (
                <View style={styles.notifEmpty}>
                  <Ionicons name="checkmark-circle-outline" size={40} color={Colors.primary} />
                  <Text style={styles.notifEmptyText}>All caught up!</Text>
                  <Text style={styles.notifEmptySubtext}>No overdue fees or absences</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.notifSection}>Action Required</Text>
                  {notifs.map((n, i) => {
                    const isDueSoon = n.phone && n.amount && n.daysUntilDue !== undefined;
                    const isOverdue = n.phone && n.amount && n.daysUntilDue === undefined && n.type === 'fee';
                    const hasWhatsApp = isDueSoon || isOverdue;

                    const handleTap = () => {
                      setNotifOpen(false);
                      if (hasWhatsApp && n.phone) {
                        const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                        const msg = isDueSoon
                          ? `Hi ${n.title}, your cricket coaching fee of ₹${n.amount!.toLocaleString()} for ${month} is due in ${n.daysUntilDue} day${n.daysUntilDue !== 1 ? 's' : ''}. Please arrange the payment. – ${coachName}, ${academyName}`
                          : `Hi ${n.title}, your cricket coaching fee of ₹${n.amount!.toLocaleString()} for ${month} is overdue. Please pay at the earliest. – ${coachName}, ${academyName}`;
                        const phone = n.phone.replace(/\D/g, '');
                        const dialCode = phone.length === 10 ? `91${phone}` : phone;
                        setTimeout(() => Linking.openURL(`https://wa.me/${dialCode}?text=${encodeURIComponent(msg)}`), 300);
                      } else {
                        setTimeout(() => router.push(n.route as any), 300);
                      }
                    };

                    return (
                      <TouchableOpacity
                        key={n.id + i}
                        style={[styles.notifRow, i < notifs.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}
                        onPress={handleTap}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.notifIconWrap, {
                          backgroundColor: n.daysUntilDue !== undefined
                            ? 'rgba(245,158,11,0.1)'
                            : n.type === 'fee' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        }]}>
                          <Ionicons
                            name={hasWhatsApp ? 'logo-whatsapp' : n.type === 'fee' ? 'wallet' : 'people'}
                            size={18}
                            color={n.daysUntilDue !== undefined ? Colors.warning : n.type === 'fee' ? Colors.danger : Colors.warning}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.notifName}>{n.title}</Text>
                          <Text style={styles.notifMsg}>{n.msg}</Text>
                          {hasWhatsApp && (
                            <Text style={styles.notifWaHint}>Tap to send WhatsApp reminder</Text>
                          )}
                        </View>
                        <Text style={styles.notifTime}>{n.time}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
              <View style={{ height: 32 }} />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerSafe: { backgroundColor: Colors.dark },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.dark,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textOnDark },
  headerBtn: { padding: 4, position: 'relative' },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: 'white', fontSize: 9, fontWeight: '800' },

  // Drawer
  drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH, backgroundColor: Colors.dark,
  },
  drawerInner: { flex: 1 },

  // Profile
  profileSection: {
    padding: 20, paddingTop: 24,
    borderBottomWidth: 1, borderBottomColor: Colors.darkBorder,
  },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  profileInitials: { fontSize: 22, fontWeight: '800', color: 'white' },
  profileName: { fontSize: 18, fontWeight: '800', color: Colors.textOnDark, marginBottom: 2 },
  profileRole: { fontSize: 13, color: Colors.textSecondaryOnDark, marginBottom: 6 },
  profileBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  profileAcademy: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  profileStats: { flexDirection: 'row', alignItems: 'center' },
  profileStat: { alignItems: 'center' },
  profileStatNum: { fontSize: 20, fontWeight: '800', color: Colors.textOnDark },
  profileStatLbl: { fontSize: 11, color: Colors.textSecondaryOnDark, marginTop: 1 },
  profileStatDivider: { width: 1, height: 28, backgroundColor: Colors.darkBorder, marginHorizontal: 20 },

  // Nav
  navSection: { flex: 1, paddingTop: 12, paddingHorizontal: 12 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13, marginBottom: 2,
  },
  navItemActive: { backgroundColor: 'rgba(34,197,94,0.1)' },
  navIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: 'rgba(34,197,94,0.15)' },
  navLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textSecondaryOnDark },
  navLabelActive: { color: Colors.primary },
  navActivePill: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },

  // Footer
  drawerFooter: { paddingHorizontal: 12, paddingBottom: 8 },
  footerDivider: { height: 1, backgroundColor: Colors.darkBorder, marginBottom: 8 },
  footerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
  },
  footerText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondaryOnDark },

  // Notifications
  notifOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  notifSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
    maxHeight: '85%',
  },
  notifHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  notifHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  notifTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  notifBadge: { backgroundColor: Colors.danger, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  notifBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
  notifSection: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  notifIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifName: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  notifMsg: { fontSize: 12, color: Colors.textSecondary },
  notifWaHint: { fontSize: 11, color: '#25D366', fontWeight: '600', marginTop: 2 },
  notifTime: { fontSize: 11, color: Colors.textMuted },
  notifEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  notifEmptyText: { fontSize: 16, fontWeight: '700', color: Colors.text },
  notifEmptySubtext: { fontSize: 13, color: Colors.textSecondary },
});
