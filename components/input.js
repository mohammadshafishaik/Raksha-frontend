// frontend/components/Input.js
import React from 'react';
import { TextInput, StyleSheet, View, Text } from 'react-native';

const Input = ({ label, ...props }) => {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        placeholderTextColor="#a0a0a0" // Lighter placeholder text
        {...props} // Pass all other props (like onChangeText, value, secureTextEntry)
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    width: '100%',
    marginBottom: 20, // More space
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8, // More space below label
    fontWeight: '600', // Semi-bold for labels (Montserrat effect)
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0', // Lighter border
    padding: 15, // More padding
    borderRadius: 10, // More rounded corners
    fontSize: 16,
    backgroundColor: '#fff', // White background for input field
    color: '#333',
    // Subtle shadow for input fields
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2, // Android shadow

    // Focus effect (handled by React Native's default TextInput focus state)
    // For custom focus, you'd use useState and conditional styling
  },
});

export default Input;
