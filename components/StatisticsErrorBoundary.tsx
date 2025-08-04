import { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { logger } from '@/utils/logger';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
  testID?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

/**
 * Error boundary component specifically designed for statistics components
 * Provides graceful error handling with retry mechanisms and detailed logging
 */
export class StatisticsErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeouts: NodeJS.Timeout[] = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error with detailed information
    logger.error('StatisticsErrorBoundary: Component error caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
    });

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Auto-retry for certain types of errors
    this.scheduleAutoRetry(error);
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  /**
   * Schedule automatic retry for recoverable errors
   */
  private scheduleAutoRetry = (error: Error) => {
    const { retryCount } = this.state;

    // Only auto-retry for certain types of errors and within retry limit
    if (retryCount < this.maxRetries && this.isRecoverableError(error)) {
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s

      logger.debug(`StatisticsErrorBoundary: Scheduling auto-retry in ${retryDelay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);

      const timeoutId = setTimeout(() => {
        this.handleRetry();
      }, retryDelay);

      this.retryTimeouts.push(timeoutId);
    }
  };

  /**
   * Determine if an error is recoverable and worth retrying
   */
  private isRecoverableError = (error: Error): boolean => {
    const recoverablePatterns = [
      /network/i,
      /timeout/i,
      /fetch/i,
      /connection/i,
      /temporary/i,
      /rate limit/i,
    ];

    return recoverablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    );
  };

  /**
   * Handle manual or automatic retry
   */
  private handleRetry = () => {
    const { retryCount } = this.state;

    logger.debug(`StatisticsErrorBoundary: Retrying (attempt ${retryCount + 1})`);

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: retryCount + 1,
    });

    // Call custom retry handler if provided
    this.props.onRetry?.();
  };

  /**
   * Reset error boundary state
   */
  private handleReset = () => {
    logger.debug('StatisticsErrorBoundary: Resetting error state');

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });

    // Clear any pending retries
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts = [];
  };

  /**
   * Get error category for better user messaging
   */
  private getErrorCategory = (error: Error): 'network' | 'data' | 'calculation' | 'unknown' => {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }

    if (message.includes('database') || message.includes('storage') || message.includes('cache')) {
      return 'data';
    }

    if (stack.includes('calculator') || stack.includes('statistics') || message.includes('calculation')) {
      return 'calculation';
    }

    return 'unknown';
  };

  /**
   * Get user-friendly error message based on error category
   */
  private getUserFriendlyMessage = (error: Error): { title: string; message: string; suggestion: string } => {
    const category = this.getErrorCategory(error);

    switch (category) {
      case 'network':
        return {
          title: 'Connection Issue',
          message: 'Unable to fetch the latest statistics data.',
          suggestion: 'Check your internet connection and try again.',
        };

      case 'data':
        return {
          title: 'Data Issue',
          message: 'There was a problem accessing your exploration data.',
          suggestion: 'Your data is safe. Try refreshing or restart the app.',
        };

      case 'calculation':
        return {
          title: 'Calculation Error',
          message: 'Unable to calculate some statistics.',
          suggestion: 'This might be temporary. Try refreshing the data.',
        };

      default:
        return {
          title: 'Something Went Wrong',
          message: 'An unexpected error occurred while loading statistics.',
          suggestion: 'Try refreshing or restart the app if the problem persists.',
        };
    }
  };

  /**
   * Render error details for debugging (only in development)
   */
  private renderErrorDetails = () => {
    const { error, errorInfo } = this.state;
    
    if (!error || !__DEV__) return null;

    return (
      <View style={styles.debugContainer}>
        <ThemedText style={styles.debugTitle}>Debug Information</ThemedText>
        <ThemedText style={styles.debugText} selectable>
          {error.message}
        </ThemedText>
        {error.stack && (
          <ThemedText style={styles.debugStack} selectable>
            {error.stack}
          </ThemedText>
        )}
      </View>
    );
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, testID = 'statistics-error-boundary' } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      const { title, message, suggestion } = this.getUserFriendlyMessage(error);
      const canRetry = retryCount < this.maxRetries;
      const isRecoverable = this.isRecoverableError(error);

      return (
        <ThemedView style={styles.container} testID={testID}>
          <View style={styles.content}>
            {/* Error Icon */}
            <ThemedText style={styles.errorIcon}>⚠️</ThemedText>

            {/* Error Title */}
            <ThemedText style={styles.errorTitle}>{title}</ThemedText>

            {/* Error Message */}
            <ThemedText style={styles.errorMessage}>{message}</ThemedText>

            {/* Suggestion */}
            <ThemedText style={styles.errorSuggestion}>{suggestion}</ThemedText>

            {/* Retry Information */}
            {retryCount > 0 && (
              <ThemedText style={styles.retryInfo}>
                Retry attempts: {retryCount}/{this.maxRetries}
              </ThemedText>
            )}

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              {canRetry && isRecoverable && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.retryButton]}
                  onPress={this.handleRetry}
                  testID={`${testID}-retry-button`}
                >
                  <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionButton, styles.resetButton]}
                onPress={this.handleReset}
                testID={`${testID}-reset-button`}
              >
                <ThemedText style={styles.resetButtonText}>Reset</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Debug Information (Development only) */}
            {this.renderErrorDetails()}
          </View>
        </ThemedView>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorSuggestion: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryInfo: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 16,
    textAlign: 'center',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
  },
  retryButton: {
    backgroundColor: '#0a7ea4',
  },
  resetButton: {
    backgroundColor: '#6B7280',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  debugContainer: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  debugText: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  debugStack: {
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: 'monospace',
    lineHeight: 14,
  },
});

export default StatisticsErrorBoundary;