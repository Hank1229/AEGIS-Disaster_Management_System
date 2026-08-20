// ============================================================
// map.js - Leaflet Map Module
// ============================================================

import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, REGION_BBOX } from './constants.js';
import { fetchEarthquakes, fetchStorms } from './api.js';

let map = null;
let dataLayer = null;

// ============================================================
// Initialize Map
// ============================================================
export function initMap(containerId = 'map') {
  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded');
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Map container #${containerId} not found`);
    return null;
  }

  map = L.map(containerId).setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(map);

  dataLayer = L.layerGroup().addTo(map);

  return map;
}

// ============================================================
// Render Earthquakes on Map
// ============================================================
export function renderEarthquakes(features, options = {}) {
  if (!dataLayer) return;

  const { clearFirst = true, onMarkerClick } = options;

  if (clearFirst) {
    dataLayer.clearLayers();
  }

  const listEl = document.getElementById('dataList');
  if (listEl && clearFirst) {
    listEl.innerHTML = '';
  }

  for (const feature of features) {
    const coords = feature?.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;

    const lat = coords[1];
    const lng = coords[0];

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const mag = feature?.properties?.mag || 0;
    const title = feature?.properties?.title || feature?.properties?.place || 'Unknown';
    const time = feature?.properties?.time;
    const url = feature?.properties?.url;

    // Color based on magnitude
    let color = '#4caf50'; // green for low
    if (mag >= 6) color = '#d32f2f'; // red for high
    else if (mag >= 5) color = '#f57c00'; // orange for medium-high
    else if (mag >= 4) color = '#fbc02d'; // yellow for medium

    const marker = L.circleMarker([lat, lng], {
      radius: Math.max(mag * 2, 4),
      color: color,
      fillColor: color,
      fillOpacity: 0.6,
      weight: 1
    });

    // Create popup content safely (no innerHTML with user data)
    const popupContent = document.createElement('div');
    const titleEl = document.createElement('strong');
    titleEl.textContent = `M${mag.toFixed(1)} - ${title}`;
    const timeEl = document.createElement('p');
    timeEl.textContent = time ? new Date(time).toLocaleString() : 'Unknown time';
    timeEl.style.margin = '5px 0';

    popupContent.appendChild(titleEl);
    popupContent.appendChild(timeEl);

    if (url) {
      const linkEl = document.createElement('a');
      linkEl.href = url;
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';
      linkEl.textContent = 'More info';
      popupContent.appendChild(linkEl);
    }

    marker.bindPopup(popupContent);

    if (onMarkerClick) {
      marker.on('click', () => onMarkerClick(feature));
    }

    marker.addTo(dataLayer);

    // Add to list
    if (listEl) {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.textContent = `M${mag.toFixed(1)} — ${title}`;
      li.addEventListener('click', () => {
        map.setView([lat, lng], 8);
        marker.openPopup();
      });
      listEl.appendChild(li);
    }
  }
}

// ============================================================
// Render Hurricanes/Storms on Map
// ============================================================
export function renderHurricanes(events, options = {}) {
  if (!dataLayer) return;

  const { clearFirst = true, onMarkerClick } = options;

  if (clearFirst) {
    dataLayer.clearLayers();
  }

  const listEl = document.getElementById('dataList');
  if (listEl && clearFirst) {
    listEl.innerHTML = '';
  }

  for (const event of events) {
    const geometry = event?.geometry;
    if (!geometry || geometry.length === 0) continue;

    // Get latest position
    const latest = geometry[geometry.length - 1];
    const coords = latest?.coordinates;
    if (!coords || coords.length < 2) continue;

    const lat = coords[1];
    const lng = coords[0];

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const title = event?.title || 'Unknown Storm';
    const date = latest?.date;

    const marker = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#2196f3',
      fillColor: '#2196f3',
      fillOpacity: 0.6,
      weight: 2
    });

    const popupContent = document.createElement('div');
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    const timeEl = document.createElement('p');
    timeEl.textContent = date ? new Date(date).toLocaleString() : 'Unknown time';
    timeEl.style.margin = '5px 0';

    popupContent.appendChild(titleEl);
    popupContent.appendChild(timeEl);

    marker.bindPopup(popupContent);

    if (onMarkerClick) {
      marker.on('click', () => onMarkerClick(event));
    }

    marker.addTo(dataLayer);

    // Add to list
    if (listEl) {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.textContent = `🌀 ${title}`;
      li.addEventListener('click', () => {
        map.setView([lat, lng], 6);
        marker.openPopup();
      });
      listEl.appendChild(li);
    }
  }
}

// ============================================================
// Search and Display Disasters
// ============================================================
export async function searchDisasters(disasterType, region, days, minMag = 0) {
  const statusEl = document.getElementById('status');
  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg;
  };

  try {
    setStatus('Loading...');

    const bbox = REGION_BBOX[region] || REGION_BBOX.world;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    if (disasterType === 'earthquake') {
      const data = await fetchEarthquakes({
        starttime: startDate.toISOString(),
        minlatitude: bbox[0],
        minlongitude: bbox[1],
        maxlatitude: bbox[2],
        maxlongitude: bbox[3],
        minmagnitude: minMag,
        orderby: 'magnitude'
      });

      const features = data?.features || [];
      renderEarthquakes(features);

      // Fit map to region
      map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]]);

      setStatus(`Found ${features.length} earthquake(s)`);

    } else if (disasterType === 'hurricane') {
      const data = await fetchStorms(days);
      const events = data?.events || [];

      renderHurricanes(events);

      if (region !== 'world') {
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]]);
      }

      setStatus(`Found ${events.length} storm(s)`);
    }

  } catch (err) {
    setStatus('Error: ' + err.message);
    console.error('Search error:', err);
  }
}

// ============================================================
// Utility Functions
// ============================================================
export function getMap() {
  return map;
}

export function clearMarkers() {
  if (dataLayer) {
    dataLayer.clearLayers();
  }
}

export function setView(lat, lng, zoom = 8) {
  if (map) {
    map.setView([lat, lng], zoom);
  }
}
