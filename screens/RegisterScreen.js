// frontend/screens/RegisterScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Dimensions, TouchableOpacity } from 'react-native';
import Input from '../components/input';
import Button from '../components/Button';
import GlassCard from '../components/GlassCard'; // Import the new GlassCard component

const { width } = Dimensions.get('window'); // Get screen width for responsive sizing

const RegisterScreen = ({ navigation }) => {
  // State variables to hold user input
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false); // For showing loading state

  const handleRegister = async () => {
    if (!name || !email || !password || !phone) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true); // Start loading

    try {
      // IMPORTANT: Replace with your computer's actual local IP address if testing on a physical device.
      // Example: 'http://192.168.1.100:5000/api/users/register'
      const backendUrl = 'http://192.168.1.12:5000/api/users/register'; // Keep localhost for simulator, change for physical device

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, phone }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Registration successful! You can now log in.');
        // Navigate to Login screen after successful registration
        navigation.navigate('Login');
      } else {
        Alert.alert('Registration Failed', data.msg || 'Something went wrong.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Could not connect to the server. Please ensure your backend is running and the IP address is correct.');
    } finally {
      setLoading(false); // Stop loading
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.backgroundGradient}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>Create Account</Text>

          <Input
            label="Full Name"
            placeholder="Enter your full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry // Hides password characters
          />
          <Input
            label="Phone Number"
            placeholder="Enter your phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Button
            title={loading ? 'Registering...' : 'Register'}
            onPress={handleRegister}
            disabled={loading}
          />

          <View style={styles.loginTextContainer}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}> Login here</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    // Simulate background gradient with a solid color for simplicity in RN
    backgroundColor: '#f0f2f5', // Light background color
    paddingVertical: 40, // Add vertical padding to ensure card isn't too squished
  },
  card: {
    width: width * 0.9, // 90% of screen width
    maxWidth: 450, // Max width for larger screens
    padding: 30, // More padding inside the card
    alignItems: 'center',
  },
  title: {
    fontSize: 30, // Slightly smaller for mobile
    fontWeight: '700', // Bold (Montserrat effect)
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  loginTextContainer: {
    flexDirection: 'row',
    marginTop: 25, // More space
  },
  loginText: {
    fontSize: 15,
    color: '#555',
  },
  loginLink: {
    fontSize: 15,
    color: '#FF6347', // Match button color
    fontWeight: 'bold',
  },
});

export default RegisterScreen;
