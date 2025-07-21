// frontend/screens/DashboardScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Dimensions, TouchableOpacity, ActivityIndicator, ScrollView, Linking, Modal, TextInput, Platform } from 'react-native'; // *** MODIFIED: Added Platform ***
import Button from '../components/Button';
import GlassCard from '../components/GlassCard';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import MapView, { Marker, UrlTile, Polygon } from 'react-native-maps';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { fetchNearbyPlaces } from '../utils/osmPlaces';
import * as Notifications from 'expo-notifications'; // *** NEW IMPORT ***

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// Define a background task for location updates
const LOCATION_TRACKING_TASK = 'location-tracking-task';

TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const latestLocation = locations[0];
    console.log('Background location update:', latestLocation);
    // In a real app, you would send this to your backend
    // For now, we'll handle foreground updates
  }
});

const DashboardScreen = ({ navigation, route }) => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [isContactsLoading, setIsContactsLoading] = useState(false);

  const [authToken, setAuthToken] = useState(route.params?.token || null);

  const [policeStations, setPoliceStations] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [fireStations, setFireStations] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [cafes, setCafes] = useState([]);
  const [parks, setParks] = useState([]);
  const [dangerZones, setDangerZones] = useState([]);
  const [isInDangerZone, setIsInDangerZone] = useState(false);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);

  const [isContactModalVisible, setIsContactModalVisible] = useState(false);
  const [currentContact, setCurrentContact] = useState(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactFormLoading, setContactFormLoading] = useState(false);


  const backendBaseUrl = 'https://raksha-backend-und2.onrender.com'; // <--- VERIFY/REPLACE THIS WITH YOUR CURRENT IP

  const mapRef = useRef(null);

  // Effect to handle token updates from navigation
  useEffect(() => {
    if (route.params?.token && route.params.token !== authToken) {
      setAuthToken(route.params.token);
      console.log('Dashboard received new token:', route.params.token.substring(0, 20) + '...');
    }
  }, [route.params?.token]);

  // Effect for initial setup and location permissions
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        Alert.alert('Location Permission Required', 'Please grant location access to use safety features.');
        return;
      }

      let { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        Alert.alert('Background Location Permission', 'Background location is recommended for continuous tracking even when the app is closed.');
      }

      startForegroundLocationUpdates();
    })();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  // Effect to fetch trusted contacts, nearby places, and danger zones when authToken or location is available/changes
  useEffect(() => {
    if (authToken) {
      fetchTrustedContacts();
    }

    const loadNearbyData = async () => {
      if (location && authToken) {
        setIsPlacesLoading(true);
        try {
          const lat = location.coords.latitude;
          const lng = location.coords.longitude;

          const police = await fetchNearbyPlaces(lat, lng, 'police');
          setPoliceStations(police);
          console.log('Fetched Police Stations:', police.length);

          const hospital = await fetchNearbyPlaces(lat, lng, 'hospital');
          setHospitals(hospital);
          console.log('Fetched Hospitals:', hospital.length);

          const fire = await fetchNearbyPlaces(lat, lng, 'fire_station');
          setFireStations(fire);
          console.log('Fetched Fire Stations:', fire.length);

          const pharmacy = await fetchNearbyPlaces(lat, lng, 'pharmacy');
          setPharmacies(pharmacy);
          console.log('Fetched Pharmacies:', pharmacy.length);

          const restaurant = await fetchNearbyPlaces(lat, lng, 'restaurant');
          setRestaurants(restaurant);
          console.log('Fetched Restaurants:', restaurant.length);

          const cafe = await fetchNearbyPlaces(lat, lng, 'cafe');
          setCafes(cafe);
          console.log('Fetched Cafes:', cafe.length);

          const park = await fetchNearbyPlaces(lat, lng, 'park');
          setParks(park);
          console.log('Fetched Parks:', park.length);

          const dangerZonesResponse = await fetch(`${backendBaseUrl}/api/dangerzones`, {
            method: 'GET',
            headers: { 'x-auth-token': authToken },
          });
          const dangerZonesData = await dangerZonesResponse.json();
          if (dangerZonesResponse.ok) {
            setDangerZones(dangerZonesData);
            console.log('Fetched Danger Zones:', dangerZonesData.length);
          } else {
            console.error('Failed to fetch danger zones:', dangerZonesData.msg);
          }

        } catch (error) {
          console.error('Error loading nearby data:', error);
        } finally {
          setIsPlacesLoading(false);
        }
      }
    };

    loadNearbyData();
  }, [location, authToken]);

  useEffect(() => {
    if (location && dangerZones.length > 0) {
      const userLat = location.coords.latitude;
      const userLng = location.coords.longitude;

      let userInDanger = false;
      for (const zone of dangerZones) {
        if (isPointInPolygon([userLat, userLng], zone.coordinates)) {
          userInDanger = true;
          break;
        }
      }
      setIsInDangerZone(userInDanger);
      if (userInDanger) {
        Alert.alert('WARNING!', 'You are currently in a potentially unsafe area. Please be vigilant and consider finding a safer route.', [{ text: 'OK' }]);
      }
    }
  }, [location, dangerZones]);

  const isPointInPolygon = (point, polygon) => {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const locationSubscription = useRef(null);

  const startForegroundLocationUpdates = async () => {
    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (newLocation) => {
          setLocation(newLocation);
          console.log('Foreground location:', newLocation.coords);
          sendLocationToBackend(newLocation.coords.latitude, newLocation.coords.longitude);
        }
      );
      setIsTracking(true);
    } catch (error) {
      console.error("Error starting foreground location updates:", error);
      setErrorMsg("Could not start location tracking.");
    }
  };

  const stopForegroundLocationUpdates = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
      setIsTracking(false);
      console.log('Foreground location tracking stopped.');
    }
  };

  const sendLocationToBackend = async (latitude, longitude) => {
    if (!authToken) {
      console.warn('No authentication token available. Cannot send location.');
      return;
    }
    console.log('Sending location with token (first 10 chars):', authToken.substring(0, 10) + '...');
    try {
      const response = await fetch(`${backendBaseUrl}/api/safety/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
        body: JSON.stringify({ latitude, longitude }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('Failed to update location on backend:', data.msg);
      } else {
        console.log('Location sent to backend:', data.location);
      }
    } catch (error) {
      console.error('Error sending location to backend:', error);
    }
  };

  const handleSOS = async () => {
    setSosLoading(true);
    if (!authToken) {
      Alert.alert('Error', 'You must be logged in to send an SOS alert.');
      setSosLoading(false);
      return;
    }
    // Ensure contacts are fetched before sending SOS for accurate simulation
    await fetchTrustedContacts(); // Refresh contacts before sending SOS

    try {
      const response = await fetch(`${backendBaseUrl}/api/safety/sos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('SOS Sent!', 'Your trusted contacts have been notified (simulated).');
      } else {
        Alert.alert('SOS Failed', data.msg || 'Could not send SOS alert.');
      }
    } catch (error) {
      console.error('SOS error:', error);
      Alert.alert('Error', 'Could not connect to the server for SOS. Please try again later.');
    } finally {
      setSosLoading(false);
    }
  };

  const fetchTrustedContacts = async () => {
    if (!authToken) {
      console.warn('No authentication token available. Cannot fetch contacts.');
      return;
    }
    setIsContactsLoading(true);
    console.log('Fetching contacts with token (first 10 chars):', authToken.substring(0, 10) + '...');
    try {
      const response = await fetch(`${backendBaseUrl}/api/safety/trusted-contacts`, {
        method: 'GET',
        headers: { 'x-auth-token': authToken },
      });
      const data = await response.json();
      if (response.ok) {
        setTrustedContacts(data);
      } else {
        console.error('Failed to fetch contacts:', data.msg);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsContactsLoading(false);
    }
  };

  const openAddContactModal = () => {
    setCurrentContact(null); // Clear for new contact
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setIsContactModalVisible(true);
  };

  const openEditContactModal = (contact) => {
    setCurrentContact(contact); // Set contact for editing
    setContactName(contact.name);
    setContactPhone(contact.phone);
    setContactEmail(contact.email);
    setIsContactModalVisible(true);
  };

  const handleSaveContact = async () => {
    if (!contactName || (!contactPhone && !contactEmail)) {
      Alert.alert('Error', 'Name and at least one of Phone or Email are required.');
      return;
    }
    setContactFormLoading(true);
    try {
      let response;
      const contactData = { name: contactName, phone: contactPhone, email: contactEmail };

      if (currentContact) {
        // Update existing contact
        response = await fetch(`${backendBaseUrl}/api/safety/trusted-contacts/${currentContact._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': authToken,
          },
          body: JSON.stringify(contactData),
        });
      } else {
        // Add new contact
        response = await fetch(`${backendBaseUrl}/api/safety/trusted-contacts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': authToken,
          },
          body: JSON.stringify(contactData),
        });
      }

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', `Contact ${currentContact ? 'updated' : 'added'}!`);
        setIsContactModalVisible(false);
        fetchTrustedContacts(); // Refresh list
      } else {
        Alert.alert('Error', data.msg || `Failed to ${currentContact ? 'update' : 'add'} contact.`);
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      Alert.alert('Error', 'Could not connect to server to save contact.');
    } finally {
      setContactFormLoading(false);
    }
  };

  const handleDeleteContact = (contactId) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!authToken) return;
            try {
              const response = await fetch(`${backendBaseUrl}/api/safety/trusted-contacts/${contactId}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': authToken },
              });
              const data = await response.json();
              if (response.ok) {
                Alert.alert('Success', 'Contact deleted!');
                fetchTrustedContacts(); // Refresh list
              } else {
                Alert.alert('Error', data.msg || 'Failed to delete contact.');
              }
            } catch (error) {
              console.error('Error deleting contact:', error);
              Alert.alert('Error', 'Could not connect to server to delete contact.');
            }
          },
        },
      ]
    );
  };


  // Function to handle police call
  const handlePoliceCall = () => {
    // Replace '100' with your country's emergency police number if different
    const phoneNumber = 'tel:100';
    Linking.canOpenURL(phoneNumber)
      .then((supported) => {
        if (!supported) {
          Alert.alert('Error', 'Phone call not supported on this device or emulator.');
        } else {
          Linking.openURL(phoneNumber);
        }
      })
      .catch((err) => console.error('An error occurred', err));
  };

  // *** NEW: Push Notification Setup Function ***
  const registerForPushNotificationsAsync = async (token) => {
    let pushToken;
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Push Notification Permission', 'Failed to get push token for push notification! Please enable notifications in your device settings.');
      return;
    }
    pushToken = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', pushToken);

    // Send this token to your backend
    if (pushToken && token) {
      try {
        const response = await fetch(`${backendBaseUrl}/api/notifications/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token, // Use the auth token to link push token to user
          },
          body: JSON.stringify({ token: pushToken }),
        });
        const data = await response.json();
        if (response.ok) {
          console.log('Push token sent to backend successfully.');
        } else {
          console.error('Failed to send push token to backend:', data.msg);
        }
      } catch (error) {
        console.error('Error sending push token to backend:', error);
      }
    }
  };

  // *** NEW: Effect to trigger push notification setup on auth token change ***
  useEffect(() => {
    if (authToken) {
      registerForPushNotificationsAsync(authToken);

      // Optional: Handle incoming notifications when the app is in foreground
      const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received in foreground:', notification);
        Alert.alert(
          notification.request.content.title,
          notification.request.content.body,
          [{ text: 'OK' }]
        );
      });

      // Optional: Handle user interacting with a notification
      const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response received:', response);
        // You could navigate to a specific screen based on notification data
        // For example: if (response.notification.request.content.data.type === 'SOS') { navigate to map with user location }
      });

      return () => {
        Notifications.removeNotificationSubscription(notificationListener);
        Notifications.removeNotificationSubscription(responseListener);
      };
    }
  }, [authToken]); // Re-run when authToken changes


  let text = 'Waiting for location...';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = `Latitude: ${location.coords.latitude}\nLongitude: ${location.coords.longitude}`;
  }

  return (
    <View style={styles.fullScreenContainer}>
      <ScrollView contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.backgroundGradient}>
          <GlassCard style={styles.card}>
            {/* NEW: Your safety is our priority quote */}
            <Text style={styles.priorityQuote}>Your Safety, Our Priority.</Text>
            <Text style={styles.realTimeProtection}>Real-Time Protection.</Text>

            <Text style={styles.title}>Safety Dashboard</Text>

            {isInDangerZone && (
              <View style={styles.dangerAlertContainer}>
                <MaterialIcons name="warning" size={24} color="white" />
                <Text style={styles.dangerAlertText}>WARNING: You are in a danger zone!</Text>
              </View>
            )}

            <Text style={styles.locationText}>{text}</Text>

            {isPlacesLoading && <ActivityIndicator size="large" color="#FF6347" style={{ marginBottom: 10 }} />}

            {location && (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  latitudeDelta: LATITUDE_DELTA,
                  longitudeDelta: LONGITUDE_DELTA,
                }}
                onMapReady={() => {
                  mapRef.current.animateToRegion({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: LATITUDE_DELTA,
                    longitudeDelta: LONGITUDE_DELTA,
                  }, 1000);
                }}
              >
                <UrlTile
                  urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maximumZ={19}
                  flipY={false}
                />

                <Marker
                  coordinate={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  }}
                  title="Your Location"
                  description="This is your current position"
                  pinColor="blue"
                />

                {policeStations.map((place) => (
                  <Marker
                    key={place.place_id}
                    coordinate={{ latitude: place.geometry.location.lat, longitude: place.geometry.location.lng }}
                    title={place.name}
                    description={place.vicinity}
                    pinColor="#007bff"
                  />
                ))}

                {hospitals.map((place) => (
                  <Marker
                    key={place.place_id}
                    coordinate={{ latitude: place.geometry.location.lat, longitude: place.geometry.location.lng }}
                    title={place.name}
                    description={place.vicinity}
                    pinColor="#dc3545"
                  />
                ))}

                {fireStations.map((place) => (
                  <Marker
                    key={place.place_id}
                    coordinate={{ latitude: place.geometry.location.lat, longitude: place.geometry.location.lng }}
                    title={place.name}
                    description={place.vicinity}
                    pinColor="#FFA500"
                  />
                ))}

                {pharmacies.map((place) => (
                  <Marker
                    key={place.place_id}
                    coordinate={{ latitude: place.geometry.location.lat, longitude: place.geometry.location.lng }}
                    title={place.name}
                    description={place.vicinity}
                    pinColor="#32CD32"
                  />
                ))}

                {restaurants.map((place) => (
                  <Marker
                    key={place.place_id}
                    coordinate={{ latitude: place.geometry.location.lat, longitude: place.geometry.location.lng }}
                    title={place.name}
                    description={place.vicinity}
                    pinColor="#8B4513"
                  />
                ))}

                {cafes.map((place) => (
                  <Marker
                    key={place.place_id}
                    coordinate={{ latitude: place.geometry.location.lat, longitude: place.geometry.location.lng }}
                    title={place.name}
                    description={place.vicinity}
                    pinColor="#D2B48C"
                  />
                ))}

                {parks.map((place) => (
                  <Marker
                    key={place.place_id}
                    coordinate={{ latitude: place.geometry.location.lat, longitude: place.geometry.location.lng }}
                    title={place.name}
                    description={place.vicinity}
                    pinColor="#228B22"
                  />
                ))}

                {dangerZones.map((zone) => (
                  <Polygon
                    key={zone._id}
                    coordinates={zone.coordinates.map(coord => ({ latitude: coord[0], longitude: coord[1] }))}
                    strokeColor={zone.severity === 'high' ? "#FF0000" : (zone.severity === 'medium' ? "#FFA500" : "#FFFF00")}
                    fillColor={zone.severity === 'high' ? "rgba(255,0,0,0.3)" : (zone.severity === 'medium' ? "rgba(255,165,0,0.3)" : "rgba(255,255,0,0.3)")}
                    strokeWidth={2}
                  />
                ))}
              </MapView>
            )}

            <Button
              title="Quick Police Call"
              onPress={handlePoliceCall}
              style={styles.policeCallButton}
              textStyle={styles.policeCallButtonText}
            />

            <Button
              title={sosLoading ? 'Sending SOS...' : 'SOS Panic Button'}
              onPress={handleSOS}
              disabled={sosLoading}
              style={styles.sosButton}
              textStyle={styles.sosButtonText}
            />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trusted Contacts</Text>
              <Button title="Add New Contact" onPress={openAddContactModal} style={styles.addContactButton} />
              {isContactsLoading ? (
                <ActivityIndicator size="small" color="#FF6347" />
              ) : trustedContacts.length > 0 ? (
                <View style={styles.contactList}>
                  {trustedContacts.map((contact) => (
                    <View key={contact._id} style={styles.contactItem}>
                      <View>
                        <Text style={styles.contactName}>{contact.name}</Text>
                        {contact.phone && <Text style={styles.contactDetail}>Phone: {contact.phone}</Text>}
                        {contact.email && <Text style={styles.contactDetail}>Email: {contact.email}</Text>}
                      </View>
                      <View style={styles.contactActions}>
                        <TouchableOpacity onPress={() => openEditContactModal(contact)} style={styles.actionButton}>
                          <MaterialIcons name="edit" size={20} color="#4682B4" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteContact(contact._id)} style={styles.actionButton}>
                          <MaterialIcons name="delete" size={20} color="#DC143C" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noContactsText}>No trusted contacts added yet.</Text>
              )}
            </View>

            <TouchableOpacity onPress={() => { Alert.alert('Logout', 'Logging out...'); navigation.navigate('Login'); }} style={styles.logoutButton}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>

          </GlassCard>
        </View>
      </ScrollView>

      {/* Contact Add/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isContactModalVisible}
        onRequestClose={() => setIsContactModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <GlassCard style={styles.modalView}>
            <Text style={styles.modalTitle}>{currentContact ? 'Edit Contact' : 'Add New Contact'}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Contact Name"
              value={contactName}
              onChangeText={setContactName}
              placeholderTextColor="#888"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Phone Number (Optional)"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#888"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Email (Optional)"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#888"
            />

            <Button
              title={contactFormLoading ? 'Saving...' : 'Save Contact'}
              onPress={handleSaveContact}
              disabled={contactFormLoading}
              style={styles.modalSaveButton}
            />
            <Button
              title="Cancel"
              onPress={() => setIsContactModalVisible(false)}
              style={styles.modalCancelButton}
              textStyle={styles.modalCancelButtonText}
            />
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  backgroundGradient: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  card: {
    width: width * 0.9,
    maxWidth: 500,
    padding: 30,
    alignItems: 'center',
  },
  priorityQuote: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
    fontFamily: 'System',
  },
  realTimeProtection: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF6347',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'System',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  locationText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 15,
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  sosButton: {
    backgroundColor: '#DC143C',
    shadowColor: '#DC143C',
    marginTop: 20,
    marginBottom: 30,
  },
  sosButtonText: {
    fontSize: 20,
  },
  policeCallButton: {
    backgroundColor: '#4682B4',
    shadowColor: '#4682B4',
    marginTop: 10,
    marginBottom: 10,
  },
  policeCallButtonText: {
    fontSize: 18,
  },
  section: {
    width: '100%',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  addContactButton: {
    backgroundColor: '#1E90FF',
    shadowColor: '#1E90FF',
    marginBottom: 15,
  },
  contactList: {
    width: '100%',
  },
  contactItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  contactDetail: {
    fontSize: 14,
    color: '#666',
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: 10,
    padding: 5,
  },
  noContactsText: {
    fontSize: 15,
    color: '#777',
    textAlign: 'center',
    marginTop: 10,
  },
  logoutButton: {
    marginTop: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF6347',
    backgroundColor: 'transparent',
  },
  logoutButtonText: {
    color: '#FF6347',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerAlertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC143C',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  dangerAlertText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  contactList: {
    width: '100%',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  modalInput: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    width: '100%',
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  modalSaveButton: {
    backgroundColor: '#32CD32',
    shadowColor: '#32CD32',
    marginTop: 10,
  },
  modalCancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF6347',
    marginTop: 10,
  },
  modalCancelButtonText: {
    color: '#FF6347',
  },
});

export default DashboardScreen;
