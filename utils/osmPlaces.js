// frontend/utils/osmPlaces.js

// Nominatim API base URL for searching OpenStreetMap data
const NOMINATIM_API_BASE_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Fetches nearby places of a specific type (e.g., 'police', 'hospital') using Nominatim.
 * Nominatim uses different keywords than Google Places.
 * @param {number} latitude - Current latitude.
 * @param {number} longitude - Current longitude.
 * @param {string} query - Keyword to search for (e.g., 'police', 'hospital').
 * @param {number} radius - Search radius in meters (Nominatim uses bounding box, so this is approximate).
 * @returns {Array} - Array of place objects from Nominatim.
 */
export const fetchNearbyPlaces = async (latitude, longitude, query, radius = 5000) => {
  try {
    // Nominatim uses 'viewbox' for approximate radius and 'bounded' to restrict results
    // For a radius, we can calculate a bounding box. A simple approximation:
    const latDelta = radius / 111111; // Approx meters per degree latitude
    const lonDelta = radius / (111111 * Math.cos(latitude * Math.PI / 180)); // Approx meters per degree longitude

    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLon = longitude - lonDelta;
    const maxLon = longitude + lonDelta;

    const url = `${NOMINATIM_API_BASE_URL}?q=${query}&format=json&limit=10&addressdetails=1&extratags=1&bounded=1&viewbox=${minLon},${minLat},${maxLon},${maxLat}`;
    console.log('Fetching nearby places from Nominatim URL:', url); // For debugging

    const response = await fetch(url, {
      headers: {
        // Nominatim requests should include a User-Agent header
        // Replace 'your_email@example.com' with your actual email for good practice
        'User-Agent': 'RakshaSafetyApp/1.0 (your_email@example.com)'
      }
    });
    const data = await response.json();

    // Nominatim returns an array of objects directly
    // We map them to a format similar to Google Places for consistency
    return data.map(item => ({
      place_id: item.place_id,
      name: item.display_name.split(',')[0] || item.name, // Get primary name
      vicinity: item.address ? Object.values(item.address).join(', ') : item.display_name, // More detailed address
      geometry: {
        location: {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }
      },
      type: item.type // e.g., 'police', 'hospital'
    }));

  } catch (error) {
    console.error(`Error fetching nearby ${query}s from Nominatim:`, error);
    return [];
  }
};