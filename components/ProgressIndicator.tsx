import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export interface ProgressIndicatorProps {
  percentage: number;
  style?: 'bar' | 'circular';
  size?: 'small' | 'medium' | 'large';
  color?: string;
  backgroundColor?: string;
  showLabel?: boolean;
  animated?: boolean;
  duration?: number;
  testID?: string;
}

export function ProgressIndicator({
  percentage,
  style = 'bar',
  size = 'medium',
  color,
  backgroundColor,
  showLabel = false,
  animated = true,
  duration = 1000,
  testID,
}: ProgressIndicatorProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const rotationValue = useRef(new Animated.Value(0)).current;

  const defaultColor = useThemeColor({ light: '#10B981', dark: '#34D399' }, 'tint');
  const defaultBackgroundColor = useThemeColor({ light: '#F3F4F6', dark: '#374151' }, 'text');
  const textColor = useThemeColor({}, 'text');

  const progressColor = color || defaultColor;
  const progressBackgroundColor = backgroundColor || defaultBackgroundColor;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  useEffect(() => {
    if (animated) {
      const easingFunction = Easing?.out ? Easing.out(Easing.cubic) : undefined;
      
      Animated.timing(animatedValue, {
        toValue: clampedPercentage,
        duration,
        easing: easingFunction,
        useNativeDriver: false,
      }).start();

      // Rotation animation for circular progress
      if (style === 'circular') {
        Animated.timing(rotationValue, {
          toValue: (clampedPercentage / 100) * 360,
          duration,
          easing: easingFunction,
          useNativeDriver: true,
        }).start();
      }
    } else {
      animatedValue.setValue(clampedPercentage);
      rotationValue.setValue((clampedPercentage / 100) * 360);
    }
  }, [clampedPercentage, animated, duration, style]);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return style === 'circular' 
          ? { width: 24, height: 24 }
          : { height: 4 };
      case 'large':
        return style === 'circular' 
          ? { width: 80, height: 80 }
          : { height: 12 };
      default: // medium
        return style === 'circular' 
          ? { width: 48, height: 48 }
          : { height: 8 };
    }
  };

  const renderBarProgress = () => {
    const sizeStyles = getSizeStyles();
    
    return (
      <View 
        style={styles.container}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityValue={{ 
          min: 0, 
          max: 100, 
          now: clampedPercentage 
        }}
        accessibilityLabel={`Progress: ${clampedPercentage.toFixed(1)}%`}
        testID={testID}
      >
        <View
          style={[
            styles.progressBackground,
            sizeStyles,
            { backgroundColor: progressBackgroundColor },
          ]}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: progressColor,
                width: animatedValue.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />
        </View>
        {showLabel && (
          <ThemedText 
            style={[styles.label, { color: textColor }]}
            accessibilityLabel={`${clampedPercentage.toFixed(1)} percent`}
          >
            {clampedPercentage.toFixed(1)}%
          </ThemedText>
        )}
      </View>
    );
  };

  const renderCircularProgress = () => {
    const sizeStyles = getSizeStyles();
    const radius = (sizeStyles.width as number) / 2 - 4;
    const circumference = 2 * Math.PI * radius;
    const strokeWidth = size === 'small' ? 2 : size === 'large' ? 6 : 4;

    return (
      <View 
        style={[styles.circularContainer, sizeStyles]}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityValue={{ 
          min: 0, 
          max: 100, 
          now: clampedPercentage 
        }}
        accessibilityLabel={`Circular progress: ${clampedPercentage.toFixed(1)}%`}
        testID={testID}
      >
        {/* Background circle */}
        <View
          style={[
            styles.circularBackground,
            {
              width: sizeStyles.width,
              height: sizeStyles.height,
              borderRadius: (sizeStyles.width as number) / 2,
              borderWidth: strokeWidth,
              borderColor: progressBackgroundColor,
            },
          ]}
        />
        
        {/* Progress arc */}
        <Animated.View
          style={[
            styles.circularProgress,
            {
              width: sizeStyles.width,
              height: sizeStyles.height,
              borderRadius: (sizeStyles.width as number) / 2,
              borderWidth: strokeWidth,
              borderColor: progressColor,
              transform: [
                { rotate: '-90deg' },
                {
                  rotate: rotationValue.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        />

        {showLabel && (
          <View style={styles.circularLabelContainer}>
            <ThemedText 
              style={[
                styles.circularLabel, 
                { 
                  color: textColor,
                  fontSize: size === 'small' ? 8 : size === 'large' ? 16 : 12,
                }
              ]}
              accessibilityLabel={`${clampedPercentage.toFixed(1)} percent`}
            >
              {clampedPercentage.toFixed(0)}%
            </ThemedText>
          </View>
        )}
      </View>
    );
  };

  return style === 'circular' ? renderCircularProgress() : renderBarProgress();
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBackground: {
    borderRadius: 4,
    overflow: 'hidden',
    flex: 1,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  label: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  circularContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularBackground: {
    position: 'absolute',
  },
  circularProgress: {
    position: 'absolute',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  circularLabelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  circularLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
});