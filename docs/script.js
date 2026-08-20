// NASA EONET falls back to the public DEMO_KEY when no key is configured.
// Do not hardcode a real key here — this file is served publicly by GitHub Pages.
const NASA_API_KEY = 'DEMO_KEY';

// EmailJS configuration — fill in locally, do not commit real values.
const EMAIL_PUBLIC_KEY = '';
const EMAIL_SERVICE_ID = '';
const EMAIL_TEMPLATE_ID = '';

if (EMAIL_PUBLIC_KEY) {
    emailjs.init(EMAIL_PUBLIC_KEY);
}

// --- Global Variables ---
const $ = (s) => document.querySelector(s);
let map, dataLayer, loader;
let currentUser = null; 
let sentAlerts = new Set(); 

// --- UI Elements ---
const mapView = $('#mapView');
const dashboardView = $('#dashboardView');
const authButton = $('#authButton');

const loginModal = $('#loginModal');
const registerModal = $('#registerModal');
const forgotPasswordModal = $('#forgotPasswordModal');
const locationPermissionModal = $('#locationPermissionModal');

// --- View Management ---
function showView(viewName) {
    mapView.style.display = 'none';
    dashboardView.style.display = 'none';
    
    if (viewName === 'map') {
        mapView.style.display = 'block';
        if(map) map.invalidateSize(); 
    } else if (viewName === 'dashboard') {
        dashboardView.style.display = 'block';
        updateDashboardUI(); 
    }
}

function showModal(modalElement) {
    modalElement.style.display = 'flex';
    
    // Auto-fill email if Remember Me was checked
    if (modalElement === loginModal) {
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            $('#loginEmail').value = savedEmail;
            $('#rememberMe').checked = true;
        }
    }
}

function hideModal(modalElement) {
    modalElement.style.display = 'none';
    
    const error = modalElement.querySelector('.error-message');
    const success = modalElement.querySelector('.success-message');
    if (error) error.style.display = 'none';
    if (success) success.style.display = 'none';
}

function showAuthError(modalElement, message) {
    const errorEl = modalElement.querySelector('.error-message');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

// --- Authentication Logic ---

function checkLoginState() {
    const userDataJSON = localStorage.getItem('currentUser');
    if (userDataJSON) {
        try {
            currentUser = JSON.parse(userDataJSON);
            authButton.textContent = 'Dashboard';
        } catch (e) {
            console.error("Login Data Error", e);
            localStorage.removeItem('currentUser');
        }
    } else {
        currentUser = null;
        authButton.textContent = 'Login';
        showView('map');
    }
    
    // Always init map search if empty
    if ($('#dataList') && !$('#dataList').innerHTML) {
         $('#q').value = 'USA';
         updateUI('earthquake');
         runSearch();
    }
}

function handleLogin(email, password, rememberMe) {
    const userDataJSON = localStorage.getItem(email);
    if (!userDataJSON) {
        showAuthError(loginModal, 'User not found. Please register.');
        return;
    }
    
    const userData = JSON.parse(userDataJSON);
    
    if (userData.password !== password) {
        showAuthError(loginModal, 'Incorrect password.');
        return;
    }
    
    if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
    } else {
        localStorage.removeItem('rememberedEmail');
    }
    
    localStorage.setItem('currentUser', JSON.stringify(userData));
    currentUser = userData;
    authButton.textContent = 'Dashboard';
    
    checkLoginState(); 
    hideModal(loginModal);
    showView('dashboard'); 
}

function handleRegister(email, password) {
    if (localStorage.getItem(email)) {
        showAuthError(registerModal, 'Email already in use.');
        return;
    }
    
    const userData = {
        email: email,
        password: password, 
        name: 'Not set',
        locationEnabled: false,
        emailNotify: false, 
        lat: null,
        lng: null,
        phone: 'Not set'
    };
    
    localStorage.setItem(email, JSON.stringify(userData));
    localStorage.setItem('currentUser', JSON.stringify(userData));
    
    currentUser = userData;
    authButton.textContent = 'Dashboard';
    
    checkLoginState();
    hideModal(registerModal);
    showView('dashboard');
}

// --- Profile & Location Logic ---

