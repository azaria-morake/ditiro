import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Rocket,
  ShieldCheck,
  BellRing,
  Sparkles,
  ChevronRight,
  ArrowRight,
  Check
} from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import DitiroManSvg from '../../assets/ditiro-man.svg';

interface OnboardingSplashScreenProps {
  onFinish: () => void;
}

interface SlideItem {
  id: number;
  badge: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive sizing for the mascot + wordmark SVG
// Aspect ratio of ditiro-man.svg is 1570 / 1696 (~0.9257 width/height)
const MAX_LOGO_HEIGHT = SCREEN_HEIGHT * 0.38;
const DESIRED_WIDTH = Math.min(SCREEN_WIDTH * 0.72, 285);
const COMPUTED_HEIGHT = DESIRED_WIDTH * (1696 / 1570);
const LOGO_HEIGHT = Math.min(COMPUTED_HEIGHT, MAX_LOGO_HEIGHT);
const LOGO_WIDTH = LOGO_HEIGHT * (1570 / 1696);

const SLIDES: SlideItem[] = [
  {
    id: 1,
    badge: 'AUTONOMOUS SCOUT',
    title: 'Your Mobile Task Drone',
    description:
      'A dedicated mobile companion designed to rapidly capture deeds on the fly and keep your daily operations seamlessly aligned.',
    icon: <Rocket size={16} color={COLORS.proteaOrange} />,
  },
  {
    id: 2,
    badge: 'ZERO-KNOWLEDGE PRIVACY',
    title: 'End-to-End Encrypted',
    description:
      'Client-side AES-256 encryption seals your deeds before they leave your device. Only you possess the keys to decrypt your workspace.',
    icon: <ShieldCheck size={16} color="#4EAA6A" />,
  },
  {
    id: 3,
    badge: 'ACTIVE CADENCE',
    title: 'Proactive Alert Engine',
    description:
      'Persistent system alarms and customizable repeat intervals ensure urgent tasks and time-sensitive deeds never get lost in the noise.',
    icon: <BellRing size={16} color="#E55353" />,
  },
  {
    id: 4,
    badge: 'ECOSYSTEM HARMONY',
    title: 'Real-Time Web Sync',
    description:
      'Complete tasks on mobile and watch them reflect instantly across your desktop web app. One unified ecosystem in complete flow.',
    icon: <Sparkles size={16} color={COLORS.proteaOrange} />,
  },
];

export const OnboardingSplashScreen: React.FC<OnboardingSplashScreenProps> = ({ onFinish }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < SLIDES.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const goToSlide = (index: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        x: index * SCREEN_WIDTH,
        animated: true,
      });
      setActiveIndex(index);
    }
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      goToSlide(activeIndex + 1);
    } else {
      onFinish();
    }
  };

  const isLastSlide = activeIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFBF0" />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Top Bar with Skip Button */}
        <View style={styles.topBar}>
          <View style={styles.phaseIndicator}>
            <View style={styles.phaseDot} />
            <Text style={styles.phaseText}>DRONE SCOUT 1.1</Text>
          </View>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={onFinish}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Branding Section: Transparent SVG + Strong Centered Tagline */}
        <View style={styles.brandingContainer}>
          <View style={styles.logoWrapper}>
            <DitiroManSvg
              width={LOGO_WIDTH}
              height={LOGO_HEIGHT}
            />
          </View>
          <Text style={styles.tagline}>
            Turning intentions — into actions!
          </Text>
        </View>

        {/* Bottom Card Overlay containing Carousel & Navigation */}
        <View style={styles.bottomCard}>
            
            {/* Horizontal Swipeable Slides */}
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              style={styles.carouselScrollView}
            >
              {SLIDES.map((slide) => (
                <View key={slide.id} style={styles.slidePage}>
                  
                  {/* Badge */}
                  <View style={styles.badgeRow}>
                    <View style={styles.iconCircle}>{slide.icon}</View>
                    <Text style={styles.badgeLabel}>{slide.badge}</Text>
                  </View>

                  {/* Title */}
                  <Text style={styles.slideTitle}>{slide.title}</Text>

                  {/* Description */}
                  <Text style={styles.slideDescription}>{slide.description}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Navigation Dots and Action Button */}
            <View style={styles.footerRow}>
              
              {/* Pagination Dots */}
              <View style={styles.dotsContainer}>
                {SLIDES.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => goToSlide(i)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <View
                      style={[
                        styles.dot,
                        activeIndex === i ? styles.activeDot : styles.inactiveDot,
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action Button: Next or Get Started */}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isLastSlide && styles.actionButtonFinal,
                ]}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={styles.actionButtonText}>
                  {isLastSlide ? 'Get Started' : 'Next'}
                </Text>
                {isLastSlide ? (
                  <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                ) : (
                  <ChevronRight size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF0', // Exact warm-cream matching brand backdrop
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
  },
  phaseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 35, 66, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.proteaOrange,
    marginRight: 6,
  },
  phaseText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0C2342',
    letterSpacing: 0.8,
  },
  skipButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(12, 35, 66, 0.06)',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C2342',
  },
  brandingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '800',
    color: '#0C2342', // Strong deep navy matching Ditiro logo wordmark
    letterSpacing: 0.3,
    textAlign: 'center',
    maxWidth: SCREEN_WIDTH * 0.88,
  },
  bottomCard: {
    backgroundColor: '#0C2342', // Deep navy matching wordmark
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 22,
    paddingBottom: Platform.OS === 'ios' ? 24 : 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  carouselScrollView: {
    width: SCREEN_WIDTH,
  },
  slidePage: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 26,
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.sunGold,
    letterSpacing: 1.2,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  slideDescription: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 21,
    minHeight: 44,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    paddingTop: 18,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 26,
    backgroundColor: COLORS.proteaOrange,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.proteaOrange,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 14,
    shadowColor: COLORS.proteaOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonFinal: {
    backgroundColor: COLORS.proteaOrange,
    shadowColor: COLORS.proteaOrange,
    paddingHorizontal: 20,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
