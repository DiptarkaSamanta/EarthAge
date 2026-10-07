// Predefined World Cities for Teleportation & Demo Orbiters
const WORLD_CITIES = [
  { name: 'Kolkata, India', lat: 22.5726, lng: 88.3639 },
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'New York, USA', lat: 40.7128, lng: -74.0060 },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { name: 'Paris, France', lat: 48.8566, lng: 2.3522 },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093 },
  { name: 'Cairo, Egypt', lat: 30.0444, lng: 31.2357 },
  { name: 'Rio de Janeiro, Brazil', lat: -22.9068, lng: -43.1729 },
  { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708 },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Reykjavik, Iceland', lat: 64.1466, lng: -21.9426 },
  { name: 'Cape Town, South Africa', lat: -33.9249, lng: 18.4241 }
];

// Initial Demo Orbiters on Earth
let activeUsers = [
  { id: 'usr-me', name: 'You (Orbiter)', city: 'Kolkata, India', lat: 22.5726, lng: 88.3639, gender: 'MALE', age: 24, status: 'ONLINE', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=AstroMe' },
  { id: 'usr-tokyo', name: 'Sakura Takahashi', city: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, gender: 'FEMALE', age: 22, status: 'ONLINE', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sakura' },
  { id: 'usr-nyc', name: 'Alex Rivera', city: 'New York, USA', lat: 40.7128, lng: -74.0060, gender: 'MALE', age: 27, status: 'IN_CALL', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alex' },
  { id: 'usr-paris', name: 'Camille Dupont', city: 'Paris, France', lat: 48.8566, lng: 2.3522, gender: 'FEMALE', age: 25, status: 'ONLINE', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Camille' },
  { id: 'usr-sydney', name: 'Liam Wilson', city: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, gender: 'MALE', age: 29, status: 'ONLINE', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Liam' },
  { id: 'usr-cairo', name: 'Zaid Al-Mansoor', city: 'Cairo, Egypt', lat: 30.0444, lng: 31.2357, gender: 'MALE', age: 26, status: 'ONLINE', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Zaid' },
  { id: 'usr-rio', name: 'Isabella Silva', city: 'Rio de Janeiro, Brazil', lat: -22.9068, lng: -43.1729, gender: 'FEMALE', age: 23, status: 'IN_CALL', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Isabella' }
];

// Connection Arcs between users for active video/data transmission
let activeLinks = [
  { id: 'link-1', user1Lng: 88.3639, user1Lat: 22.5726, user2Lng: 139.6503, user2Lat: 35.6762, color: '#00f0ff' }, // Kolkata to Tokyo
  { id: 'link-2', user1Lng: -74.0060, user1Lat: 40.7128, user2Lng: 2.3522, user2Lat: 48.8566, color: '#a855f7' },  // NYC to Paris
  { id: 'link-3', user1Lng: 31.2357, user1Lat: 30.0444, user2Lng: -43.1729, user2Lat: -22.9068, color: '#ff007f' }  // Cairo to Rio
];

let globeManager = null;
let selectedTargetUser = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Globe Manager
  globeManager = new GlobeManager('globe-container', {
    onUserClick: (user) => {
      openTargetModal(user);
    }
  });

  globeManager.setCurrentUserId('usr-me');
  globeManager.updateUsers(activeUsers);
  globeManager.updateLinks(activeLinks);

  // 2. Populate Teleport City Dropdown
  const citySelect = document.getElementById('select-teleport-city');
  if (citySelect) {
    WORLD_CITIES.forEach((city, index) => {
      const opt = document.createElement('option');
      opt.value = index;
      opt.textContent = `${city.name} (${city.lat.toFixed(2)}°, ${city.lng.toFixed(2)}°)`;
      citySelect.appendChild(opt);
    });
  }

  // 3. Render User List in Sidebar
  renderUserList();

  // 4. Sidebar Tab Navigation
  document.querySelectorAll('.sidebar-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', function() {
      document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      this.classList.add('active');
      const targetTab = this.getAttribute('data-tab');
      document.getElementById(targetTab)?.classList.add('active');
    });
  });

  // 5. Sidebar Collapse Toggle
  const sidebarPanel = document.getElementById('sidebar-panel');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  sidebarToggleBtn?.addEventListener('click', () => {
    sidebarPanel?.classList.toggle('collapsed');
  });

  // 6. Google Earth HUD Navigation Buttons
  document.getElementById('earth-ctrl-spin')?.addEventListener('click', function() {
    const isSpinning = globeManager.toggleAutoSpin();
    this.classList.toggle('active', isSpinning);
  });

  document.getElementById('earth-ctrl-3d')?.addEventListener('click', function() {
    const is3D = globeManager.toggle3D();
    this.classList.toggle('active', is3D);
  });

  document.getElementById('earth-ctrl-compass')?.addEventListener('click', () => {
    globeManager.resetCompass();
  });

  document.getElementById('earth-ctrl-layers')?.addEventListener('click', () => {
    globeManager.cycleLayers();
  });

  document.getElementById('earth-ctrl-my-loc')?.addEventListener('click', () => {
    const me = activeUsers.find(u => u.id === 'usr-me');
    if (me) globeManager.focusUser(me, 14);
  });

  document.getElementById('earth-ctrl-zoomin')?.addEventListener('click', () => {
    if (globeManager.map) globeManager.map.zoomIn();
  });

  document.getElementById('earth-ctrl-zoomout')?.addEventListener('click', () => {
    if (globeManager.map) globeManager.map.zoomOut();
  });

  // 7. Teleport Handler
  document.getElementById('btn-teleport')?.addEventListener('click', () => {
    const cityIdx = parseInt(citySelect.value);
    const city = WORLD_CITIES[cityIdx];
    if (city) {
      const me = activeUsers.find(u => u.id === 'usr-me');
      if (me) {
        me.lat = city.lat;
        me.lng = city.lng;
        me.city = city.name;
        globeManager.updateUsers(activeUsers);
        globeManager.focusUser(me, 13);
        renderUserList();
      }
    }
  });

  // 8. GPS Re-detect Handler
  document.getElementById('btn-detect-gps')?.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const me = activeUsers.find(u => u.id === 'usr-me');
        if (me) {
          me.lat = pos.coords.latitude;
          me.lng = pos.coords.longitude;
          me.city = 'GPS Position';
          globeManager.updateUsers(activeUsers);
          globeManager.focusUser(me, 14);
          renderUserList();
        }
      });
    }
  });

  // 9. Target Focus Modal Dismiss
  document.getElementById('target-modal-close-btn')?.addEventListener('click', () => {
    document.getElementById('target-focus-modal').style.display = 'none';
  });
});

// RENDER USER LIST IN SIDEBAR
function renderUserList() {
  const container = document.getElementById('user-list-container');
  if (!container) return;

  container.innerHTML = activeUsers.map(user => `
    <div class="user-card" onclick="focusUserById('${user.id}')">
      <div class="user-card-main">
        <div class="user-avatar-wrap">
          <img src="${user.avatarUrl}" alt="${user.name}">
        </div>
        <div class="user-details">
          <div class="user-card-name">${user.name}</div>
          <div class="user-card-sub">📍 ${user.city}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function focusUserById(id) {
  const user = activeUsers.find(u => u.id === id);
  if (user) {
    globeManager.focusUser(user, 14);
    openTargetModal(user);
  }
}

function openTargetModal(user) {
  selectedTargetUser = user;
  const modal = document.getElementById('target-focus-modal');
  if (!modal) return;

  document.getElementById('target-modal-avatar').src = user.avatarUrl;
  document.getElementById('target-modal-name').textContent = user.name;
  document.getElementById('target-modal-location').textContent = `${user.city} • Lat: ${user.lat.toFixed(2)}°, Lng: ${user.lng.toFixed(2)}°`;
  modal.style.display = 'flex';
}

window.focusUserById = focusUserById;
