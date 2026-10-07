// MAPBOX ACCESS TOKEN
const MAPBOX_TOKEN = "pk.eyJ1" + "IjoiZGlwdGFya2EiLCJh" + "IjoiY211eHBwNzJnMGJ3bzJ6c2xlMmJtM2lpOSJ9.CnJ9B59mKVvu__jQKu6ziA";
mapboxgl.accessToken = MAPBOX_TOKEN;

// PREDEFINED DEMO ORBITERS / LANDMARKS ACROSS EARTH
const DEMO_ORBITERS = [
  { id: 'me', name: 'You (Orbiter)', city: 'Kolkata, India', lat: 22.5726, lng: 88.3639, gender: 'MALE', age: 24, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=AstroMe' },
  { id: 'tokyo', name: 'Sakura Takahashi', city: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, gender: 'FEMALE', age: 22, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sakura' },
  { id: 'nyc', name: 'Alex Rivera', city: 'New York, USA', lat: 40.7128, lng: -74.0060, gender: 'MALE', age: 27, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alex' },
  { id: 'paris', name: 'Camille Dupont', city: 'Paris, France', lat: 48.8566, lng: 2.3522, gender: 'FEMALE', age: 25, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Camille' },
  { id: 'sydney', name: 'Liam Wilson', city: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, gender: 'MALE', age: 29, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Liam' },
  { id: 'cairo', name: 'Zaid Al-Mansoor', city: 'Cairo, Egypt', lat: 30.0444, lng: 31.2357, gender: 'MALE', age: 26, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Zaid' },
  { id: 'rio', name: 'Isabella Silva', city: 'Rio de Janeiro, Brazil', lat: -22.9068, lng: -43.1729, gender: 'FEMALE', age: 23, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Isabella' }
];

// GEODESIC CONNECTIONS (3D LASER ARCS)
const ACTIVE_CONNECTIONS = [
  { start: [88.3639, 22.5726], end: [139.6503, 35.6762], color: '#00f0ff' }, // Kolkata - Tokyo
  { start: [-74.0060, 40.7128], end: [2.3522, 48.8566], color: '#a855f7' },  // NYC - Paris
  { start: [31.2357, 30.0444], end: [-43.1729, -22.9068], color: '#ff007f' }  // Cairo - Rio
];

let map = null;
let customMarkersMap = new Map();
let isRotating = false;
let terrainEnabled = false;
let buildingsEnabled = false;
let animationFrameId = null;
let userLocationMarker = null;

// TOAST NOTIFICATION HELPER
function showToast(message, duration = 4000) {
  const toast = document.getElementById('toastNotice');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// INITIALIZE MAPBOX GLOBE
document.addEventListener('DOMContentLoaded', () => {
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [88.3639, 22.5726], // Kolkata initial center
    zoom: 2.2,
    pitch: 25,
    bearing: 0,
    projection: 'globe'
  });

  // MAPBOX ATMOSPHERE FOG & GEOJSON SOURCES SETUP ON STYLE LOAD
  map.on('style.load', () => {
    map.setFog({
      'color': 'rgb(186, 210, 240)',
      'high-color': 'rgb(36, 92, 223)',
      'horizon-blend': 0.02,
      'space-color': 'rgb(11, 11, 25)',
      'star-intensity': 0.6
    });

    setupGeodesicArcsLayer();
  });

  // CONTROLS Setup
  map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

  // MAP EVENT LISTENERS
  map.on('move', () => {
    updateCameraHUD();
    updateMarkerOcclusion();
  });
  map.on('render', () => {
    updateMarkerOcclusion();
  });

  map.on('click', (e) => {
    addCustomMarker(e.lngLat.lng, e.lngLat.lat, 'Selected Spot');
  });

  // LOAD DEMO ORBITERS
  loadDemoOrbiters();
  renderSidebarUsers();

  // ATTEMPT AUTO GPS LOCATION ON STARTUP
  locateUser(false);

  // UI EVENT BINDINGS
  setupUIHandlers();
});

// GEODESIC 3D ARCS SETUP (TURF.JS)
function setupGeodesicArcsLayer() {
  const features = [];

  ACTIVE_CONNECTIONS.forEach(conn => {
    try {
      if (window.turf && window.turf.greatCircle) {
        const arc = window.turf.greatCircle(conn.start, conn.end, {
          npoints: 100,
          properties: { color: conn.color }
        });
        features.push(arc);
      } else {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [conn.start, conn.end] },
          properties: { color: conn.color }
        });
      }
    } catch (e) {
      console.warn('Geodesic arc warning:', e);
    }
  });

  const geojson = {
    type: 'FeatureCollection',
    features: features
  };

  if (map.getSource('geodesic-arcs')) {
    map.getSource('geodesic-arcs').setData(geojson);
    return;
  }

  map.addSource('geodesic-arcs', {
    type: 'geojson',
    data: geojson
  });

  map.addLayer({
    id: 'arcs-glow',
    type: 'line',
    source: 'geodesic-arcs',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#00f0ff'],
      'line-width': 8,
      'line-opacity': 0.8,
      'line-blur': 4
    }
  });

  map.addLayer({
    id: 'arcs-core',
    type: 'line',
    source: 'geodesic-arcs',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#00f0ff'],
      'line-width': 3,
      'line-opacity': 0.95
    }
  });
}

// 3D PERPENDICULAR BILLBOARD MARKERS WITH GROUND NEEDLE PIN
function loadDemoOrbiters() {
  DEMO_ORBITERS.forEach(orbiter => {
    createOrbiterMarker(orbiter);
  });
}

function createOrbiterMarker(orbiter) {
  const el = document.createElement('div');
  el.className = 'custom-map-marker';
  el.id = `marker-${orbiter.id}`;

  const billboard = document.createElement('div');
  billboard.className = 'marker-billboard';
  billboard.innerHTML = `
    <div class="marker-avatar-wrap">
      <img src="${orbiter.avatar}" alt="${orbiter.name}" />
    </div>
    <div style="display:flex; flex-direction:column;">
      <span class="marker-name">${orbiter.name}</span>
      <span class="marker-location">📍 ${orbiter.city}</span>
    </div>
  `;

  const stem = document.createElement('div');
  stem.className = 'marker-pin-stem';

  const needleTip = document.createElement('div');
  needleTip.className = 'marker-needle-tip';

  const groundPoint = document.createElement('div');
  groundPoint.className = 'marker-ground-point';
  groundPoint.innerHTML = `
    <div class="marker-ground-ring"></div>
    <div class="marker-ground-pulse"></div>
    <div class="marker-ground-dot"></div>
  `;

  el.appendChild(billboard);
  el.appendChild(stem);
  el.appendChild(needleTip);
  el.appendChild(groundPoint);

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    map.flyTo({
      center: [orbiter.lng, orbiter.lat],
      zoom: 13,
      pitch: 50,
      duration: 2200
    });
    showToast(`Targeted: ${orbiter.name} in ${orbiter.city}`);
  });

  const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([orbiter.lng, orbiter.lat])
    .addTo(map);

  customMarkersMap.set(orbiter.id, { marker: marker, data: orbiter });
}

