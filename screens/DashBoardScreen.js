import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Dimensions, TouchableOpacity, ActivityIndicator, ScrollView, Linking, Modal, TextInput, Platform } from 'react-native';
import Button from '../components/Button';
import GlassCard from '../components/GlassCard';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import MapView, { Marker, UrlTile, Polygon } from 'react-native-maps';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { fetchNearbyPlaces } from '../utils/osmPlaces';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av'; // NOTE: expo-av is deprecated in SDK 54+. Consider migrating to expo-audio and expo-video when upgrading SDK.
import { Accelerometer } from 'expo-sensors';


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

  // --- AUDIO RECORDING STATE ---
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordedUri, setRecordedUri] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef(null);
  // --- END AUDIO RECORDING STATE ---

  // --- FAKE CALL STATE ---
  const [isFakeCallModalVisible, setIsFakeCallModalVisible] = useState(false); // Corrected variable name
  const [fakeCallerName, setFakeCallerName] = useState('Mom');
  const [fakeCallerNumber, setFakeCallerNumber] = useState('9133220649');
  const [fakeCallDelay, setFakeCallDelay] = useState('5'); // in seconds, default to 10
  const fakeCallTimeoutRef = useRef(null); // To store the setTimeout ID
  const [fakeCallScheduled, setFakeCallScheduled] = useState(false); // To indicate if a call is scheduled
  const [fakeCallCountdown, setFakeCallCountdown] = useState(0); // For displaying countdown
  const countdownIntervalRef = useRef(null); // For countdown interval
  const ringtoneSoundObject = useRef(new Audio.Sound()); // For managing ringtone playback
  // --- END FAKE CALL STATE ---

  // *** SHAKE DETECTION STATE ***
  const [accelerometerSubscription, setAccelerometerSubscription] = useState(null);
  const SHAKE_THRESHOLD = 2.0; // Adjust this value based on testing (lower is more sensitive)
  const SHAKE_COOLDOWN = 3000; // Milliseconds to wait before allowing another SOS after a shake
  const lastShakeTime = useRef(0);
  // *** END SHAKE DETECTION STATE ***

  const backendBaseUrl = 'http://192.168.1.6:5000'; // <--- VERIFY/REPLACE THIS WITH YOUR CURRENT IP

  const mapRef = useRef(null);

  // Effect to handle token updates from navigation
  useEffect(() => {
    if (route.params?.token && route.params.token !== authToken) {
      setAuthToken(route.params.token);
      console.log('Dashboard received new token:', route.params.token.substring(0, 20) + '...');
    }
  }, [route.params?.token]);

  // Main Effect for initial setup, permissions, and all sensor subscriptions
  useEffect(() => {
    (async () => {
      // Location permissions
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

    // Start accelerometer listening
    subscribeToAccelerometer();

    // Load ringtone for fake call
    loadRingtone();

    // --- Cleanup for all effects on unmount ---
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (fakeCallTimeoutRef.current) {
        clearTimeout(fakeCallTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (ringtoneSoundObject.current) {
        ringtoneSoundObject.current.unloadAsync();
      }
      unsubscribeFromAccelerometer(); // Clean up accelerometer subscription
    };
  }, []); // Empty dependency array means this runs once on mount and once on unmount

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

  // *** AUDIO RECORDING FUNCTIONS ***
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required!', 'Please grant microphone access to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setRecordedUri(null); // Clear previous recording URI
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prevDuration => prevDuration + 1);
      }, 1000);

      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Recording Error', 'Failed to start audio recording.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      console.warn('No recording in progress to stop.');
      return;
    }

    console.log('Stopping recording...');
    setIsRecording(false);
    clearInterval(recordingIntervalRef.current); // Stop duration updates
    recordingIntervalRef.current = null; // Clear the ref
    setRecordingDuration(0); // Reset duration display

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri); // Save the URI
      setRecording(null); // Clear the recording object
      console.log('Recording stopped and stored at', uri);
      Alert.alert('Recording Saved', `Audio saved to: ${uri}\n\n(In a real app, this would be uploaded to your server)`);
      // TODO: Implement logic here to upload `uri` to your backend
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Recording Error', 'Failed to stop audio recording.');
    }
  };
  // *** END AUDIO RECORDING FUNCTIONS ***

  // *** FAKE CALL FUNCTIONS ***
  const loadRingtone = async () => {
    try {
      // YOU NEED TO ADD YOUR OWN RINGTONE.MP3 FILE IN frontend/assets/
      await ringtoneSoundObject.current.loadAsync(require('../assets/ringtone.mp3'));
      ringtoneSoundObject.current.setIsLoopingAsync(true); // Loop the ringtone
    } catch (error) {
      console.error('Failed to load ringtone sound', error);
      // Removed alert here to prevent multiple alerts on load if ringtone is missing.
      // An alert is already shown on initial load in the main useEffect.
    }
  };

  const scheduleFakeCall = () => {
    const delay = parseInt(fakeCallDelay, 10);
    if (isNaN(delay) || delay <= 0) {
      Alert.alert('Error', 'Please enter a valid delay (e.g., 10 for 10 seconds).');
      return;
    }

    Alert.alert('Fake Call Scheduled!', `A fake call from ${fakeCallerName} will ring in ${delay} seconds.`);
    setFakeCallScheduled(true);
    setFakeCallCountdown(delay);

    // Start countdown
    countdownIntervalRef.current = setInterval(() => {
      setFakeCallCountdown(prevCount => {
        if (prevCount <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);

    // Schedule the actual call
    fakeCallTimeoutRef.current = setTimeout(async () => {
      setIsFakeCallModalVisible(true); // Corrected variable name
      setFakeCallScheduled(false); // Reset scheduled state
      try {
        await ringtoneSoundObject.current.replayAsync(); // Start playing ringtone
      } catch (error) {
        console.error('Failed to play ringtone:', error);
      }
    }, delay * 1000); // Convert seconds to milliseconds
  };

  const cancelFakeCall = () => {
    if (fakeCallTimeoutRef.current) {
      clearTimeout(fakeCallTimeoutRef.current);
      fakeCallTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setFakeCallScheduled(false);
    setFakeCallCountdown(0);
    Alert.alert('Fake Call Cancelled', 'The scheduled fake call has been cancelled.');
  };

  const handleEndFakeCall = async () => {
    setIsFakeCallModalVisible(false); // Corrected variable name
    try {
      if (ringtoneSoundObject.current) {
        await ringtoneSoundObject.current.stopAsync(); // Stop ringtone
        await ringtoneSoundObject.current.setPositionAsync(0); // Reset ringtone to start
      }
    } catch (error) {
      console.error('Error stopping ringtone:', error);
    }
  };
  // *** END FAKE CALL FUNCTIONS ***

  // *** NEW SHAKE DETECTION FUNCTIONS ***
  const subscribeToAccelerometer = () => {
    // Set update interval for accelerometer (e.g., 100ms for faster detection)
    Accelerometer.setUpdateInterval(100);

    setAccelerometerSubscription(
      Accelerometer.addListener(accelerometerData => {
        const { x, y, z } = accelerometerData;

        // Calculate overall acceleration magnitude
        const accelerationMagnitude = Math.sqrt(x * x + y * y + z * z);

        // Check if acceleration exceeds threshold and cooldown is over
        if (
          accelerationMagnitude > SHAKE_THRESHOLD &&
          (Date.now() - lastShakeTime.current > SHAKE_COOLDOWN)
        ) {
          lastShakeTime.current = Date.now();
          console.log('SHAKE DETECTED! Accelerometer magnitude:', accelerationMagnitude);
          Alert.alert('Shake Detected', 'Initiating SOS...');
          handleSOS(); // Trigger your existing SOS function
          // Optionally, unsubscribe temporarily after SOS to prevent multiple triggers
          // unsubscribeFromAccelerometer(); // Uncomment if you want to temporarily disable after one shake
        }
      })
    );
  };

  const unsubscribeFromAccelerometer = () => {
    if (accelerometerSubscription) {
      accelerometerSubscription.remove();
      setAccelerometerSubscription(null);
      console.log('Accelerometer monitoring stopped.');
    }
  };
  // *** END NEW SHAKE DETECTION FUNCTIONS ***


  // *** PUSH NOTIFICATION SETUP FUNCTION ***
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

  // *** Effect to trigger push notification setup on auth token change ***
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
              title="Quick Police Call📱"
              onPress={handlePoliceCall}
              style={styles.policeCallButton}
              textStyle={styles.policeCallButtonText}
            />

            {/* AUDIO RECORDING BUTTON */}
            <Button
              title={isRecording ? `Stop Recording (${recordingDuration}s)` : 'Start Audio Record 🎤'}
              onPress={isRecording ? stopRecording : startRecording}
              style={[styles.audioRecordButton, isRecording ? styles.recordingActive : {}]}
              textStyle={styles.audioRecordButtonText}
            />
            {recordedUri && !isRecording && (
              <Text style={styles.lastRecordingText}>Last Recording Saved!</Text>
            )}

            <Button
              title={sosLoading ? 'Sending SOS...' : 'SOS Panic Button'}
              onPress={handleSOS}
              disabled={sosLoading}
              style={styles.sosButton}
              textStyle={styles.sosButtonText}
            />

            {/* FAKE CALL SETUP SECTION */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fake Call Setup</Text>
              <TextInput
                style={styles.input}
                placeholder="Caller Name (e.g., Mom, Boss)"
                placeholderTextColor="#888"
                value={fakeCallerName}
                onChangeText={setFakeCallerName}
              />
              <TextInput
                style={styles.input}
                placeholder="Caller Number (e.g., +1234567890)"
                placeholderTextColor="#888"
                value={fakeCallerNumber}
                onChangeText={setFakeCallerNumber}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Delay in Seconds (e.g., 10, 30, 60)"
                placeholderTextColor="#888"
                value={fakeCallDelay}
                onChangeText={setFakeCallDelay}
                keyboardType="numeric"
              />

              {fakeCallScheduled ? (
                <>
                  <Text style={styles.scheduledText}>
                    Call scheduled in {fakeCallCountdown} seconds...
                  </Text>
                  <Button
                    title="Cancel Fake Call"
                    onPress={cancelFakeCall}
                    style={styles.cancelFakeCallButton}
                    textStyle={styles.cancelFakeCallButtonText}
                  />
                </>
              ) : (
                <Button
                  title="Schedule Fake Call 📞"
                  onPress={scheduleFakeCall}
                  style={styles.scheduleFakeCallButton}
                />
              )}
            </View>

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

      {/* FAKE CALL INCOMING MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isFakeCallModalVisible} // Corrected variable name
        onRequestClose={handleEndFakeCall} // Allows back button to dismiss (Android)
      >
        <View style={styles.fakeCallCenteredView}>
          <View style={styles.fakeCallScreen}>
            <Text style={styles.fakeCallStatus}>Incoming Call</Text>
            <Ionicons name="call" size={80} color="green" style={styles.callIcon} />
            <Text style={styles.fakeCallerName}>{fakeCallerName}</Text>
            <Text style={styles.fakeCallerNumber}>{fakeCallerNumber}</Text>

            <View style={styles.fakeCallActions}>
              <TouchableOpacity onPress={handleEndFakeCall} style={[styles.fakeCallActionButton, styles.declineButton]}>
                <Ionicons name="call" size={30} color="white" />
                <Text style={styles.fakeCallActionText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEndFakeCall} style={[styles.fakeCallActionButton, styles.acceptButton]}>
                <Ionicons name="call" size={30} color="white" />
                <Text style={styles.fakeCallActionText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    marginBottom: 30, // Adjusted to make space for the recording button
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
  // --- AUDIO RECORDING BUTTON STYLES ---
  audioRecordButton: {
    backgroundColor: '#FFD700', // Gold color
    shadowColor: '#FFD700',
    marginTop: 10,
    marginBottom: 10, // Added margin for spacing
  },
  audioRecordButtonText: {
    fontSize: 18,
    color: '#333', // Darker text for better contrast
  },
  recordingActive: {
    backgroundColor: '#DC143C', // Red when recording
    shadowColor: '#DC143C',
  },
  lastRecordingText: {
    fontSize: 12,
    color: '#777',
    marginBottom: 5,
    textAlign: 'center',
  },
  // --- END AUDIO RECORDING BUTTON STYLES ---

  // --- FAKE CALL SETUP STYLES ---
  input: {
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
  scheduleFakeCallButton: {
    backgroundColor: '#28a745', // Green
    shadowColor: '#28a745',
    marginTop: 10,
  },
  cancelFakeCallButton: {
    backgroundColor: '#ffc107', // Yellow
    shadowColor: '#ffc107',
    marginTop: 10,
  },
  cancelFakeCallButtonText: {
    color: '#333',
  },
  scheduledText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 10,
  },
  // --- END FAKE CALL SETUP STYLES ---

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
  // --- FAKE CALL MODAL STYLES ---
  fakeCallCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)', // Dark overlay
  },
  fakeCallScreen: {
    width: '90%',
    height: '70%', // Take up most of the screen
    backgroundColor: '#333', // Dark background for call screen
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'space-around', // Distribute content evenly
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  fakeCallStatus: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  callIcon: {
    marginTop: 20,
    marginBottom: 20,
  },
  fakeCallerName: {
    fontSize: 36,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  fakeCallerNumber: {
    fontSize: 22,
    color: '#ccc',
    marginBottom: 40,
  },
  fakeCallActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  fakeCallActionButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  declineButton: {
    backgroundColor: '#dc3545', // Red
  },
  acceptButton: {
    backgroundColor: '#28a745', // Green
  },
  fakeCallActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  // --- END FAKE CALL MODAL STYLES ---
});

export default DashboardScreen;