function handleEditProfile(name, manualLat, manualLng, locationEnabled, emailNotify, phone) {
    if (!currentUser) return;

    let finalLat = null;
    let finalLng = null;

    if (locationEnabled) {
        const gpsLat = $('#gpsLat').value;
        const gpsLng = $('#gpsLng').value;
        if(gpsLat && gpsLng) {
            finalLat = parseFloat(gpsLat);
            finalLng = parseFloat(gpsLng);
        }
    } else {
        if(manualLat && manualLng) {
            finalLat = parseFloat(manualLat);
            finalLng = parseFloat(manualLng);
        }
    }

    if (locationEnabled && (finalLat === null || finalLng === null)) {
        alert('Please allow GPS access or disable location services before saving.');
        return;
    }
    
    if (!locationEnabled && finalLat && (isNaN(finalLat) || isNaN(finalLng))) {
        alert('Please enter valid numerical coordinates.');
        return;
    }


    currentUser.name = name;
    currentUser.locationEnabled = locationEnabled;
    currentUser.emailNotify = emailNotify;
    currentUser.lat = finalLat;
    currentUser.lng = finalLng;
    currentUser.phone = phone;

    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem(currentUser.email, JSON.stringify(currentUser)); 

    updateDashboardUI();
    
    $('#profileEditForm').style.display = 'none';
    $('#profileDisplay').style.display = 'grid';
    $('#editProfileButton').style.display = 'block';

    alert('Profile updated!');
    
    checkForRisks();
}

function updateDashboardUI() {
    if (!currentUser) return;

    $('#usernameDisplay').textContent = currentUser.email;
    $('#nameDisplay').textContent = currentUser.name || 'Not set';
    
    const displayLat = currentUser.lat ? currentUser.lat.toFixed(4) : null;
    const displayLng = currentUser.lng ? currentUser.lng.toFixed(4) : null;

    if (displayLat && displayLng) {
        const source = currentUser.locationEnabled ? 'GPS' : 'Manual';
        const color = currentUser.locationEnabled ? '#28a745' : '#ffa500';
        $('#locationDisplay').textContent = `${source}: ${displayLat}, ${displayLng}`;
        $('#locationDisplay').style.color = color;
    } else {
        $('#locationDisplay').textContent = 'Not set (Alerts disabled)';
        $('#locationDisplay').style.color = '#99a';
    }
    
    $('#phoneDisplay').textContent = currentUser.phone || 'Not set';

    // Pre-fill form
    $('#editName').value = currentUser.name !== 'Not set' ? currentUser.name : '';
    $('#editPhone').value = currentUser.phone !== 'Not set' ? currentUser.phone : '';
    
    // Email Notify Toggle
    $('#emailNotifyToggle').checked = currentUser.emailNotify || false;

    // Location UI State
    const toggle = $('#locationToggle');
    const statusText = $('#locationStatusText');
    const gpsOutput = $('#gpsOutput');
    const manualLat = $('#manualLat');
    const manualLng = $('#manualLng');

    if (currentUser.locationEnabled) {
        // GPS Mode
        toggle.checked = true;
        statusText.textContent = "Enabled (GPS)";
        statusText.style.color = "#28a745";
        
        if(currentUser.lat) {
            gpsOutput.textContent = `Current GPS: ${currentUser.lat.toFixed(4)}, ${currentUser.lng.toFixed(4)}`;
            gpsOutput.style.display = 'block';
            $('#gpsLat').value = currentUser.lat;
            $('#gpsLng').value = currentUser.lng;
        }
        
        manualLat.value = "";
        manualLng.value = "";
        manualLat.disabled = true;
        manualLng.disabled = true;
        
    } else {
        // Manual Mode
        toggle.checked = false;
        statusText.textContent = "Disabled (Manual Input Allowed)";
        statusText.style.color = "#99a";
        
        gpsOutput.style.display = 'none';
        
        manualLat.disabled = false;
        manualLng.disabled = false;
        
        if (currentUser.lat) {
            manualLat.value = currentUser.lat;
            manualLng.value = currentUser.lng;
        }
    }
    
    if (currentUser.lat) {
        checkForRisks();
    }
}

