# Advanced Fog Visualization Features

This document describes the advanced fog visualization features implemented for the Cartographer app, providing enhanced visual effects, animations, and customization options for the fog of war system.

## Overview

The advanced fog visualization system extends the basic fog overlay with:

- **Fog Edge Smoothing & Anti-aliasing**: Smooth, blurred edges for professional appearance
- **Animated Fog Transitions**: Smooth animations when new areas are revealed
- **Fog Density Variations**: Dynamic density based on exploration recency
- **Customizable Fog Themes**: Multiple visual themes with unique characteristics
- **Particle Effects**: Magical particle animations for enhanced themes
- **Glow Effects**: Edge glow for better definition and visual appeal

## Features

### 1. Fog Edge Smoothing and Anti-aliasing

The advanced fog system provides smooth, anti-aliased edges through configurable blur effects:

```typescript
const styling = getAdvancedFogStyling('dark', mapStyle, 'classic', 'medium');
// styling.edge.lineBlur controls the smoothing amount (0-8)
```

**Benefits:**
- Professional, polished appearance
- Reduces visual artifacts on high-DPI displays
- Configurable blur intensity per theme

### 2. Animated Fog Transitions

When new areas are revealed, the fog animates smoothly with customizable timing and easing:

```typescript
const advancedFog = useAdvancedFogVisualization(colorScheme, mapStyle);

// Trigger reveal animation when new location is explored
advancedFog.triggerRevealAnimation();
```

**Animation Properties:**
- `revealDuration`: Animation duration (400-1500ms depending on theme)
- `easing`: Animation curve (linear, ease-in, ease-out, ease-in-out, bounce)
- `fadeDuration`: Fade transition duration
- `enableParticles`: Whether to show particle effects

### 3. Fog Density Variations Based on Exploration Recency

Recently explored areas have lighter fog that gradually becomes denser over time:

```typescript
// Calculate density based on when area was last explored
const density = calculateRecencyBasedDensity(
  lastExploredTimestamp,
  'medium', // base density
  24 // max age in hours
);
```

**Recency Algorithm:**
- Areas explored within the last hour: Lightest fog
- Areas explored 12+ hours ago: Medium fog
- Areas explored 24+ hours ago: Full density fog
- Configurable maximum age and minimum density

### 4. Customizable Fog Themes

Six built-in themes with unique visual characteristics:

