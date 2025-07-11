import MapboxGL from '@rnmapbox/maps';
import { buffer, difference, union } from '@turf/turf';
import { Feature, FeatureCollection, GeoJsonProperties, Point, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import useLocationTracking from '../../hooks/useLocationTracking';
import { getRevealedAreas, initDatabase, saveRevealedArea } from '../../utils/database';

// Define a more specific type for revealed areas, which are polygons
type RevealedArea = Feature<Polygon, GeoJsonProperties>;

const MapScreen = () => {
  const { location, errorMsg } = useLocationTracking();
  const bufferDistance = 20; // Buffer distance in meters
  const mapRef = useRef<MapboxGL.MapView>(null);
  const [revealedGeoJSON, setRevealedGeoJSON] = useState<Feature<Polygon, GeoJsonProperties> | null>(null);

  // Effect for initializing DB and fetching existing data
  useEffect(() => {
    const setup = async () => {
      await initDatabase();

      // Load all revealed areas and union them into a single polygon
      const revealedPolygons = await getRevealedAreas() as RevealedArea[];
      if (revealedPolygons.length > 0) {
        let unioned: RevealedArea = revealedPolygons[0];
        for (let i = 1; i < revealedPolygons.length; i++) {
          try {
            // @ts-ignore
            unioned = union(unioned, revealedPolygons[i]) as RevealedArea;
          } catch (e) {
            console.error("Error unioning polygons:", e);
          }
        }
        setRevealedGeoJSON(unioned);
      }
    };

    setup();
  }, []);

  // Effect to process new locations and update the revealed area
  useEffect(() => {
    if (location && location.coords) {
      const newPoint: Feature<Point> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [location.coords.longitude, location.coords.latitude]
        }
      };

      // Create a buffer around the new point
      const newRevealedArea = buffer(newPoint, bufferDistance, { units: 'meters' }) as RevealedArea;

      // Union the new area with the existing revealed area
      let updatedRevealedArea: RevealedArea;
      if (revealedGeoJSON) {
        try {
            // @ts-ignore
          updatedRevealedArea = union(revealedGeoJSON, newRevealedArea) as RevealedArea;
        } catch (e) {
          console.error("Error unioning new area:", e);
          updatedRevealedArea = revealedGeoJSON; // fallback to old one
        }
      } else {
        updatedRevealedArea = newRevealedArea;
      }

      setRevealedGeoJSON(updatedRevealedArea);
      saveRevealedArea(newRevealedArea); // Persist only the new area
    }
  }, [location, revealedGeoJSON]); // Added revealedGeoJSON to dependency array

  // Create the fog overlay by creating a worldwide polygon and subtracting the revealed area
  const worldPolygon: Feature<Polygon> = {
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
  };

  const fogFeatures: Feature<Polygon | import('geojson').MultiPolygon>[] = [];
  if (revealedGeoJSON) {
    // @ts-ignore - Turf's difference function signature seems to be incorrectly typed here
    const fogPolygon = difference(worldPolygon, revealedGeoJSON);
    if (fogPolygon) {
      fogFeatures.push(fogPolygon);
    }
  } else {
    fogFeatures.push(worldPolygon);
  }

  const fogGeoJSON: FeatureCollection<Polygon | import('geojson').MultiPolygon> = {
    type: 'FeatureCollection',
    features: fogFeatures,
  };


  let statusText = 'Waiting for location...';
  if (errorMsg) {
    statusText = errorMsg;
  } else if (location) {
    statusText = `Lat: ${location.coords.latitude.toFixed(5)}, Lon: ${location.coords.longitude.toFixed(5)}`;
  }

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        ref={mapRef}
        styleURL={MapboxGL.StyleURL.Dark}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          zoomLevel={16}
          centerCoordinate={location ? [location.coords.longitude, location.coords.latitude] : [-122.4324, 37.78825]}
          animationMode={'flyTo'}
          animationDuration={2000}
          followUserLocation={true}
        />

        {/* Current location marker */}
        {location && (
          <MapboxGL.PointAnnotation
            id="currentLocation"
            coordinate={[location.coords.longitude, location.coords.latitude]}
          >
            <View style={[styles.locationDot, { transform: [{ rotate: `${location?.coords.heading || 0}deg` }] }]}>
              <View style={styles.locationDotCore} />
            </View>
          </MapboxGL.PointAnnotation>
        )}

        {/* Fog of war overlay */}
        <MapboxGL.ShapeSource id="fogSource" shape={fogGeoJSON}>
          <MapboxGL.FillLayer
            id="fogLayer"
            sourceID="fogSource"
            style={{
              fillColor: '#1E293B', // A dark, desaturated blue
              fillOpacity: 0.8,
            }}
          />
          <MapboxGL.LineLayer
            id="fogEdgeLayer"
            sourceID="fogSource"
            style={{
              lineColor: '#334155', // A slightly lighter blue for the edge
              lineWidth: 2,
              lineBlur: 5, // Soften the edge of the fog
            }}
          />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>
      {/* Show status text below the map */}
      <Text>{statusText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  locationDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationDotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: 'white',
  },
});

export default MapScreen;