// --- Location Toggle Logic ---
function setupLocationToggle() {
    const toggle = $('#locationToggle');
    
    toggle.onclick = function(e) {
        e.preventDefault();
        if (toggle.classList.contains('active-state')) {
            toggle.checked = false;
            toggle.classList.remove('active-state');
            updateToggleUI(false);
            $('#manualLat').disabled = false;
            $('#manualLng').disabled = false;
        } else {
            showModal(locationPermissionModal);
        }
    };

    $('#btnAgreeLocation').onclick = handleAgreeLocation;
    $('#btnDisagreeLocation').onclick = handleDisagreeLocation;
}

function handleAgreeLocation(e) {
    e.preventDefault();
    hideModal(locationPermissionModal);
    
    const gpsOutput = $('#gpsOutput');
    gpsOutput.style.display = 'block';
    gpsOutput.textContent = "Locating...";
    gpsOutput.style.color = "#ffa500";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                const toggle = $('#locationToggle');
                toggle.checked = true;
                toggle.classList.add('active-state');
                
                $('#locationStatusText').textContent = "Enabled (GPS)";
                $('#locationStatusText').style.color = "#28a745";
                
                gpsOutput.textContent = `Success: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                gpsOutput.style.color = "#28a745";
                
                $('#gpsLat').value = lat;
                $('#gpsLng').value = lng;
                
                $('#manualLat').value = "";
                $('#manualLng').value = "";
                $('#manualLat').disabled = true;
                $('#manualLng').disabled = true;
            },
            (error) => {
                alert("Error getting location: " + error.message);
                handleDisagreeLocation(); 
            }
        );
    } else {
        alert("Geolocation not supported.");
        handleDisagreeLocation();
    }
}

function handleDisagreeLocation(e) {
    if(e) e.preventDefault();
    hideModal(locationPermissionModal);
    
    const toggle = $('#locationToggle');
    toggle.checked = false;
    toggle.classList.remove('active-state');
    
    $('#locationStatusText').textContent = "Disabled";
    $('#locationStatusText').style.color = "#99a";
    $('#gpsOutput').style.display = 'none';
    
    $('#manualLat').disabled = false;
    $('#manualLng').disabled = false;
}

function updateToggleUI(isChecked) {
    const statusText = $('#locationStatusText');
    const gpsOutput = $('#gpsOutput');
    
    if (isChecked) {
        statusText.textContent = "Enabled (GPS)";
        statusText.style.color = "#28a745";
    } else {
        statusText.textContent = "Disabled";
        statusText.style.color = "#99a";
        gpsOutput.style.display = 'none';
    }
}

function handleForgotPassword(email) {
    const successEl = $('#forgotSuccess');
    const errorEl = $('#forgotError');
    
    if (localStorage.getItem(email)) {
        successEl.textContent = 'SIMULATION: Password reset email sent!';
        successEl.style.display = 'block';
        errorEl.style.display = 'none';
    } else {
        showAuthError(forgotPasswordModal, 'Account not found.');
        successEl.style.display = 'none';
    }
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    authButton.textContent = 'Login';
    showView('map');
}

// --- Email Notification Logic (NEW) ---

function sendEmailAlert(alertData) {
    if (typeof emailjs === 'undefined') {
        console.error("EmailJS SDK not loaded.");
        return;
    }

    const templateParams = {
        to_name: currentUser.name || 'User',
        user_email: currentUser.email, 
        user_location: `${currentUser.lat.toFixed(2)}, ${currentUser.lng.toFixed(2)}`,
        disaster_type: alertData.type,
        disaster_title: alertData.title,
        time: alertData.time,
        distance: alertData.dist
    };

    emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, templateParams)
        .then(function(response) {
            console.log('Email sent successfully!', response.status, response.text);
            sentAlerts.add(alertData.title + alertData.time);
        }, function(error) {
            console.error('Failed to send email...', error);
        });
}

// --- Disaster Notification Logic ---

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function checkForRisks() {
    const notificationList = $('#notificationList');
    notificationList.innerHTML = '<li style="text-align: center;">Checking for risks...</li>';

    if (!currentUser || !currentUser.lat) {
        notificationList.innerHTML = '<li style="text-align: center; color: #e66;">Set location to see alerts.</li>';
        return;
    }

    const userLat = currentUser.lat;
    const userLng = currentUser.lng;
    const ALERT_RADIUS_KM = 2000; 

    let alerts = [];

    try {
        const eqUrl = usgsUrl({
            startISO: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
            minLat: -90, minLng: -180, maxLat: 90, maxLng: 180,
            minMag: 4.0 
        });
        const eqRes = await fetch(eqUrl);
        const eqJson = await eqRes.json();
        
        (eqJson.features || []).forEach(eq => {
            const eqLat = eq.geometry.coordinates[1];
            const eqLng = eq.geometry.coordinates[0];
            const dist = calculateDistance(userLat, userLng, eqLat, eqLng);
            
            if (dist <= ALERT_RADIUS_KM) {
                const alertData = {
                    type: 'Earthquake',
                    title: `M ${eq.properties.mag} - ${eq.properties.place}`,
                    time: new Date(eq.properties.time).toLocaleString(),
                    dist: dist.toFixed(0)
                };
                alerts.push(alertData);

                // Check if email enabled and not already sent
                if (currentUser.emailNotify && !sentAlerts.has(alertData.title + alertData.time)) {
                    sendEmailAlert(alertData);
                }
            }
        });

        const stormUrl = eonetUrl({ days: 10 }); 
        const stormRes = await fetch(stormUrl);
        const stormJson = await stormRes.json();

        (stormJson.events || []).forEach(storm => {
            const latestGeo = storm.geometry[storm.geometry.length - 1];
            const stormLat = latestGeo.coordinates[1];
            const stormLng = latestGeo.coordinates[0];
            const dist = calculateDistance(userLat, userLng, stormLat, stormLng);

            if (dist <= ALERT_RADIUS_KM) {
                const alertData = {
                    type: 'Storm',
                    title: storm.title,
                    time: new Date(latestGeo.date).toLocaleString(),
                    dist: dist.toFixed(0)
                };
                alerts.push(alertData);

                if (currentUser.emailNotify && !sentAlerts.has(alertData.title + alertData.time)) {
                    sendEmailAlert(alertData);
                }
            }
        });

        notificationList.innerHTML = '';
        if (alerts.length === 0) {
            notificationList.innerHTML = '<li style="text-align: center; color: #6e6;">No disasters within 2000km.</li>';
        } else {
            alerts.forEach(alert => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong style="color: #e66">${alert.type} (${alert.dist} km away)</strong>
                    <p style="margin: 5px 0;">${alert.title}</p>
                    <small>${alert.time}</small>
                `;
                notificationList.appendChild(li);
            });
        }

    } catch (e) {
        console.error(e);
        notificationList.innerHTML = '<li style="text-align: center; color: #e66;">Failed to fetch data.</li>';
    }
}


