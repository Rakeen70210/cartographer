/**
 * Tests for FogOverlay component
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import FogOverlay from './FogOverlay';

// Mock the Mapbox module
jest.mock('@rnmapbox/maps', () => ({
  ShapeSource: ({ children, ...props }) => {
    const MockedShapeSource = 'MockedShapeSource';
    return <MockedShapeSource {...props}>{children}</MockedShapeSource>;
  },
  FillLayer: (props) => {
    const MockedFillLayer = 'MockedFillLayer';
    return <MockedFillLayer {...props} />;
  },
  LineLayer: (props) => {
    const MockedLineLayer = 'MockedLineLayer';
    return <MockedLineLayer {...props} />;
  },
}));

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('FogOverlay', () => {
  const mockStyling = {
    fill: {
      fillColor: '#0F172A',
      fillOpacity: 0.85,
    },
    edge: {
      lineColor: '#334155',
      lineOpacity: 0.6,
      lineWidth: 1.5,
      lineBlur: 3,
    },
  };

  const mockFogGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-180, -90],
              [-180, 90],
              [180, 90],
              [180, -90],
              [-180, -90],
            ],
          ],
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with valid fog GeoJSON and styling', () => {
    const { UNSAFE_getByType } = render(
      <FogOverlay fogGeoJSON={mockFogGeoJSON} styling={mockStyling} />
    );
    
    // Should render ShapeSource, FillLayer, and LineLayer
    expect(UNSAFE_getByType('MockedShapeSource')).toBeTruthy();
    expect(UNSAFE_getByType('MockedFillLayer')).toBeTruthy();
    expect(UNSAFE_getByType('MockedLineLayer')).toBeTruthy();
  });

  it('does not render when fogGeoJSON is null', () => {
    const { logger } = require('@/utils/logger');
    const { UNSAFE_queryByType } = render(
      <FogOverlay fogGeoJSON={null} styling={mockStyling} />
    );
    
    expect(UNSAFE_queryByType('MockedShapeSource')).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('FogOverlay: No fog GeoJSON provided');
  });

  it('does not render when fogGeoJSON is not a FeatureCollection', () => {
    const { logger } = require('@/utils/logger');
    const invalidGeoJSON = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [] },
    };
    
    const { UNSAFE_queryByType } = render(
      <FogOverlay fogGeoJSON={invalidGeoJSON} styling={mockStyling} />
    );
    
    expect(UNSAFE_queryByType('MockedShapeSource')).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'FogOverlay: Invalid fog GeoJSON - not a FeatureCollection',
      { type: 'Feature' }
    );
  });

  it('does not render when features array is missing', () => {
    const { logger } = require('@/utils/logger');
    const invalidGeoJSON = {
      type: 'FeatureCollection',
    };
    
    const { UNSAFE_queryByType } = render(
      <FogOverlay fogGeoJSON={invalidGeoJSON} styling={mockStyling} />
    );
    
    expect(UNSAFE_queryByType('MockedShapeSource')).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'FogOverlay: Invalid fog GeoJSON - missing or invalid features array'
    );
  });

  it('does not render when features array is empty', () => {
    const { logger } = require('@/utils/logger');
    const emptyGeoJSON = {
      type: 'FeatureCollection',
      features: [],
    };
    
    const { UNSAFE_queryByType } = render(
      <FogOverlay fogGeoJSON={emptyGeoJSON} styling={mockStyling} />
    );
    
    expect(UNSAFE_queryByType('MockedShapeSource')).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith('FogOverlay: No fog features to render');
  });

  it('does not render when features contain invalid geometries', () => {
    const { logger } = require('@/utils/logger');
    const invalidGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point', // Invalid geometry type for fog
            coordinates: [0, 0],
          },
        },
      ],
    };
    
    const { UNSAFE_queryByType } = render(
      <FogOverlay fogGeoJSON={invalidGeoJSON} styling={mockStyling} />
    );
    
    expect(UNSAFE_queryByType('MockedShapeSource')).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'FogOverlay: Some fog features are invalid, skipping render'
    );
  });

  it('does not render when styling is invalid', () => {
    const { logger } = require('@/utils/logger');
    const { UNSAFE_queryByType } = render(
      <FogOverlay fogGeoJSON={mockFogGeoJSON} styling={null} />
    );
    
    expect(UNSAFE_queryByType('MockedShapeSource')).toBeNull();
    expect(logger.error).toHaveBeenCalledWith('FogOverlay: Invalid styling object provided');
  });

  it('does not render when styling is missing fill or edge properties', () => {
    const { logger } = require('@/utils/logger');
    const incompleteStyling = {
      fill: mockStyling.fill,
      // Missing edge property
    };
    
    const { UNSAFE_queryByType } = render(
      <FogOverlay fogGeoJSON={mockFogGeoJSON} styling={incompleteStyling} />
    );
    
    expect(UNSAFE_queryByType('MockedShapeSource')).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'FogOverlay: Styling object missing fill or edge properties'
    );
  });

  it('uses custom source and layer IDs when provided', () => {
    const { UNSAFE_getByType } = render(
      <FogOverlay 
        fogGeoJSON={mockFogGeoJSON} 
        styling={mockStyling}
        sourceId="customFogSource"
        fillLayerId="customFogLayer"
        edgeLayerId="customFogEdgeLayer"
      />
    );
    
    const shapeSource = UNSAFE_getByType('MockedShapeSource');
    const fillLayer = UNSAFE_getByType('MockedFillLayer');
    const lineLayer = UNSAFE_getByType('MockedLineLayer');
    
    expect(shapeSource.props.id).toBe('customFogSource');
    expect(fillLayer.props.id).toBe('customFogLayer');
    expect(fillLayer.props.sourceID).toBe('customFogSource');
    expect(lineLayer.props.id).toBe('customFogEdgeLayer');
    expect(lineLayer.props.sourceID).toBe('customFogSource');
  });

  it('uses default source and layer IDs when not provided', () => {
    const { UNSAFE_getByType } = render(
      <FogOverlay fogGeoJSON={mockFogGeoJSON} styling={mockStyling} />
    );
    
    const shapeSource = UNSAFE_getByType('MockedShapeSource');
    const fillLayer = UNSAFE_getByType('MockedFillLayer');
    const lineLayer = UNSAFE_getByType('MockedLineLayer');
    
    expect(shapeSource.props.id).toBe('fogSource');
    expect(fillLayer.props.id).toBe('fogLayer');
    expect(fillLayer.props.sourceID).toBe('fogSource');
    expect(lineLayer.props.id).toBe('fogEdgeLayer');
    expect(lineLayer.props.sourceID).toBe('fogSource');
  });

  it('applies correct styling to fill and line layers', () => {
    const { UNSAFE_getByType } = render(
      <FogOverlay fogGeoJSON={mockFogGeoJSON} styling={mockStyling} />
    );
    
    const fillLayer = UNSAFE_getByType('MockedFillLayer');
    const lineLayer = UNSAFE_getByType('MockedLineLayer');
    
    expect(fillLayer.props.style).toEqual(mockStyling.fill);
    expect(lineLayer.props.style).toEqual(mockStyling.edge);
  });

  it('handles MultiPolygon geometries correctly', () => {
    const multiPolygonGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [-180, -90],
                  [-180, 90],
                  [180, 90],
                  [180, -90],
                  [-180, -90],
                ],
              ],
            ],
          },
        },
      ],
    };
    
    const { UNSAFE_getByType } = render(
      <FogOverlay fogGeoJSON={multiPolygonGeoJSON} styling={mockStyling} />
    );
    
    expect(UNSAFE_getByType('MockedShapeSource')).toBeTruthy();
    expect(UNSAFE_getByType('MockedFillLayer')).toBeTruthy();
    expect(UNSAFE_getByType('MockedLineLayer')).toBeTruthy();
  });

  it('validates feature structure correctly', () => {
    const { logger } = require('@/utils/logger');
    const invalidFeatureGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'NotAFeature', // Invalid feature type
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
      ],
    };
    
    const { UNSAFE_queryByType } = render(
      <FogOverlay fogGeoJSON={invalidFeatureGeoJSON} styling={mockStyling} />
    );
    
    expect(UNSAFE_queryByType('MockedShapeSource')).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'FogOverlay: Some fog features are invalid, skipping render'
    );
  });
});