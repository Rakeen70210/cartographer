/**
 * FogOverlay component for rendering fog of war overlay
 * with proper styling and error handling for invalid geometries
 */

import { logger } from '@/utils/logger';
import { FogStyling } from '@/utils/mapStyling';
import MapboxGL from '@rnmapbox/maps';
import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import React from 'react';

/**
 * Props interface for FogOverlay component
 */
export interface FogOverlayProps {
  /** GeoJSON feature collection containing fog polygon(s) to render */
  fogGeoJSON: FeatureCollection<Polygon | MultiPolygon>;
  /** Styling configuration for fog fill and edge appearance */
  styling: FogStyling;
  /** Optional custom source ID for the MapboxGL ShapeSource (default: 'fogSource') */
  sourceId?: string;
  /** Optional custom layer ID for the fog fill layer (default: 'fogLayer') */
  fillLayerId?: string;
  /** Optional custom layer ID for the fog edge layer (default: 'fogEdgeLayer') */
  edgeLayerId?: string;
}

/**
 * FogOverlay component renders fog of war overlay on the map
 * Provides comprehensive validation of fog geometry and styling before rendering
 * Returns null for invalid data to prevent map rendering errors
 * Uses separate fill and edge layers for optimal fog appearance
 * 
 * @param props - Component props containing fog geometry, styling, and optional layer IDs
 * @returns JSX element for the fog overlay or null if data is invalid
 * 
 * @example
 * ```tsx
 * <FogOverlay 
 *   fogGeoJSON={fogFeatureCollection}
 *   styling={fogStyling}
 *   sourceId="customFogSource"
 * />
 * ```
 */
const FogOverlay: React.FC<FogOverlayProps> = ({
  fogGeoJSON,
  styling,
  sourceId = 'fogSource',
  fillLayerId = 'fogLayer',
  edgeLayerId = 'fogEdgeLayer',
}) => {
  // Validate fog geometry before rendering
  if (!fogGeoJSON) {
    logger.warn('FogOverlay: No fog GeoJSON provided');
    return null;
  }

  if (fogGeoJSON.type !== 'FeatureCollection') {
    logger.error('FogOverlay: Invalid fog GeoJSON - not a FeatureCollection', {
      type: fogGeoJSON.type
    });
    return null;
  }

  if (!fogGeoJSON.features || !Array.isArray(fogGeoJSON.features)) {
    logger.error('FogOverlay: Invalid fog GeoJSON - missing or invalid features array');
    return null;
  }

  if (fogGeoJSON.features.length === 0) {
    logger.debug('FogOverlay: No fog features to render');
    return null;
  }

  // Validate that all features are valid polygon geometries
  const hasInvalidFeatures = fogGeoJSON.features.some(feature => {
    if (!feature || feature.type !== 'Feature') {
      logger.warn('FogOverlay: Invalid feature - not a Feature type', { feature });
      return true;
    }

    if (!feature.geometry) {
      logger.warn('FogOverlay: Invalid feature - missing geometry', { feature });
      return true;
    }

    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
      logger.warn('FogOverlay: Invalid feature - geometry is not Polygon or MultiPolygon', {
        geometryType: feature.geometry.type
      });
      return true;
    }

    if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) {
      logger.warn('FogOverlay: Invalid feature - missing or invalid coordinates', { feature });
      return true;
    }

    return false;
  });

  if (hasInvalidFeatures) {
    logger.error('FogOverlay: Some fog features are invalid, skipping render');
    return null;
  }

  // Validate styling object
  if (!styling || typeof styling !== 'object') {
    logger.error('FogOverlay: Invalid styling object provided');
    return null;
  }

  if (!styling.fill || !styling.edge) {
    logger.error('FogOverlay: Styling object missing fill or edge properties');
    return null;
  }

  try {
    return (
      <MapboxGL.ShapeSource id={sourceId} shape={fogGeoJSON}>
        <MapboxGL.FillLayer
          id={fillLayerId}
          sourceID={sourceId}
          style={styling.fill}
        />
        <MapboxGL.LineLayer
          id={edgeLayerId}
          sourceID={sourceId}
          style={styling.edge}
        />
      </MapboxGL.ShapeSource>
    );
  } catch (error) {
    logger.error('FogOverlay: Error rendering fog overlay', error);
    return null;
  }
};

export default FogOverlay;