// --- Map & API Logic ---
const REGION_BBOX = {
    "usa": [24.5, -125.0, 49.5, -66.5],
    "japan": [24.0, 122.0, 46.0, 146.0],
    "philippines": [4.0, 116.0, 22.0, 127.0],
    "world": [-90, -180, 90, 180]
};

function setStatus(t) {
    if (!$('#status')) return;
    $('#status').textContent = t || '';
    if (t === 'Loading…') {
        if(loader) loader.style.display = 'flex';
    } else {
        if(loader) loader.style.display = 'none';
    }
}

function initMap() {
    if (!$('#map')) return;
    
    map = L.map('map').setView([37.5, -96], 4); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    dataLayer = L.layerGroup().addTo(map);
}

function usgsUrl({ startISO, minLat, minLng, maxLat, maxLng, minMag }) {
    const u = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
    u.searchParams.set('format', 'geojson');
    u.searchParams.set('starttime', startISO);
    u.searchParams.set('minlatitude', minLat);
    u.searchParams.set('minlongitude', minLng);
    u.searchParams.set('maxlatitude', maxLat);
    u.searchParams.set('maxlongitude', maxLng);
    if (minMag != null) u.searchParams.set('minmagnitude', String(minMag));
    return u.toString();
}

async function fetchEarthquakes(bbox, days, minMag) {
    const [minLat, minLng, maxLat, maxLng] = bbox;
    const start = new Date(Date.now() - Number(days) * 24 * 3600 * 1000);
    const startISO = start.toISOString();
    const url = usgsUrl({ startISO, minLat, minLng, maxLat, maxLng, minMag });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`USGS Error ${res.status}`);
    const json = await res.json();
    return (json.features || []).map(f => ({
        id: f.id,
        mag: f.properties?.mag ?? 0,
        title: f.properties?.place ?? 'Unknown Location',
        time: f.properties?.time ?? 0,
        url: f.properties?.url ?? '#',
        lat: f.geometry?.coordinates?.[1],
        lng: f.geometry?.coordinates?.[0]
    })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

function renderEarthquakes(rows) {
    dataLayer.clearLayers();
    rows.forEach(r => {
        L.circleMarker([r.lat, r.lng], {
            radius: Math.max(3, r.mag * 2.0),
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.7
        }).bindPopup(`<b>M ${r.mag.toFixed(1)}</b><br>${r.title}<br>${new Date(r.time).toLocaleString()}`)
          .addTo(dataLayer);
    });
    const list = $('#dataList');
    if(list) {
        list.innerHTML = '';
        rows.slice(0, 200).forEach(e => {
            const li = document.createElement('li');
            li.innerHTML = `<b>M ${e.mag.toFixed(1)}</b> — ${e.title}<br><small>${new Date(e.time).toLocaleString()}</small>`;
            li.addEventListener('click', () => map.flyTo([e.lat, e.lng], 6));
            list.appendChild(li);
        });
    }
}

function eonetUrl({ bbox, days }) {
    const u = new URL('https://eonet.gsfc.nasa.gov/api/v3/events');
    u.searchParams.set('category', 'severeStorms');
    u.searchParams.set('days', days);
    u.searchParams.set('status', 'open');
    if (NASA_API_KEY && NASA_API_KEY !== 'DEMO_KEY') {
        u.searchParams.set('api_key', NASA_API_KEY);
    }
    return u.toString();
}

async function fetchHurricanes(bbox, days) {
    const eonet_url = eonetUrl({ bbox, days });
    const res = await fetch(eonet_url);
    if (!res.ok) throw new Error(`EONET Error ${res.status}`);
    const json = await res.json();
    
    return (json.events || []).map(e => ({
        id: e.id,
        mag: 0,
        title: e.title ?? 'Unknown Storm',
        time: e.geometry?.[0]?.date ? new Date(e.geometry[0].date).getTime() : 0,
        url: e.sources?.[0]?.url ?? '#',
        lat: e.geometry?.[0]?.coordinates?.[1],
        lng: e.geometry?.[0]?.coordinates?.[0]
    })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

function renderHurricanes(rows) {
    dataLayer.clearLayers();
    rows.forEach(r => {
        L.circleMarker([r.lat, r.lng], {
            radius: 8,
            color: 'blue',
            fillColor: '#30f',
            fillOpacity: 0.7
        }).bindPopup(`<b>${r.title}</b><br>${new Date(r.time).toLocaleString()}`)
          .addTo(dataLayer);
    });
    
    const list = $('#dataList');
    if(list) {
        list.innerHTML = '';
        rows.slice(0, 200).forEach(e => {
            const li = document.createElement('li');
            li.innerHTML = `<b>${e.title}</b><br><small>${new Date(e.time).toLocaleString()}</small>`;
            li.addEventListener('click', () => map.flyTo([e.lat, e.lng], 6));
            list.appendChild(li);
        });
    }
}

function updateUI(disasterType) {
    const isEarthquake = disasterType === 'earthquake';
    const titleEl = $('#mainTitle');
    if(titleEl) titleEl.textContent = isEarthquake ? '🌎 Earthquake Management' : '🌀 Hurricane Management';
    
    const magInput = $('#minMagContainer');
    if(magInput) magInput.style.display = isEarthquake ? 'inline-block' : 'none';
}

async function runSearch() {
    const typeEl = document.querySelector('input[name="disasterType"]:checked');
    if(!typeEl) return;
    const disasterType = typeEl.value;
    
    const qEl = $('#q');
    const q = qEl ? qEl.value.trim().toLowerCase() : 'usa';
    
    const bbox = REGION_BBOX[q];
    if (!bbox) { alert('Unknown region. Try: USA, Japan, Philippines, or World'); return; }

    const daysEl = $('#days');
    const days = daysEl ? daysEl.value : 7;
    
    const regionTitle = $('#regionTitle');
    if(regionTitle) regionTitle.textContent = q.toUpperCase();
    
    if (map && q !== 'world') {
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]]);
    }
    
    if(dataLayer) dataLayer.clearLayers();
    const list = $('#dataList');
    if(list) list.innerHTML = '';

    try {
        setStatus('Loading…');
        let dataRows = [];
        if (disasterType === 'earthquake') {
            const minMagEl = $('#minMag');
            const minMag = minMagEl ? (Number(minMagEl.value) || 0) : 0;
            dataRows = await fetchEarthquakes(bbox, days, minMag);
            renderEarthquakes(dataRows);
        } else if (disasterType === 'hurricane') {
            dataRows = await fetchHurricanes(bbox, days);
            renderHurricanes(dataRows);
        }
        
        setStatus(`Found ${dataRows.length} events`);
    } catch (e) {
        console.error(e);
        setStatus('Error: ' + e.message);
    }
}

