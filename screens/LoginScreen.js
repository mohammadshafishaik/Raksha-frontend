// frontend/screens/LoginScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Dimensions, TouchableOpacity } from 'react-native';
import Input from '../components/input';
import Button from '../components/Button';
import GlassCard from '../components/GlassCard'; // Import the new GlassCard component

const { width } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      // IMPORTANT: Replace with your computer's actual local IP address if testing on a physical device.
      // Example: 'http://192.168.1.100:5000/api/users/login'
      const backendUrl = 'http://192.168.1.6:5000/api/users/login'; // Keep localhost for simulator, change for physical device

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Login successful! Token received.');
        console.log('Login Token:', data.token); // For now, just log the token
        // TODO: In a real app, you would save this token securely (e.g., using AsyncStorage)
        // For now, we'll pass it or rely on a global state later.
        // IMPORTANT: Pass the token to the Dashboard or store it globally for use in API calls
        navigation.navigate('Dashboard', { token: data.token }); // Pass token to dashboard
      } else {
        Alert.alert('Login Failed', data.msg || 'Invalid credentials or server error.');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Could not connect to the server. Please ensure your backend is running and the IP address is correct.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.backgroundGradient}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>Welcome Back!</Text>

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
            secureTextEntry
          />

          <Button
            title={loading ? 'Logging In...' : 'Login'}
            onPress={handleLogin}
            disabled={loading}
          />

          <View style={styles.registerTextContainer}>
            <Text style={styles.registerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}> Register here</Text>
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
    backgroundColor: '#f0f2f5', // Light background color
    paddingVertical: 40,
  },
  card: {
    width: width * 0.9,
    maxWidth: 450,
    padding: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  registerTextContainer: {
    flexDirection: 'row',
    marginTop: 25,
  },
  registerText: {
    fontSize: 15,
    color: '#555',
  },
  registerLink: {
    fontSize: 15,
    color: '#FF6347',
    fontWeight: 'bold',
  },
});

export default LoginScreen;