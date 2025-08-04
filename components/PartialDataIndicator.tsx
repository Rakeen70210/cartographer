import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

export interface PartialDataIndicatorProps {
  failedCalculations: string[];
  onRetry?: () => void;
  onDismiss?: () => void;
  style?: any;
  testID?: string;
}

export const PartialDataIndicator: React.FC<PartialDataIndicatorProps> = ({
  failedCalculations,
  onRetry,
  onDismiss,
  style,
  testID = 'partial-data-indicator'
}) => {
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

  // Handle retry action
  const handleRetry = () => {
    onRetry?.();
  };

  // Handle dismiss action
  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Don't render if dismissed or no failed calculations
  if (isDismissed || failedCalculations.length === 0) {
    return null;
  }

  const getDisplayMessage = (): { title: string; subtitle: string } => {
    const count = failedCalculations.length;
    const calculations = failedCalculations.join(', ');

    if (count === 1) {
      return {
        title: 'Partial Data Available',
        subtitle: `Unable to calculate ${calculations}. Other statistics are still available.`
      };
    }

    return {
      title: 'Some Data Unavailable',
      subtitle: `Unable to calculate ${count} statistics: ${calculations}. Other data is still available.`
    };
  };

  const { title, subtitle } = getDisplayMessage();

  return (
    <ThemedView
      style={[
        styles.container,
        {
          backgroundColor,
          borderColor,
        },
        style
      ]}
      testID={testID}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <ThemedText style={[styles.icon, { color: textColor }]}>
            ⚠️
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
            numberOfLines={3}
          >
            {subtitle}
          </ThemedText>
        </View>

        <View style={styles.actionsContainer}>
          {onRetry && (
            <TouchableOpacity
              style={[styles.actionButton, { borderColor }]}
              onPress={handleRetry}
              testID={`${testID}-retry-button`}
            >
              <ThemedText
                style={[styles.actionButtonText, { color: textColor }]}
              >
                ↻
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
});

export default PartialDataIndicator;