// --- App Startup ---
window.addEventListener('load', () => {
    initMap();
    loader = $('#loader');
    
    const form = $('#searchForm');
    if(form) form.addEventListener('submit', (e) => { e.preventDefault(); runSearch(); });
    
    document.querySelectorAll('input[name="disasterType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateUI(e.target.value);
            runSearch();
        });
    });

    if(authButton) authButton.addEventListener('click', () => {
        if (currentUser) {
            showView('dashboard');
        } else {
            showModal(loginModal);
        }
    });
    
    if(dashboardView) dashboardView.addEventListener('click', (e) => {
         if (e.target.id === 'logoutButton') {
             handleLogout();
         }
         if (e.target.id === 'backToMapButton') {
             showView('map');
         }
         if (e.target.id === 'editProfileButton') {
             $('#profileDisplay').style.display = 'none';
             $('#profileEditForm').style.display = 'block';
             $('#editProfileButton').style.display = 'none';
         }
         if (e.target.id === 'cancelEditButton') {
             $('#profileEditForm').style.display = 'none';
             $('#profileDisplay').style.display = 'grid';
             $('#editProfileButton').style.display = 'block';
         }
         if (e.target.id === 'checkRiskButton') {
             checkForRisks();
         }
    });

    document.querySelectorAll('[data-modal-close]').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal-overlay');
            if(modal) hideModal(modal);
        });
    });

    if($('#showRegisterLink')) $('#showRegisterLink').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal(loginModal);
        showModal(registerModal);
    });

    if($('#showLoginLink')) $('#showLoginLink').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal(registerModal);
        showModal(loginModal);
    });
    
    if($('#showForgotPassLink')) $('#showForgotPassLink').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal(loginModal);
        showModal(forgotPasswordModal);
    });
    
    if($('#backToLoginFromForgot')) $('#backToLoginFromForgot').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal(forgotPasswordModal);
        showModal(loginModal);
    });

    if($('#loginForm')) $('#loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = $('#loginEmail').value;
        const password = $('#loginPassword').value;
        const rememberMe = $('#rememberMe').checked;
        handleLogin(email, password, rememberMe);
    });

    if($('#registerForm')) $('#registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = $('#registerEmail').value;
        const password = $('#registerPassword').value;
        handleRegister(email, password);
    });
    
    if($('#forgotPasswordForm')) $('#forgotPasswordForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = $('#forgotEmail').value;
        handleForgotPassword(email);
    });

    if($('#profileEditForm')) $('#profileEditForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#editName').value;
        
        const locationEnabled = $('#locationToggle').checked;
        const emailNotify = $('#emailNotifyToggle').checked;
        let lat, lng;
        
        if (locationEnabled) {
            lat = $('#gpsLat').value; 
            lng = $('#gpsLng').value;
        } else {
            lat = $('#manualLat').value; 
            lng = $('#manualLng').value;
        }
        
        const phone = $('#editPhone').value;
        handleEditProfile(name, lat, lng, locationEnabled, emailNotify, phone);
    });
    
    setupLocationToggle(); 
    checkLoginState();
});