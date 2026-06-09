import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, FlatList, StatusBar, Image,
} from 'react-native';
import { CricketShield } from '../components/CricketShield';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

const SLIDES = [{ id: '0' }, { id: '1' }];

export default function OnboardingScreen() {
  const [current, setCurrent] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const next = () => {
    if (current < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: current + 1, animated: true });
      setCurrent(current + 1);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (item.id === '0' ? <Slide0 /> : <Slide1 />)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      {/* Overlay footer — dots, button, login */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, current === i && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.88}>
          <Text style={styles.nextText}>{current < SLIDES.length - 1 ? 'Next' : "Let's Go!"}</Text>
          <Ionicons name="chevron-forward" size={20} color="#0f1923" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginRow} onPress={() => router.replace('/(tabs)')}>
          <Text style={[styles.loginText, current === 1 && { color: 'rgba(0,0,0,0.5)' }]}>Already have an account? </Text>
          <Text style={[styles.loginLink, current === 1 && { color: '#d97706' }]}>Login</Text>
        </TouchableOpacity>
      </View>

      {/* Skip button top-right */}
      <SafeAreaView edges={['top']} style={styles.skipSafe} pointerEvents="box-none">
        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

function LogoOrShield() {
  try {
    const src = require('../assets/logo.png');
    return <Image source={src} style={{ width: 160, height: 160 }} resizeMode="contain" />;
  } catch {
    return <CricketShield size={160} />;
  }
}

function Slide0() {
  return (
    <View style={styles.slide}>
      {/* Deep dark stadium gradient */}
      <LinearGradient
        colors={['#060e1c', '#0a1628', '#0d2040', '#081420']}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Stadium light glow — top left */}
      <View style={[styles.glow, { top: -60, left: -60, width: 260, height: 260, opacity: 0.07 }]} />
      {/* Stadium light glow — top right */}
      <View style={[styles.glow, { top: -40, right: -80, width: 220, height: 220, opacity: 0.06 }]} />
      {/* Ground glow — green field at bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(10,40,20,0.5)', 'rgba(5,25,12,0.85)']}
        style={styles.groundGlow}
      />

      {/* Cricket bat — large decorative (bottom right) */}
      <Text style={styles.batDecor}>🏏</Text>
      {/* Cricket ball — bottom left */}
      <Text style={styles.ballDecor}>🔴</Text>

      {/* Content */}
      <SafeAreaView edges={['top']} style={styles.slide0Content}>
        {/* Logo */}
        <View style={styles.shieldWrapper}>
          <LogoOrShield />
        </View>

        {/* Main headline */}
        <View style={styles.headlineBlock}>
          <Text style={styles.headline}>MANAGE.</Text>
          <Text style={styles.headline}>TRACK.</Text>
          <Text style={styles.headlineGold}>GROW. TOGETHER.</Text>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          The all-in-one app to manage attendance,{'\n'}
          fees and performance — so you can{'\n'}
          focus on coaching.
        </Text>
      </SafeAreaView>
    </View>
  );
}

function Slide1() {
  const features = [
    { icon: 'people', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', title: 'Mark Attendance', sub: 'Quick tap. Auto save. No paperwork.' },
    { icon: 'wallet', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', title: 'Track Fees', sub: "Know who has paid, who's due & overdue." },
    { icon: 'bar-chart', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', title: 'Get Insights', sub: 'Smart charts to help you take action.' },
  ];

  return (
    <View style={[styles.slide, { backgroundColor: '#ffffff' }]}>
      <SafeAreaView edges={['top']} style={styles.slide1Content}>
        <View style={styles.slide1Top}>
          <Text style={styles.slide1Title}>Built for Coaches{'\n'}Like You</Text>
          <Text style={styles.slide1Sub}>Track what matters. Focus on what you do best — coaching.</Text>
        </View>

        <View style={styles.featureList}>
          {features.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: f.bg }]}>
                <Ionicons name={f.icon as any} size={24} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060e1c' },
  slide: { width, height },

  // Glow effects
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'white',
  },
  groundGlow: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: height * 0.45,
  },

  // Decorative elements
  batDecor: {
    position: 'absolute',
    bottom: height * 0.14,
    right: -20,
    fontSize: 220,
    opacity: 0.18,
    transform: [{ rotate: '15deg' }],
  },
  ballDecor: {
    position: 'absolute',
    bottom: height * 0.16,
    left: 20,
    fontSize: 80,
    opacity: 0.25,
  },

  // Slide 0 content
  slide0Content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  shieldWrapper: { marginBottom: 24, marginTop: 8 },
  headlineBlock: { alignItems: 'flex-start', width: '100%', marginBottom: 20 },
  headline: {
    fontSize: 42,
    fontWeight: '900',
    color: 'white',
    lineHeight: 48,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  headlineGold: {
    fontSize: 42,
    fontWeight: '900',
    color: '#f59e0b',
    lineHeight: 48,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Skip button
  skipSafe: { position: 'absolute', top: 0, right: 0, left: 0, pointerEvents: 'box-none' },
  skipBtn: { position: 'absolute', top: 12, right: 20, padding: 8 },
  skipText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '500' },

  // Footer (dots + button + login)
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24,
    paddingBottom: 36,
    alignItems: 'center',
    gap: 16,
  },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 28, backgroundColor: '#f59e0b' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 18,
    width: '100%',
  },
  nextText: { fontSize: 17, fontWeight: '800', color: '#0f1923' },
  loginRow: { flexDirection: 'row' },
  loginText: { color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  loginLink: { color: '#f59e0b', fontSize: 14, fontWeight: '700' },

  // Slide 1
  slide1Content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  slide1Top: { marginBottom: 40 },
  slide1Title: { fontSize: 32, fontWeight: '800', color: '#0f1923', lineHeight: 40, marginBottom: 10 },
  slide1Sub: { fontSize: 15, color: '#64748b', lineHeight: 22 },
  featureList: { gap: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  featureIcon: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 16, fontWeight: '700', color: '#0f1923', marginBottom: 4 },
  featureSub: { fontSize: 13, color: '#64748b', lineHeight: 18 },
});
