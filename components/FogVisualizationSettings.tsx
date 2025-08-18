/**
 * Settings component for advanced fog visualization features
 * Provides UI controls for fog themes, density, animations, and visual effects
 */

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { UseAdvancedFogVisualizationReturn } from '@/hooks/useAdvancedFogVisualization';
import {
    FogDensity,
    getFogThemeInfo
} from '@/utils/advancedFogStyling';
import React from 'react';
import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';

/**
 * Props for FogVisualizationSettings component
 */
export interface FogVisualizationSettingsProps {
  /** Advanced fog visualization hook return object */
  fogVisualization: UseAdvancedFogVisualizationReturn;
  /** Whether the settings panel is visible */
  visible: boolean;
  /** Callback when settings panel should be closed */
  onClose: () => void;
}

/**
 * Settings component for advanced fog visualization
 * 
 * Features:
 * - Theme selection with visual previews
 * - Density level controls
 * - Animation and particle effect toggles
 * - Edge smoothing controls
 * - Recency-based density options
 * - Reset to defaults button
 * 
 * @param props - Component props
 * @returns JSX element for the settings panel
 */
const FogVisualizationSettings: React.FC<FogVisualizationSettingsProps> = ({
  fogVisualization,
  visible,
  onClose,
}) => {
  const {
    config,
    availableThemes,
    isLoading,
    error,
    setTheme,
    setDensity,
    toggleAnimations,
    toggleParticleEffects,
    toggleRecencyBasedDensity,
    toggleEdgeSmoothing,
    resetToDefaults,
    triggerRevealAnimation,
  } = fogVisualization;

  if (!visible) {
    return null;
  }

  const densityLevels: FogDensity[] = ['light', 'medium', 'heavy', 'ultra'];

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>Fog Visualization Settings</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <ThemedText style={styles.closeButtonText}>✕</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading settings...</ThemedText>
          </View>
        )}

        {/* Theme Selection */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Fog Theme</ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Choose the visual style and color scheme for the fog overlay
          </ThemedText>
          
          <View style={styles.themeGrid}>
            {availableThemes.map((theme) => {
              const themeInfo = getFogThemeInfo(theme);
              const isSelected = config.theme === theme;
              
              return (
                <TouchableOpacity
                  key={theme}
                  style={[
                    styles.themeCard,
                    isSelected && styles.themeCardSelected,
                  ]}
                  onPress={() => setTheme(theme)}
                  disabled={isLoading}
                >
                  <View
                    style={[
                      styles.themePreview,
                      { backgroundColor: themeInfo.primaryColor },
                    ]}
                  >
                    {themeInfo.secondaryColor && (
                      <View
                        style={[
                          styles.themePreviewAccent,
                          { backgroundColor: themeInfo.secondaryColor },
                        ]}
                      />
                    )}
                  </View>
                  <ThemedText style={styles.themeName}>{themeInfo.name}</ThemedText>
                  <ThemedText style={styles.themeDescription}>
                    {themeInfo.description}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Density Selection */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Fog Density</ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Control the opacity and thickness of the fog overlay
          </ThemedText>
          
          <View style={styles.densityContainer}>
            {densityLevels.map((density) => {
              const isSelected = config.density === density;
              
              return (
                <TouchableOpacity
                  key={density}
                  style={[
                    styles.densityButton,
                    isSelected && styles.densityButtonSelected,
                  ]}
                  onPress={() => setDensity(density)}
                  disabled={isLoading}
                >
                  <ThemedText
                    style={[
                      styles.densityButtonText,
                      isSelected && styles.densityButtonTextSelected,
                    ]}
                  >
                    {density.charAt(0).toUpperCase() + density.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Animation Settings */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Animation & Effects</ThemedText>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Enable Animations</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Smooth transitions when revealing new areas
              </ThemedText>
            </View>
            <Switch
              value={config.enableAnimations}
              onValueChange={toggleAnimations}
              disabled={isLoading}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Particle Effects</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Magical particles during fog reveal animations
              </ThemedText>
            </View>
            <Switch
              value={config.enableParticleEffects}
              onValueChange={toggleParticleEffects}
              disabled={isLoading || !config.enableAnimations}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Edge Smoothing</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Anti-aliasing for smoother fog edges
              </ThemedText>
            </View>
            <Switch
              value={config.enableEdgeSmoothing}
              onValueChange={toggleEdgeSmoothing}
              disabled={isLoading}
            />
          </View>
        </View>

        {/* Density Variation Settings */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Density Variations</ThemedText>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Recency-Based Density</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Recently explored areas have lighter fog
              </ThemedText>
            </View>
            <Switch
              value={config.enableRecencyBasedDensity}
              onValueChange={toggleRecencyBasedDensity}
              disabled={isLoading}
            />
          </View>
        </View>

        {/* Test Controls */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Test Controls</ThemedText>
          
          <TouchableOpacity
            style={styles.testButton}
            onPress={triggerRevealAnimation}
            disabled={isLoading || !config.enableAnimations}
          >
            <ThemedText style={styles.testButtonText}>
              Test Reveal Animation
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Reset Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetToDefaults}
            disabled={isLoading}
          >
            <ThemedText style={styles.resetButtonText}>
              Reset to Defaults
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000,
  },
  scrollView: {
    flex: 1,
    padding: 20,
    paddingTop: 60, // Account for status bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  themeCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  themePreview: {
    height: 40,
    borderRadius: 8,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  themePreviewAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '30%',
    height: '100%',
    opacity: 0.7,
  },
  themeName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  themeDescription: {
    fontSize: 12,
    opacity: 0.7,
  },
  densityContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  densityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  densityButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  densityButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  densityButtonTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  testButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FogVisualizationSettings;