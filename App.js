// frontend/App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import the screens
import RegisterScreen from './screens/RegisterScreen';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashBoardScreen'; // NEW: Import DashboardScreen

const Stack = createNativeStackNavigator(); // Create a stack navigator

export default function App() {
  return (
    // NavigationContainer manages your navigation tree
    <NavigationContainer>
      {/* Stack.Navigator manages a stack of screens */}
      <Stack.Navigator initialRouteName="Register">
        {/* Define your screens */}
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }} // Hide header for cleaner look
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }} // Hide header
        />
        <Stack.Screen
          name="Dashboard" // NEW: Dashboard screen
          component={DashboardScreen}
          options={{ headerShown: false }} // Hide header
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
