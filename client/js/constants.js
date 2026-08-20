// ============================================================
// constants.js - All magic numbers in one place
// ============================================================
// Why? The original script.js had numbers like 6371, 2000,
// [37.5, -96] scattered everywhere with no explanation.
// Centralizing them with descriptive names makes the code
// readable and easy to update.
// ============================================================

export const EARTH_RADIUS_KM = 6371;           // Used in Haversine formula
export const ALERT_RADIUS_KM = 2000;           // Alert detection range
export const MAP_DEFAULT_CENTER = [37.5, -96]; // Center of USA
export const MAP_DEFAULT_ZOOM = 4;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Coordinate bounds (Fixes Issue #11)
export const LAT_MIN = -90;
export const LAT_MAX = 90;
export const LNG_MIN = -180;
export const LNG_MAX = 180;

// Backend API base URL
export const API_URL = 'http://localhost:3001/api';

// Region bounding boxes for search [minLat, minLng, maxLat, maxLng]
export const REGION_BBOX = {
  usa: [24.5, -125.0, 49.5, -66.5],
  japan: [24.0, 122.0, 46.0, 146.0],
  philippines: [4.5, 116.0, 21.0, 127.0],
  world: [-90, -180, 90, 180]
};