#### Classic Theme
- **Colors**: Dark blue-gray (#1E293B)
- **Style**: Traditional, subtle
- **Use Case**: General purpose, professional

#### Mystical Theme
- **Colors**: Purple tones (#312E81, #6366F1)
- **Style**: Magical glow effects, particles
- **Use Case**: Fantasy/adventure themes

#### Arctic Theme
- **Colors**: Ice blue (#0F172A, #0EA5E9)
- **Style**: Crystalline edges, cool tones
- **Use Case**: Cold/winter environments

#### Volcanic Theme
- **Colors**: Red-orange (#7C2D12, #F97316)
- **Style**: Fiery glow, ember particles
- **Use Case**: Hot/desert environments

#### Ethereal Theme
- **Colors**: Light, translucent (#F8FAFC)
- **Style**: Soft, dreamy appearance
- **Use Case**: Light themes, minimal design

#### Neon Theme
- **Colors**: Cyberpunk green (#00FF88)
- **Style**: Bright neon glow, high contrast
- **Use Case**: Futuristic/cyberpunk themes

### 5. Particle Effects

Enhanced themes support animated particle effects during fog reveal:

```typescript
<AdvancedFogOverlay
  enableParticleEffects={true}
  theme="mystical" // Themes with particle support
  isRevealing={isRevealing}
/>
```

**Particle Features:**
- Theme-appropriate colors
- Configurable intensity (0-20 particles)
- Smooth fade-in/fade-out animations
- Performance-optimized rendering

### 6. Glow Effects

Edge glow effects provide better definition and visual appeal:

```typescript
const styling = getAdvancedFogStyling('dark', mapStyle, 'volcanic');
// styling.edge.glowIntensity controls glow strength (0-1)
// styling.edge.glowColor defines glow color
```

## Usage

### Basic Integration

```typescript
import AdvancedFogOverlay from '@/components/AdvancedFogOverlay';
import { useAdvancedFogVisualization } from '@/hooks/useAdvancedFogVisualization';

const MapComponent = () => {
  const colorScheme = useColorScheme();
  const advancedFog = useAdvancedFogVisualization(colorScheme, mapStyle);
  
  return (
    <MapboxGL.MapView>
      <AdvancedFogOverlay
        fogGeoJSON={fogGeoJSON}
        colorScheme={colorScheme}
        mapStyleUrl={mapStyle}
        theme={advancedFog.config.theme}
        density={advancedFog.config.density}
        enableAnimations={advancedFog.config.enableAnimations}
        enableParticleEffects={advancedFog.config.enableParticleEffects}
        isRevealing={advancedFog.isRevealing}
      />
    </MapboxGL.MapView>
  );
};
```

### Settings UI

```typescript
import FogVisualizationSettings from '@/components/FogVisualizationSettings';

const SettingsScreen = () => {
  const [showSettings, setShowSettings] = useState(false);
  const advancedFog = useAdvancedFogVisualization(colorScheme, mapStyle);
  
  return (
    <>
      <TouchableOpacity onPress={() => setShowSettings(true)}>
        <Text>Fog Settings</Text>
      </TouchableOpacity>
      
      <FogVisualizationSettings
        fogVisualization={advancedFog}
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
};
```

### Custom Styling

```typescript
const customStyling = {
  fill: {
    fillColor: '#FF0000',
    fillOpacity: 0.9,
  },
  edge: {
    lineWidth: 3,
    lineBlur: 5,
    glowIntensity: 0.8,
    glowColor: '#FFFF00',
  },
  animation: {
    revealDuration: 1200,
    easing: 'bounce',
    enableParticles: true,
  },
};

const advancedFog = useAdvancedFogVisualization(colorScheme, mapStyle);
await advancedFog.updateCustomStyling(customStyling);
```

## Performance Considerations

### Optimization Features

1. **Viewport-based Rendering**: Only processes fog in visible area
2. **Animation Debouncing**: Prevents excessive animations during rapid changes
3. **Particle Culling**: Limits particle count based on performance
4. **Memory Management**: Efficient cleanup of animation resources

### Performance Settings

```typescript
const config = {
  enableAnimations: true, // Disable for better performance
  enableParticleEffects: false, // Disable for mobile devices
  enableEdgeSmoothing: true, // Minimal performance impact
  enableRecencyBasedDensity: true, // Slight calculation overhead
};
```

### Recommended Settings by Device

**High-end Devices:**
- All features enabled
- Mystical/Volcanic themes with particles
- Full animation duration

**Mid-range Devices:**
- Animations enabled, particles disabled
- Classic/Arctic themes
- Reduced animation duration

**Low-end Devices:**
- Animations disabled
- Classic theme only
- Edge smoothing disabled

## API Reference

### `getAdvancedFogStyling(colorScheme, mapStyleUrl, theme?, density?, customizations?)`

Generates advanced fog styling configuration.

**Parameters:**
- `colorScheme`: 'light' | 'dark' | null
- `mapStyleUrl`: Mapbox style URL
- `theme`: FogTheme (optional, default: 'classic')
- `density`: FogDensity (optional, default: 'medium')
- `customizations`: Partial styling overrides (optional)

**Returns:** `AdvancedFogStyling`

### `useAdvancedFogVisualization(colorScheme, mapStyleUrl)`

Hook for managing advanced fog visualization state.

**Returns:** Object with:
- `config`: Current configuration
- `setTheme(theme)`: Change fog theme
- `setDensity(density)`: Change fog density
- `toggleAnimations()`: Toggle animation support
- `triggerRevealAnimation()`: Trigger reveal animation
- `resetToDefaults()`: Reset all settings

### `calculateRecencyBasedDensity(timestamp, baseDensity, maxAgeHours)`

Calculates fog density based on exploration recency.

**Parameters:**
- `timestamp`: When area was last explored (milliseconds)
- `baseDensity`: Base density level
- `maxAgeHours`: Maximum age for density calculation

**Returns:** Density multiplier (0-1)

## Testing

The advanced fog visualization system includes comprehensive tests:

```bash
# Run advanced fog styling tests
npm test -- __tests__/advancedFogStyling.test.js

# Run component tests
npm test -- __tests__/AdvancedFogOverlay.test.js

# Run integration tests
npm test -- __tests__/integration/advanced-fog-visualization.integration.test.js
```

## Future Enhancements

Potential future improvements:

1. **Weather-based Themes**: Fog appearance based on weather conditions
2. **Time-of-day Variations**: Different fog density for day/night
3. **Seasonal Themes**: Automatic theme switching based on season
4. **Custom Particle Systems**: User-defined particle effects
5. **Performance Profiling**: Built-in performance monitoring
6. **Accessibility Options**: High contrast modes, reduced motion

## Troubleshooting

### Common Issues

**Animations not working:**
- Check that `react-native-reanimated` is properly installed
- Verify `enableAnimations` is set to `true`
- Ensure device has sufficient performance

**Particles not showing:**
- Verify theme supports particles (mystical, arctic, volcanic, neon)
- Check `enableParticleEffects` setting
- Confirm `isRevealing` is being triggered

**Performance issues:**
- Disable particle effects on lower-end devices
- Reduce animation duration
- Use simpler themes (classic, ethereal)
- Disable edge smoothing if needed

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
import { logger } from '@/utils/logger';

// Enable debug logging for fog visualization
logger.debugOnce('Advanced fog visualization initialized');
```

## Conclusion

The advanced fog visualization system provides a rich, customizable experience for the fog of war feature while maintaining good performance across different device capabilities. The modular design allows for easy customization and extension while providing sensible defaults for most use cases.