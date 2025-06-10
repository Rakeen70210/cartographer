import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

const MapScreen = () => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const requestLocationPermission = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    };

    requestLocationPermission();
  }, []);

  let text = 'Waiting...';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = JSON.stringify(location); // Or display location data in a more user-friendly way
  }

  return (
    <View style={styles.container}>
      <Text>{text}</Text>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 37.78825, // Example latitude (San Francisco)
          longitude: -122.4324, // Example longitude (San Francisco)
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Polyline
          coordinates={[
            { latitude: 37.78825, longitude: -122.4324 },
            { latitude: 37.7756, longitude: -122.452 },
            { latitude: 37.7956, longitude: -122.462 },
          ]}
          strokeColor="#FF0000" // Red
          strokeWidth={2}
        />
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MapScreen;