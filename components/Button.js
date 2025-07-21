// frontend/components/Button.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const Button = ({ title, onPress, style, textStyle, disabled }) => {
  return (
    <TouchableOpacity
      style={[styles.button, style, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7} // Reduce opacity slightly on press
    >
      <Text style={[styles.buttonText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    // Gradient-like effect using a solid color for simplicity in RN
    backgroundColor: '#FF6347', // Primary accent color (Tomato)
    paddingVertical: 16, // More vertical padding
    paddingHorizontal: 25, // More horizontal padding
    borderRadius: 30, // More rounded, pill-shaped button
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20, // More space above
    width: '100%',
    // Shadow for premium feel
    shadowColor: '#FF6347', // Shadow matching button color
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10, // Android shadow
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold', // Montserrat-like bold
    textTransform: 'uppercase', // Uppercase text
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc', // Grey out when disabled
    shadowColor: 'transparent',
    elevation: 0,
  },
});

export default Button;