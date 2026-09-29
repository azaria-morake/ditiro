import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform
} from 'react-native';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react-native';
import { COLORS } from '../constants/theme';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'info' | 'error';
  onDismiss: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'success',
  onDismiss,
  duration = 2600
}) => {
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 50,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertCircle size={18} color="#EF4444" />;
      case 'info':
        return <Info size={18} color="#3B82F6" />;
      case 'success':
      default:
        return <CheckCircle2 size={18} color="#10B981" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'error':
        return 'rgba(239, 68, 68, 0.4)';
      case 'info':
        return 'rgba(59, 130, 246, 0.4)';
      case 'success':
      default:
        return 'rgba(16, 185, 129, 0.4)';
    }
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }],
          opacity,
          borderColor: getBorderColor(),
        },
      ]}
    >
      <TouchableOpacity
        style={styles.innerRow}
        activeOpacity={0.9}
        onPress={handleDismiss}
      >
        <View style={styles.iconBox}>{getIcon()}</View>
        <Text style={styles.toastText} numberOfLines={2}>
          {message}
        </Text>
        <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss}>
          <X size={14} color={COLORS.mutedText} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 25,
    left: 20,
    right: 20,
    backgroundColor: '#1E2128',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 9999,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastText: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
  },
});
