const USER_PALETTE = [
  '#00f0ff', // Neon Cyan
  '#ff007f', // Neon Hot Pink
  '#10b981', // Emerald Green
  '#f59e0b', // Amber Gold
  '#a855f7', // Electric Purple
  '#3b82f6', // Royal Blue
  '#ff5722', // Neon Deep Orange
  '#14b8a6', // Bright Teal
  '#e11d48', // Crimson Rose
  '#84cc16', // Electric Lime
  '#8b5cf6', // Violet
  '#d946ef', // Neon Magenta
  '#06b6d4', // Electric Turquoise
  '#f43f5e'  // Coral Red
];

function getUserColor(id) {
  if (!id) return USER_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return USER_PALETTE[Math.abs(hash) % USER_PALETTE.length];
}

class GlobeManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.map = null;
    this.users = [];
    this.links = [];
    this.markersMap = new Map();
    this.currentUserId = null;
    this.isAutoSpinning = true;
    this.spinAnimationId = null;
    this.currentLayerMode = 'hybrid'; // 'hybrid', 'satellite', 'osm'
    this.onUserClickCallback = options.onUserClick || null;
    this.onCameraMoveCallback = options.onCameraMove || null;

    this.init();
  }

  init() {
    // Initialize MapLibre GL map with Globe projection
    this.map = new maplibregl.Map({
      container: this.containerId,
      zoom: 1.8,
      center: [20, 25],
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      style: {
        version: 8,
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Esri World Imagery'
          },
          'esri-labels': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 19
          },
          'osm-streets': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'OpenStreetMap'
          },
          'connection-arcs': {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          }
        },
        layers: [
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'esri-satellite',
            layout: { visibility: 'visible' }
          },
          {
            id: 'labels-layer',
            type: 'raster',
            source: 'esri-labels',
            layout: { visibility: 'visible' }
          },
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-streets',
            layout: { visibility: 'none' }
          },
          {
            id: 'arcs-glow',
            type: 'line',
            source: 'connection-arcs',
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#00f0ff'],
              'line-width': 8,
              'line-opacity': 0.85,
              'line-blur': 4
            }
          },
          {
            id: 'arcs-core',
            type: 'line',
            source: 'connection-arcs',
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#00f0ff'],
              'line-width': 3.5,
              'line-opacity': 0.95
            }
          },
          {
            id: 'arcs-inner',
            type: 'line',
            source: 'connection-arcs',
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': '#ffffff',
              'line-width': 1.2,
              'line-opacity': 0.9
            }
          }
        ]
      }
    });

    // Set 3D Globe projection
    this.map.on('style.load', () => {
      try {
        this.map.setProjection({ type: 'globe' });
      } catch (e) {
        console.warn('MapLibre globe projection notice:', e);
      }
      this.updateArcsSource();
    });

    // Auto-spin globe when idle
    this.startAutoSpin();

    // Pause spin on user drag
    this.map.on('mousedown', () => this.stopAutoSpin());
    this.map.on('touchstart', () => this.stopAutoSpin());

    // Camera update & occlusion check
    this.map.on('move', () => {
      this.updateCameraStatus();
      this.updateMarkerVisibility();
    });
    this.map.on('render', () => {
      this.updateMarkerVisibility();
    });
  }

  startAutoSpin() {
    if (this.spinAnimationId) return;

    const spin = () => {
      if (this.isAutoSpinning && this.map && this.map.getZoom() < 4) {
        const center = this.map.getCenter();
        let newLng = center.lng - 0.15;
        while (newLng < -180) newLng += 360;
        while (newLng > 180) newLng -= 360;
        this.map.easeTo({ center: [newLng, center.lat], duration: 100, easing: n => n });
      }
      this.spinAnimationId = requestAnimationFrame(spin);
    };
    this.spinAnimationId = requestAnimationFrame(spin);
  }

  stopAutoSpin() {
    if (this.spinAnimationId) {
      cancelAnimationFrame(this.spinAnimationId);
      this.spinAnimationId = null;
    }
  }

  toggleAutoSpin() {
    this.isAutoSpinning = !this.isAutoSpinning;
    if (this.isAutoSpinning) {
      this.startAutoSpin();
    } else {
      this.stopAutoSpin();
    }
    return this.isAutoSpinning;
  }

  updateCameraStatus() {
    if (!this.map) return;
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();

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

    const latDms = this.formatDMS(center.lat, true);
    const lngDms = this.formatDMS(center.lng, false);

    const coordsEl = document.getElementById('status-coords');
    const altEl = document.getElementById('status-altitude');
    if (coordsEl) coordsEl.textContent = `${latDms}  ${lngDms}`;
    if (altEl) altEl.textContent = altStr;

    if (this.onCameraMoveCallback) {
      this.onCameraMoveCallback({ coords: `${latDms} ${lngDms}`, altitude: altStr, zoom: zoom.toFixed(1) });
    }
  }

  formatDMS(deg, isLat) {
    const absolute = Math.abs(deg);
    const d = Math.floor(absolute);
    const minutesNotTruncated = (absolute - d) * 60;
    const m = Math.floor(minutesNotTruncated);
    const s = ((minutesNotTruncated - m) * 60).toFixed(1);
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    return `${d}°${m}'${s}" ${dir}`;
  }

  updateMarkerVisibility() {
    if (!this.map) return;
    const hasOcclusionChecker = this.map.transform && typeof this.map.transform.isLocationOccluded === 'function';

    this.users.forEach(user => {
      const marker = this.markersMap.get(user.id);
      if (!marker) return;

      const el = marker.getElement();
      let normLng = user.lng;
      while (normLng < -180) normLng += 360;
      while (normLng > 180) normLng -= 360;

      let isOccluded = false;
      if (hasOcclusionChecker) {
        isOccluded = this.map.transform.isLocationOccluded(new maplibregl.LngLat(normLng, user.lat));
      } else {
        const center = this.map.getCenter();
        const centerRadLat = center.lat * Math.PI / 180;
        const userRadLat = user.lat * Math.PI / 180;
        const dLng = (normLng - center.lng) * Math.PI / 180;
        const cosDist = Math.sin(centerRadLat) * Math.sin(userRadLat) +
                        Math.cos(centerRadLat) * Math.cos(userRadLat) * Math.cos(dLng);
        isOccluded = cosDist < 0.25;
      }

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

  toggle3D() {
    if (!this.map) return false;
    const currentPitch = this.map.getPitch();
    const is3D = currentPitch < 30;
    this.map.easeTo({
      pitch: is3D ? 60 : 0,
      duration: 1000
    });
    return is3D;
  }

  resetCompass() {
    if (this.map) {
      this.map.easeTo({ bearing: 0, duration: 800 });
    }
  }

  cycleLayers() {
    if (!this.map || !this.map.isStyleLoaded()) return this.currentLayerMode;

    const modes = ['hybrid', 'satellite', 'osm'];
    const nextIdx = (modes.indexOf(this.currentLayerMode) + 1) % modes.length;
    this.currentLayerMode = modes[nextIdx];

    const satVisible = this.currentLayerMode === 'hybrid' || this.currentLayerMode === 'satellite';
    const labelsVisible = this.currentLayerMode === 'hybrid';
    const osmVisible = this.currentLayerMode === 'osm';

    this.map.setLayoutProperty('satellite-layer', 'visibility', satVisible ? 'visible' : 'none');
    this.map.setLayoutProperty('labels-layer', 'visibility', labelsVisible ? 'visible' : 'none');
    this.map.setLayoutProperty('osm-layer', 'visibility', osmVisible ? 'visible' : 'none');

    const statusLayerEl = document.getElementById('status-layer-mode');
    if (statusLayerEl) {
      statusLayerEl.textContent = this.currentLayerMode === 'hybrid' ? 'Satellite 3D Hybrid' :
                                  (this.currentLayerMode === 'satellite' ? 'Clean Satellite' : 'OpenStreetMap');
    }

    return this.currentLayerMode;
  }

  focusUser(user, targetZoom = 15) {
    if (!this.map || !user || user.lat === undefined || user.lng === undefined) return;
    this.stopAutoSpin();

    this.map.flyTo({
      center: [user.lng, user.lat],
      zoom: targetZoom,
      pitch: targetZoom > 12 ? 55 : 0,
      bearing: 0,
      essential: true,
      duration: 2600
    });
  }

  updateUsers(userList) {
    this.users = userList || [];
    if (!this.map) return;

    const activeUserIds = new Set(this.users.map(u => u.id));

    for (const [userId, marker] of this.markersMap.entries()) {
      if (!activeUserIds.has(userId)) {
        marker.remove();
        this.markersMap.delete(userId);
      }
    }

    this.users.forEach(user => {
      let normLng = user.lng;
      while (normLng < -180) normLng += 360;
      while (normLng > 180) normLng -= 360;

      let marker = this.markersMap.get(user.id);
      if (!marker) {
        const el = this.createMarkerElement(user);
        marker = new maplibregl.Marker({
          element: el,
          anchor: 'bottom'
        })
        .setLngLat([normLng, user.lat])
        .addTo(this.map);

        this.markersMap.set(user.id, marker);
      } else {
        marker.setLngLat([normLng, user.lat]);
        this.updateMarkerElement(marker.getElement(), user);
      }
    });

    this.updateMarkerVisibility();
  }

  createMarkerElement(user) {
    const isMe = user.id === this.currentUserId;
    const isInCall = user.status === 'IN_CALL';
    const userColor = user.color || getUserColor(user.id);

    const anchor = document.createElement('div');
    anchor.className = 'custom-map-marker';
    anchor.id = `marker-${user.id}`;

    const billboard = document.createElement('div');
    billboard.className = 'marker-billboard';
    billboard.style.borderColor = userColor;
    billboard.style.boxShadow = `0 6px 20px rgba(0, 0, 0, 0.7), 0 0 12px ${userColor}55`;

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'marker-avatar-wrap';

    const img = document.createElement('img');
    img.src = user.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(user.name);
    img.alt = user.name;
    img.style.borderColor = userColor;

    const dot = document.createElement('div');
    dot.className = `marker-status-dot ${isInCall ? 'in-call' : ''}`;
    dot.style.backgroundColor = userColor;
    dot.style.boxShadow = `0 0 6px ${userColor}`;

    avatarWrap.appendChild(img);
    avatarWrap.appendChild(dot);

    const info = document.createElement('div');
    info.className = 'marker-info';

    const nameRow = document.createElement('div');
    nameRow.style.display = 'flex';
    nameRow.style.alignItems = 'center';

    const name = document.createElement('span');
    name.className = 'marker-name';
    name.textContent = user.name;
    nameRow.appendChild(name);

    const isFemale = (user.gender || '').toUpperCase() === 'FEMALE';
    const genderBadge = document.createElement('span');
    genderBadge.className = `marker-gender-badge ${isFemale ? 'female' : 'male'}`;
    genderBadge.textContent = `${isFemale ? '♀' : '♂'} ${user.age || 24}`;
    nameRow.appendChild(genderBadge);

    if (isMe) {
      const meBadge = document.createElement('span');
      meBadge.className = 'marker-badge-me';
      meBadge.textContent = 'YOU';
      nameRow.appendChild(meBadge);
    }

    const location = document.createElement('span');
    location.className = 'marker-location';
    location.textContent = `${user.city || 'World'}`;

    info.appendChild(nameRow);
    info.appendChild(location);

    billboard.appendChild(avatarWrap);
    billboard.appendChild(info);

    const stem = document.createElement('div');
    stem.className = 'marker-pin-stem';
    stem.style.background = `linear-gradient(to top, ${userColor}, rgba(255, 255, 255, 0.4), transparent)`;
    stem.style.boxShadow = `0 0 6px ${userColor}`;

    const needleTip = document.createElement('div');
    needleTip.className = 'marker-needle-tip';
    needleTip.style.borderTopColor = userColor;

    const groundPoint = document.createElement('div');
    groundPoint.className = 'marker-ground-point';

    const groundDot = document.createElement('div');
    groundDot.className = 'marker-ground-dot';
    groundDot.style.backgroundColor = userColor;

    const groundRing = document.createElement('div');
    groundRing.className = 'marker-ground-ring';
    groundRing.style.borderColor = userColor;

    const groundPulse = document.createElement('div');
    groundPulse.className = 'marker-ground-pulse';
    groundPulse.style.borderColor = userColor;

    groundPoint.appendChild(groundRing);
    groundPoint.appendChild(groundPulse);
    groundPoint.appendChild(groundDot);

    anchor.appendChild(billboard);
    anchor.appendChild(stem);
    anchor.appendChild(needleTip);
    anchor.appendChild(groundPoint);

    anchor.addEventListener('click', (e) => {
      e.stopPropagation();
      this.focusUser(user, 15);
      if (this.onUserClickCallback) {
        this.onUserClickCallback(user);
      }
    });

    return anchor;
  }

  updateMarkerElement(anchor, user) {
    const isMe = user.id === this.currentUserId;
    const isInCall = user.status === 'IN_CALL';
    const userColor = user.color || getUserColor(user.id);

    const billboard = anchor.querySelector('.marker-billboard');
    if (billboard) {
      billboard.style.borderColor = userColor;
    }

    const locSpan = anchor.querySelector('.marker-location');
    if (locSpan) {
      locSpan.textContent = `${user.city || 'World'}`;
    }
  }

  setCurrentUserId(id) {
    this.currentUserId = id;
    if (this.users.length > 0) {
      this.updateUsers(this.users);
    }
  }

  updateLinks(linkList) {
    this.links = linkList || [];
    this.updateArcsSource();
  }

  updateArcsSource() {
    if (!this.map || !this.map.getSource('connection-arcs')) return;

    const features = [];

    (this.links || []).forEach(link => {
      try {
        const start = [link.user1Lng, link.user1Lat];
        const end = [link.user2Lng, link.user2Lat];
        const arcColor = link.color || '#00f0ff';

        if (window.turf && window.turf.greatCircle) {
          const arc = window.turf.greatCircle(start, end, {
            npoints: 100,
            properties: { color: arcColor }
          });
          features.push(arc);
        } else {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [start, end] },
            properties: { color: arcColor }
          });
        }
      } catch (e) {
        console.warn('Arc calculation warning:', e);
      }
    });

    const source = this.map.getSource('connection-arcs');
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: features
      });
    }
  }
}

window.GlobeManager = GlobeManager;