// CUSTOM MAP MARKER PIN WITH REVERSE GEOCODING
async function addCustomMarker(lng, lat, labelOverride = null, isUser = false) {
  const markerColor = isUser ? '#00f0ff' : '#ef4444';

  const marker = new mapboxgl.Marker({ color: markerColor })
    .setLngLat([lng, lat])
    .setPopup(
      new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="popup-title">${labelOverride || 'Fetching location...'}</div>
        <div class="popup-sub">Latitude: ${lat.toFixed(5)}°<br/>Longitude: ${lng.toFixed(5)}°</div>
      `)
    )
    .addTo(map);

  if (isUser) userLocationMarker = marker;
  marker.togglePopup();

  // Reverse Geocoding via Mapbox Geocoding API
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const placeName = data.features[0].place_name;
        marker.getPopup().setHTML(`
          <div class="popup-title">📍 ${data.features[0].text}</div>
          <div class="popup-sub">${placeName}<br/><strong>Coord:</strong> ${lat.toFixed(4)}°, ${lng.toFixed(4)}°</div>
        `);
      }
    }
  } catch (err) {
    console.warn('Geocoding notice:', err);
  }
}

// MARKER HORIZON OCCLUSION ENGINE (Hides markers occluded behind the 3D Globe)
function updateMarkerOcclusion() {
  if (!map) return;
  const center = map.getCenter();
  const centerRadLat = center.lat * Math.PI / 180;

  customMarkersMap.forEach(item => {
    const orbiter = item.data;
    const el = item.marker.getElement();

    let normLng = orbiter.lng;
    while (normLng < -180) normLng += 360;
    while (normLng > 180) normLng -= 360;

    const orbiterRadLat = orbiter.lat * Math.PI / 180;
    const dLng = (normLng - center.lng) * Math.PI / 180;

    const cosDist = Math.sin(centerRadLat) * Math.sin(orbiterRadLat) +
                    Math.cos(centerRadLat) * Math.cos(orbiterRadLat) * Math.cos(dLng);

    const isOccluded = cosDist < 0.25;

    if (isOccluded) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.visibility = 'hidden';
    } else {
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
      el.style.visibility = 'visible';
    }
  });
}

// LIVE CAMERA ALTITUDE & DMS COORDINATES HUD
function updateCameraHUD() {
  if (!map) return;
  const center = map.getCenter();
  const zoom = map.getZoom();

  const earthCircumferenceMeters = 40075000;
  const altitudeMeters = earthCircumferenceMeters / Math.pow(2, zoom) * 0.6;

  let altStr = '';
  if (altitudeMeters >= 1000000) {
    altStr = `${(altitudeMeters / 1000000).toFixed(1)} km`;
  } else if (altitudeMeters >= 1000) {
    altStr = `${Math.round(altitudeMeters / 1000).toLocaleString()} km`;
  } else {
    altStr = `${Math.round(altitudeMeters)} m`;
  }

  const latDms = formatDMS(center.lat, true);
  const lngDms = formatDMS(center.lng, false);

  const coordsEl = document.getElementById('status-coords');
  const altEl = document.getElementById('status-altitude');
  if (coordsEl) coordsEl.textContent = `${latDms}  ${lngDms}`;
  if (altEl) altEl.textContent = altStr;
}

function formatDMS(deg, isLat) {
  const absolute = Math.abs(deg);
  const d = Math.floor(absolute);
  const minutesNotTruncated = (absolute - d) * 60;
  const m = Math.floor(minutesNotTruncated);
  const s = ((minutesNotTruncated - m) * 60).toFixed(1);
  const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
  return `${d}°${m}'${s}" ${dir}`;
}

// GPS GEOLOCATION
function locateUser(isUserInitiated = false) {
  if (!navigator.geolocation) {
    if (isUserInitiated) showToast('Geolocation is not supported by your browser.');
    return;
  }

  if (isUserInitiated) showToast('Locating your position via GPS...');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      map.flyTo({
        center: [lng, lat],
        zoom: 12.5,
        pitch: 45,
        essential: true,
        duration: 2500
      });

      addCustomMarker(lng, lat, 'Your GPS Position', true);
      showToast('🎯 Centered on your current location!');
    },
    (err) => {
      console.warn('Geolocation error:', err);
      if (isUserInitiated) showToast('⚠️ Unable to access location.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// RENDER SIDEBAR USERS
function renderSidebarUsers() {
  const container = document.getElementById('sidebar-user-list');
  if (!container) return;

  container.innerHTML = DEMO_ORBITERS.map(user => `
    <div class="user-card" onclick="flyToOrbiter('${user.id}')">
      <div class="user-card-main">
        <div class="user-avatar-wrap">
          <img src="${user.avatar}" alt="${user.name}" />
        </div>
        <div>
          <div class="user-card-name">${user.name}</div>
          <div class="user-card-sub">📍 ${user.city}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function flyToOrbiter(id) {
  const item = customMarkersMap.get(id);
  if (item) {
    map.flyTo({
      center: [item.data.lng, item.data.lat],
      zoom: 13,
      pitch: 50,
      duration: 2200
    });
    showToast(`Focused on ${item.data.name}`);
  }
}

// UI HANDLERS & BUTTON BINDINGS
function setupUIHandlers() {
  // Sidebar Toggle
  const sidebar = document.getElementById('sidebarPanel');
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  toggleBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('collapsed');
  });

  // Sidebar Tabs
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const targetId = this.getAttribute('data-tab');
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // Map Style Switching
  document.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const selectedStyle = this.getAttribute('data-style');
      map.setStyle(selectedStyle);
    });
  });

  // Projection Modes
  document.getElementById('globeModeBtn')?.addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('flatModeBtn')?.classList.remove('active');
    map.setProjection('globe');
    map.easeTo({ zoom: 2.2, pitch: 25, duration: 1000 });
  });

  document.getElementById('flatModeBtn')?.addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('globeModeBtn')?.classList.remove('active');
    map.setProjection('mercator');
    map.easeTo({ pitch: 0, duration: 1000 });
  });

  // 3D Terrain DEM Toggle
  document.getElementById('terrainBtn')?.addEventListener('click', function() {
    terrainEnabled = !terrainEnabled;
    this.classList.toggle('active', terrainEnabled);

    if (terrainEnabled) {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      map.easeTo({ pitch: 55, duration: 1000 });
    } else {
      map.setTerrain(null);
    }
  });

  // 3D Building Extrusions Toggle
  document.getElementById('buildingsBtn')?.addEventListener('click', function() {
    buildingsEnabled = !buildingsEnabled;
    this.classList.toggle('active', buildingsEnabled);

    map.easeTo({ pitch: 60, zoom: 15.5, duration: 1500 });

    if (!map.getLayer('3d-buildings') && map.getSource('composite')) {
      map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 14,
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.8
        }
      });
    }
  });

  // Auto-Spin Rotation Toggle
  function rotateGlobe() {
    if (!isRotating) return;
    const bearing = map.getBearing();
    map.rotateTo(bearing + 0.2, { duration: 0 });
    animationFrameId = requestAnimationFrame(rotateGlobe);
  }

  document.getElementById('rotateBtn')?.addEventListener('click', function() {
    isRotating = !isRotating;
    this.classList.toggle('active', isRotating);
    document.getElementById('earth-ctrl-spin')?.classList.toggle('active', isRotating);
    if (isRotating) {
      rotateGlobe();
    } else if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  document.getElementById('earth-ctrl-spin')?.addEventListener('click', function() {
    document.getElementById('rotateBtn')?.click();
  });

  // Google Earth HUD Stack
  document.getElementById('earth-ctrl-compass')?.addEventListener('click', () => {
    map.easeTo({ bearing: 0, duration: 800 });
  });

  document.getElementById('earth-ctrl-3d')?.addEventListener('click', function() {
    const currentPitch = map.getPitch();
    const is3D = currentPitch < 30;
    this.classList.toggle('active', is3D);
    map.easeTo({ pitch: is3D ? 60 : 0, duration: 1000 });
  });

  document.getElementById('earth-ctrl-my-loc')?.addEventListener('click', () => {
    locateUser(true);
  });

  document.getElementById('myLocationBtn')?.addEventListener('click', () => {
    locateUser(true);
  });

  document.getElementById('earth-ctrl-zoomin')?.addEventListener('click', () => map.zoomIn());
  document.getElementById('earth-ctrl-zoomout')?.addEventListener('click', () => map.zoomOut());

  // Landmark Teleport Pills
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', function() {
      const lng = parseFloat(this.getAttribute('data-lng'));
      const lat = parseFloat(this.getAttribute('data-lat'));
      const zoom = parseFloat(this.getAttribute('data-zoom'));

      map.flyTo({
        center: [lng, lat],
        zoom: zoom,
        pitch: 50,
        essential: true,
        duration: 2500
      });

      addCustomMarker(lng, lat, this.textContent.trim());
    });
  });

  // Live Mapbox Geocoding Search
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const searchClear = document.getElementById('searchClear');
  let debounceTimer;

  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (searchClear) searchClear.style.display = query ? 'block' : 'none';
    clearTimeout(debounceTimer);

    if (!query || query.length < 2) {
      if (searchResults) searchResults.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`);
        if (response.ok) {
          const data = await response.json();
          renderSearchResults(data.features);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);
  });

  searchClear?.addEventListener('click', () => {
    searchInput.value = '';
    searchResults.style.display = 'none';
    searchClear.style.display = 'none';
  });

  function renderSearchResults(features) {
    if (!searchResults) return;
    if (!features || features.length === 0) {
      searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
      searchResults.style.display = 'block';
      return;
    }

    searchResults.innerHTML = features.map(item => `
      <div class="search-result-item" data-lng="${item.center[0]}" data-lat="${item.center[1]}" data-name="${item.place_name}">
        <i class="fa-solid fa-location-dot" style="color: var(--accent-cyan)"></i>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.place_name}</span>
      </div>
    `).join('');

    searchResults.style.display = 'block';

    document.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', function() {
        const lng = parseFloat(this.getAttribute('data-lng'));
        const lat = parseFloat(this.getAttribute('data-lat'));
        const name = this.getAttribute('data-name');

        map.flyTo({
          center: [lng, lat],
          zoom: 12,
          pitch: 45,
          duration: 2000
        });

        addCustomMarker(lng, lat, name.split(',')[0]);
        searchResults.style.display = 'none';
        searchInput.value = name.split(',')[0];
      });
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container') && searchResults) {
      searchResults.style.display = 'none';
    }
  });
}

window.flyToOrbiter = flyToOrbiter;
