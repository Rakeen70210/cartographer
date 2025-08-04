import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

export interface OfflineIndicatorProps {
  isOffline: boolean;
  offlineReason?: string;
  dataSource?: 'online' | 'offline' | 'cache';
  lastOnlineTime?: number;
  onRetry?: () => Promise<boolean>;
  onDismiss?: () => void;
  style?: any;
  testID?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOffline,
  offlineReason,
  dataSource,
  lastOnlineTime,
  onRetry,
  onDismiss,
  style,
  testID = 'offline-indicator'
}) => {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(false);

  // Theme colors
  const backgroundColor = useThemeColor(
    { light: '#FEF3C7', dark: '#451A03' },
    'background'
  );
  const borderColor = useThemeColor(
    { light: '#F59E0B', dark: '#FBBF24' },
    'border'
  );
  const textColor = useThemeColor(
    { light: '#92400E', dark: '#FCD34D' },
    'text'
  );
  const iconColor = useThemeColor(
    { light: '#D97706', dark: '#FBBF24' },
    'text'
  );

  // Animation values
  const pulseValue = useSharedValue(1);
  const slideValue = useSharedValue(0);

  // Start pulse animation when offline
  React.useEffect(() => {
    if (isOffline && !isDismissed) {
      pulseValue.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
      slideValue.value = withTiming(1, { duration: 300 });
    } else {
      slideValue.value = withTiming(0, { duration: 300 });
    }
  }, [isOffline, isDismissed, pulseValue, slideValue]);

  // Animated styles
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseValue.value }],
  }));

  const slideStyle = useAnimatedStyle(() => ({
    opacity: slideValue.value,
    transform: [{ translateY: (1 - slideValue.value) * -20 }],
  }));

  // Handle retry action
  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      const success = await onRetry();
      if (success) {
        setIsDismissed(true);
      }
    } catch (error) {
      console.warn('OfflineIndicator: Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  // Handle dismiss action
  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Format last online time
  const formatLastOnlineTime = (timestamp?: number): string => {
    if (!timestamp) return 'Unknown';

    const now = Date.now();
    const diffMinutes = Math.floor((now - timestamp) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Get indicator message based on state
  const getIndicatorMessage = (): { title: string; subtitle: string; icon: string } => {
    if (dataSource === 'cache') {
      return {
        title: 'Using Cached Data',
        subtitle: offlineReason || 'Showing previously loaded information',
        icon: '💾'
      };
    }

    if (isOffline) {
      return {
        title: 'Offline Mode',
        subtitle: offlineReason || `Last online: ${formatLastOnlineTime(lastOnlineTime)}`,
        icon: '📡'
      };
    }

    return {
      title: 'Connected',
      subtitle: 'All features available',
      icon: '✅'
    };
  };

  // Don't render if not offline and not using cache, or if dismissed
  if ((!isOffline && dataSource !== 'cache') || isDismissed) {
    return null;
  }

  const { title, subtitle, icon } = getIndicatorMessage();

  return (
    <Animated.View style={[slideStyle, style]} testID={testID}>
      <Animated.View style={pulseStyle}>
        <ThemedView
          style={[
            styles.container,
            {
              backgroundColor,
              borderColor,
            },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <ThemedText style={[styles.icon, { color: iconColor }]}>
                {icon}
              </ThemedText>
            </View>

            <View style={styles.textContainer}>
              <ThemedText
                style={[styles.title, { color: textColor }]}
                numberOfLines={1}
              >
                {title}
              </ThemedText>
              <ThemedText
                style={[styles.subtitle, { color: textColor }]}
                numberOfLines={2}
              >
                {subtitle}
              </ThemedText>
            </View>

            <View style={styles.actionsContainer}>
              {onRetry && isOffline && (
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor }]}
                  onPress={handleRetry}
                  disabled={isRetrying}
                  testID={`${testID}-retry-button`}
                >
                  <ThemedText
                    style={[
                      styles.actionButtonText,
                      { color: textColor },
                      isRetrying && styles.actionButtonTextDisabled,
                    ]}
                  >
                    {isRetrying ? '⟳' : '↻'}
                  </ThemedText>
                </TouchableOpacity>
              )}

              {onDismiss && (
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor }]}
                  onPress={handleDismiss}
                  testID={`${testID}-dismiss-button`}
                >
                  <ThemedText
                    style={[styles.actionButtonText, { color: textColor }]}
                  >
                    ✕
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ThemedView>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconContainer: {
    marginRight: 10,
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.8,
    lineHeight: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonTextDisabled: {
    opacity: 0.5,
  },
});

export default OfflineIndicator;