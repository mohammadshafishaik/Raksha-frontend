// frontend/components/GlassCard.js
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

const GlassCard = ({ children, style }) => {
  return (
    <View style={[styles.glassCard, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  glassCard: {
    // Core Glassmorphism properties
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Semi-transparent white
    borderRadius: 15, // Rounded corners
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)', // Subtle border

    // Shadow for 3D floating effect (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 }, // X, Y offset
    shadowOpacity: 0.1, // Opacity of the shadow
    shadowRadius: 32, // Blur radius of the shadow

    // Elevation for Android shadow
    elevation: 8, // Android specific shadow property

    // Padding and margin for general layout
    padding: 20,
    marginVertical: 10,
    width: '100%', // Take full width
  },
});

export default GlassCard;
