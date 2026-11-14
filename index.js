document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. INITIALIZE MAP & 3D BUILDINGS
    // ==========================================
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/dark',
        center: [22.2666, 60.4518],
        zoom: 7.5, 
        pitch: 45,
        bearing: 0,
        antialias: true 
    });

    let is3D = true;
    let railwayNetworkGeoJSON = null;

    // Create floating "Clear Route" banner dynamically
    const clearBanner = document.createElement('div');
    clearBanner.className = 'clear-route-banner';
    clearBanner.innerHTML = `<span id="active-route-label">Route Active</span> <button class="clear-route-btn" id="clear-route-btn">✕</button>`;
    document.body.appendChild(clearBanner);

    document.getElementById('clear-route-btn').addEventListener('click', clearHighlightedRoute);

    map.on('load', () => {
        const layers = map.getStyle().layers;
        let labelLayerId;
        for (let i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol' && layers[i].layout['text-field']) {
                labelLayerId = layers[i].id; break;
            }
        }

        // 3D Buildings Layer
        map.addLayer({
            'id': '3d-buildings',
            'source': 'openmaptiles', 
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 14,
            'paint': {
                'fill-extrusion-color': '#2a2a2a', 
                'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.05, ['get', 'height']],
                'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.05, ['get', 'min_height']],
                'fill-extrusion-opacity': 0.8 
            }
        }, labelLayerId);

        // Initialize Empty Sources & Layers for Exact Railway Route Highlighting
        map.addSource('highlighted-rail-geometry', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        map.addSource('highlighted-route-stops', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        // Outer Neon Glow for the Railway Track
        map.addLayer({
            id: 'active-rail-glow',
            type: 'line',
            source: 'highlighted-rail-geometry',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': '#00BFA5',
                'line-width': 10,
                'line-opacity': 0.35,
                'line-blur': 4
            }
        }, labelLayerId);

        // Core Crisp Track Line
        map.addLayer({
            id: 'active-rail-line',
            type: 'line',
            source: 'highlighted-rail-geometry',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': '#00E676',
                'line-width': 4,
                'line-opacity': 0.95
            }
        }, labelLayerId);

        // Station Stop Dots along the Active Route
        map.addLayer({
            id: 'active-route-stop-dots',
            type: 'circle',
            source: 'highlighted-route-stops',
            paint: {
                'circle-radius': 6,
                'circle-color': '#FFD600',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#1a1a1a'
            }
        });

        // Fetch Exact Finnish Railway Track Geometry from Digitraffic Infra API
        loadExactRailwayGeometry();
    });

    async function loadExactRailwayGeometry() {
        try {
            // Digitraffic Infra API provides exact curved railway track segments (rataosat)
            const res = await fetch('https://rata.digitraffic.fi/infra-api/0.7/rataosat.geojson');
            if (res.ok) {
                railwayNetworkGeoJSON = await res.json();
                console.log("Loaded exact Finnish railway geometry:", railwayNetworkGeoJSON.features.length, "track segments");
            }
        } catch (err) {
            console.warn("Could not load full infra geometry, will use station-to-station fallback:", err);
        }
    }

    // Helper: Distance from a point [lon, lat] to a line segment [A, B] in km
    function pointToSegmentDistanceKm(p, a, b) {
        const x = p[0], y = p[1];
        const x1 = a[0], y1 = a[1];
        const x2 = b[0], y2 = b[1];

        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; }
        else if (param > 1) { xx = x2; yy = y2; }
        else { xx = x1 + param * C; yy = y1 + param * D; }

        const dx = (x - xx) * 111.32 * Math.cos(y * Math.PI / 180);
        const dy = (y - yy) * 110.57;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Highlight Exact Railway Track for a Clicked Train
    function highlightTrainRoute(trainObj, trainLabel) {
        if (!trainObj || !trainObj.timeTableRows || allStations.length === 0) return;

        // 1. Extract unique ordered stations along this train's route
        const orderedCoords = [];
        const stopFeatures = [];
        const seenStations = new Set();

        trainObj.timeTableRows.forEach(row => {
            const st = allStations.find(s => s.stationShortCode === row.stationShortCode);
            if (st) {
                const coord = [st.longitude, st.latitude];
                if (orderedCoords.length === 0 || 
                    orderedCoords[orderedCoords.length - 1][0] !== coord[0] || 
                    orderedCoords[orderedCoords.length - 1][1] !== coord[1]) {
                    orderedCoords.push(coord);
                }

                if (row.trainStopping && !seenStations.has(st.stationShortCode)) {
                    seenStations.add(st.stationShortCode);
                    stopFeatures.push({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: coord },
                        properties: { name: st.stationName.replace(" asema", "") }
                    });
                }
            }
        });

        if (orderedCoords.length < 2) return;

        // 2. Match exact curved railway track segments against the train's corridor
        let matchedFeatures = [];

        if (railwayNetworkGeoJSON && railwayNetworkGeoJSON.features) {
            // Build bounding box around the route with a small buffer
            let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
            orderedCoords.forEach(c => {
                if (c[0] < minLon) minLon = c[0];
                if (c[0] > maxLon) maxLon = c[0];
                if (c[1] < minLat) minLat = c[1];
                if (c[1] > maxLat) maxLat = c[1];
            });
            minLon -= 0.15; maxLon += 0.15;
            minLat -= 0.15; maxLat += 0.15;

            railwayNetworkGeoJSON.features.forEach(feature => {
                if (!feature.geometry) return;
                const geomType = feature.geometry.type;
                const lines = geomType === 'LineString' ? [feature.geometry.coordinates] :
                              geomType === 'MultiLineString' ? feature.geometry.coordinates : [];

                for (const line of lines) {
                    if (line.length === 0) continue;
                    // Quick bounding box rejection
                    const midPt = line[Math.floor(line.length / 2)];
                    if (midPt[0] < minLon || midPt[0] > maxLon || midPt[1] < minLat || midPt[1] > maxLat) continue;

                    // Check if start, middle, and end of this track segment lie within 2.5 km of the train's station corridor
                    const samplePts = [line[0], midPt, line[line.length - 1]];
                    const allClose = samplePts.every(pt => {
                        for (let i = 0; i < orderedCoords.length - 1; i++) {
                            if (pointToSegmentDistanceKm(pt, orderedCoords[i], orderedCoords[i + 1]) < 2.5) {
                                return true;
                            }
                        }
                        return false;
                    });

                    if (allClose) {
                        matchedFeatures.push(feature);
                        break;
                    }
                }
            });
        }

        // Fallback to station-to-station line if infra API didn't return segments
        if (matchedFeatures.length === 0) {
            matchedFeatures = [{
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: orderedCoords }
            }];
        }

        // 3. Update MapLibre Sources
        if (map.getSource('highlighted-rail-geometry')) {
            map.getSource('highlighted-rail-geometry').setData({
                type: 'FeatureCollection',
                features: matchedFeatures
            });
        }
        if (map.getSource('highlighted-route-stops')) {
            map.getSource('highlighted-route-stops').setData({
                type: 'FeatureCollection',
                features: stopFeatures
            });
        }

        // Show "Clear Route" banner
        const labelEl = document.getElementById('active-route-label');
        if (labelEl) labelEl.textContent = `🛤️ ${trainLabel} Route`;
        clearBanner.classList.add('visible');
    }

    function clearHighlightedRoute() {
        if (map.getSource('highlighted-rail-geometry')) {
            map.getSource('highlighted-rail-geometry').setData({ type: 'FeatureCollection', features: [] });
        }
        if (map.getSource('highlighted-route-stops')) {
            map.getSource('highlighted-route-stops').setData({ type: 'FeatureCollection', features: [] });
        }
        clearBanner.classList.remove('visible');
    }

    const toggleViewBtn = document.querySelector('.toggle-3d-btn');
    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', () => {
            is3D = !is3D;
            toggleViewBtn.textContent = is3D ? '2D' : '3D'; 
            map.easeTo({ pitch: is3D ? 45 : 0, duration: 1000 });
            if (map.getLayer('3d-buildings')) map.setLayoutProperty('3d-buildings', 'visibility', is3D ? 'visible' : 'none');
        });
    }

    // ==========================================
    // 2. LOAD STATION METADATA & MAP ICONS
    // ==========================================
    let allStations = [];

    async function loadStations() {
        try {
            const res = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations');
            allStations = await res.json();
            
            const stationSelect = document.getElementById('station-select');
            const passengerStations = allStations.filter(s => s.passengerTraffic === true);

            if (stationSelect) {
                passengerStations.sort((a,b) => a.stationName.localeCompare(b.stationName)).forEach(station => {
                    const opt = document.createElement('option');
                    opt.value = station.stationShortCode;
                    opt.textContent = station.stationName.replace(" asema", "");
                    stationSelect.appendChild(opt);
                });
            }

            function drawStationLayer() {
                if (map.getSource('stations')) return;
                const features = passengerStations.map(s => ({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
                    properties: { name: s.stationName.replace(" asema", ""), code: s.stationShortCode }
                }));

                map.addSource('stations', { type: 'geojson', data: { type: 'FeatureCollection', features: features } });

                map.addLayer({
                    id: 'stations-layer',
                    type: 'circle',
                    source: 'stations',
                    paint: { 'circle-radius': 5, 'circle-color': '#1a1a1a', 'circle-stroke-width': 2, 'circle-stroke-color': '#00BFA5' }
                });

                map.on('click', 'stations-layer', (e) => {
                    const props = e.features[0].properties;
                    new maplibregl.Popup({ offset: 10, closeButton: false })
                        .setLngLat(e.lngLat)
                        .setHTML(`<div style="font-weight: bold; font-family: Inter, sans-serif; font-size: 14px;">📍 ${props.name}</div>`)
                        .addTo(map);

                    const stationPanel = document.getElementById('station-panel');
                    if (stationPanel) stationPanel.classList.add('open');
                    if (stationSelect) stationSelect.value = props.code;
                    fetchStationSchedule(props.code, props.name);
                });

                map.on('mouseenter', 'stations-layer', () => map.getCanvas().style.cursor = 'pointer');
                map.on('mouseleave', 'stations-layer', () => map.getCanvas().style.cursor = '');
            }

            if (map.isStyleLoaded()) { drawStationLayer(); } 
            else { map.on('style.load', drawStationLayer); }

        } catch (err) { console.error("Error loading stations:", err); }
    }
    loadStations();

    // ==========================================
    // 3. SETTINGS & LIVE TRACKING LOOP
    // ==========================================
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-panel');
    const settingsPanel = document.getElementById('settings-panel');
    const filterCommuter = document.getElementById('filter-commuter');
    const filterLongDist = document.getElementById('filter-longdist');
    const refreshRateSelect = document.getElementById('refresh-rate');

    let currentRefreshInterval = 5000;
    let trainFetchTimer = null;
    const trainMarkers = {};

    if (openSettingsBtn && settingsPanel) openSettingsBtn.addEventListener('click', () => settingsPanel.classList.add('open'));
    if (closeSettingsBtn && settingsPanel) closeSettingsBtn.addEventListener('click', () => settingsPanel.classList.remove('open'));

    function applyTrainFilters() {
        const showCommuter = filterCommuter ? filterCommuter.checked : true;
        const showLongDist = filterLongDist ? filterLongDist.checked : true;

        Object.values(trainMarkers).forEach(marker => {
            const label = marker.getElement().textContent;
            let isCommuter = label.includes('Commuter');
            let isLongDist = !isCommuter;
            
            if ((isCommuter && showCommuter) || (isLongDist && showLongDist)) {
                marker.getElement().style.display = 'block';
            } else {
                marker.getElement().style.display = 'none';
            }
        });
    }

    if (filterCommuter) filterCommuter.addEventListener('change', applyTrainFilters);
    if (filterLongDist) filterLongDist.addEventListener('change', applyTrainFilters);

    async function fetchLiveTrains() {
        try {
            const response = await fetch('https://rata.digitraffic.fi/api/v1/train-locations/latest');
            const trains = await response.json();
            
            const liveBadge = document.querySelector('.live-badge');
            if (liveBadge) liveBadge.innerHTML = `<span class="live-dot"></span> ${trains.length} live trains`;

            trains.forEach(train => {
                const trainId = train.trainNumber;
                const coords = train.location.coordinates;
                const speed = train.speed || 0;
                
                if (trainMarkers[trainId]) {
                    trainMarkers[trainId].setLngLat(coords);
                    trainMarkers[trainId].currentSpeed = speed; 
                } else {
                    const el = document.createElement('div');
                    el.className = 'route-marker';
                    el.textContent = trainId;

                    const popup = new maplibregl.Popup({ offset: 25, closeButton: true, closeOnClick: false })
                        .setHTML(`<div style="font-family: 'Inter', sans-serif; padding: 10px;">Loading schedule & track...</div>`);

                    popup.on('open', async () => {
                        try {
                            const currentSpeed = trainMarkers[trainId].currentSpeed || 0;
                            const res = await fetch(`https://rata.digitraffic.fi/api/v1/trains/latest/${trainId}`);
                            const dataList = await res.json();
                            
                            if (dataList && dataList.length > 0) {
                                const t = dataList[0];
                                const stops = t.timeTableRows.filter(row => row.trainStopping);
                                
                                const finalStopCode = stops.length > 0 ? stops[stops.length - 1].stationShortCode : "Unknown";
                                const destObj = allStations.find(s => s.stationShortCode === finalStopCode);
                                const finalStopName = destObj ? destObj.stationName.replace(" asema", "") : finalStopCode;
                                
                                const now = new Date();
                                const nextStop = stops.find(row => new Date(row.liveEstimateTime || row.scheduledTime) > now && row.type === 'ARRIVAL');
                                const nextStopCode = nextStop ? nextStop.stationShortCode : null;
                                const nextObj = nextStopCode ? allStations.find(s => s.stationShortCode === nextStopCode) : null;
                                const nextStopName = nextObj ? nextObj.stationName.replace(" asema", "") : (nextStopCode || "End of Line");

                                const prefix = t.trainCategory === 'Commuter' ? 'Commuter' : (t.trainType || 'Train');
                                const fullLabel = `${prefix} ${trainId}`.trim();
                                trainMarkers[trainId].getElement().textContent = fullLabel;

                                // Highlight exact curved railway geometry for this train
                                highlightTrainRoute(t, fullLabel);

                                popup.setHTML(`
                                    <div style="font-family: 'Inter', sans-serif; min-width: 180px;">
                                        <h4 style="margin:0 0 5px 0; border-bottom:1px solid #444; padding-bottom:5px;">${fullLabel}</h4>
                                        <div style="font-size:13px; margin-bottom:5px;">Speed: <span class="popup-speed">${currentSpeed} km/h</span></div>
                                        <div style="font-size:13px; margin-bottom:5px;">Next Stop: <span style="color: #00E676; font-weight: bold;">${nextStopName}</span></div>
                                        <div style="font-size:13px;">Bound for: <span class="popup-destination">${finalStopName}</span></div>
                                    </div>
                                `);
                            } else { popup.setHTML(`<div style="font-family: 'Inter', sans-serif;">Data unavailable</div>`); }
                        } catch (e) { popup.setHTML(`<div style="font-family: 'Inter', sans-serif;">Error loading details</div>`); }
                    });

                    const marker = new maplibregl.Marker({ element: el })
                        .setLngLat(coords)
                        .setPopup(popup)
                        .addTo(map);
                        
                    marker.currentSpeed = speed; 
                    trainMarkers[trainId] = marker;
                }
            });
            applyTrainFilters(); 
        } catch (error) { console.error("Failed to fetch locations:", error); }
    }

    function startTrainPolling(intervalMs) {
        if (trainFetchTimer) clearInterval(trainFetchTimer);
        fetchLiveTrains(); 
        trainFetchTimer = setInterval(fetchLiveTrains, intervalMs);
    }

    if (refreshRateSelect) {
        refreshRateSelect.addEventListener('change', (e) => {
            currentRefreshInterval = parseInt(e.target.value, 10);
            startTrainPolling(currentRefreshInterval);
        });
    }

    startTrainPolling(currentRefreshInterval);

    // ==========================================
    // 4. ROUTE PLANNER SEARCH LOGIC
    // ==========================================
    const openRouteBtn = document.getElementById('open-route-planner');
    const closeRouteBtn = document.getElementById('close-route-panel');
    const routePanel = document.getElementById('route-panel');
    const mainBottomNav = document.getElementById('main-bottom-nav');
    
    const searchRoutesBtn = document.getElementById('search-routes-btn');
    const routeFromInput = document.getElementById('route-from');
    const routeToInput = document.getElementById('route-to');
    const routeResults = document.getElementById('route-results-container');

    if (openRouteBtn && routePanel) {
        openRouteBtn.addEventListener('click', () => { routePanel.classList.add('open'); mainBottomNav.style.display = 'none'; });
    }
    if (closeRouteBtn && routePanel) {
        closeRouteBtn.addEventListener('click', () => { routePanel.classList.remove('open'); mainBottomNav.style.display = 'flex'; });
    }

    if (searchRoutesBtn) {
        searchRoutesBtn.addEventListener('click', async () => {
            routeResults.innerHTML = '<div style="text-align: center;">Searching for connections...</div>';
            const fromText = routeFromInput.value.trim().toLowerCase();
            const toText = routeToInput.value.trim().toLowerCase();
            const findStation = (text) => allStations.find(s => s.stationName.toLowerCase().includes(text) || s.stationShortCode.toLowerCase() === text);
            const fromStation = findStation(fromText);
            const toStation = findStation(toText);

            if (!fromStation || !toStation) {
                routeResults.innerHTML = '<div style="color: #ff5252;">Could not find one or both stations. Try "Turku" or "Helsinki".</div>';
                return;
            }

            try {
                const res = await fetch(`https://rata.digitraffic.fi/api/v1/live-trains/station/${fromStation.stationShortCode}/${toStation.stationShortCode}`);
                const routes = await res.json();
                if (routes.length === 0) { routeResults.innerHTML = '<div>No direct routes found right now.</div>'; return; }
                routeResults.innerHTML = '';
                
                routes.slice(0, 5).forEach(train => {
                    const dep = train.timeTableRows.find(r => r.stationShortCode === fromStation.stationShortCode && r.type === 'DEPARTURE');
                    const arr = train.timeTableRows.find(r => r.stationShortCode === toStation.stationShortCode && r.type === 'ARRIVAL');
                    if (!dep || !arr) return;

                    const depTime = new Date(dep.liveEstimateTime || dep.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const arrTime = new Date(arr.liveEstimateTime || arr.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const trainPrefix = train.trainCategory === 'Commuter' ? 'Commuter' : (train.trainType || '');

                    routeResults.innerHTML += `
                        <div class="route-result-card">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <strong>${trainPrefix} ${train.trainNumber}</strong>
                                <span style="color: #888; font-size: 12px;">Direct</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px;">
                                <span><span style="color: #F5A623;">${depTime}</span> ${fromStation.stationName.replace(" asema", "")}</span>
                                <span>➔</span>
                                <span><span style="color: #00E676;">${arrTime}</span> ${toStation.stationName.replace(" asema", "")}</span>
                            </div>
                        </div>
                    `;
                });
            } catch (err) { routeResults.innerHTML = '<div style="color: #ff5252;">Error loading route schedule.</div>'; }
        });
    }

    // ==========================================
    // 5. SIDE PANEL (STATION SCHEDULE) & USER GPS
    // ==========================================
    const stationPanel = document.getElementById('station-panel');
    const closePanelBtn = document.getElementById('close-panel');
    const findNearMeBtn = document.getElementById('find-near-me');
    const stationSelect = document.getElementById('station-select');
    const scheduleResults = document.getElementById('schedule-results');
    const currentStationTitle = document.getElementById('current-station-title');
    const locationBtn = document.querySelector('.location-btn');
    let userMarker = null;

    function locateUser(callback) {
        if (!navigator.geolocation) { alert("Geolocation not supported."); return; }
        navigator.geolocation.getCurrentPosition(position => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            
            if (!userMarker) {
                const el = document.createElement('div');
                el.className = 'user-marker';
                userMarker = new maplibregl.Marker({ element: el }).setLngLat([userLon, userLat]).addTo(map);
            } else {
                userMarker.setLngLat([userLon, userLat]);
            }
            if (callback) callback(userLat, userLon);
        }, () => { alert("Unable to retrieve location."); });
    }

    if (locationBtn && stationPanel) locationBtn.addEventListener('click', () => { stationPanel.classList.add('open'); locateUser(); });
    if (closePanelBtn && stationPanel) closePanelBtn.addEventListener('click', () => stationPanel.classList.remove('open'));

    async function fetchStationSchedule(stationCode, stationName) {
        if (!currentStationTitle || !scheduleResults) return;
        currentStationTitle.textContent = `Loading ${stationName}...`;
        scheduleResults.innerHTML = '';
        
        try {
            const res = await fetch(`https://rata.digitraffic.fi/api/v1/live-trains/station/${stationCode}?minutes_before_departure=120&minutes_after_departure=0&minutes_before_arrival=120&minutes_after_arrival=0`);
            const trains = await res.json();
            
            if (trains.length === 0) {
                scheduleResults.innerHTML = '<div>No trains scheduled in the next 2 hours.</div>';
                currentStationTitle.textContent = stationName;
                return;
            }

            currentStationTitle.textContent = `${stationName} Schedule`;

            trains.slice(0, 10).forEach(train => {
                const stop = train.timeTableRows.find(row => row.stationShortCode === stationCode && row.trainStopping);
                if (!stop) return;

                const time = new Date(stop.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const type = stop.type === 'ARRIVAL' ? 'Arrives' : 'Departs';
                const colorClass = stop.type === 'ARRIVAL' ? 'time-arr' : 'time-dep';
                
                const trainPrefix = train.trainCategory === 'Commuter' ? 'Commuter' : (train.trainType || '');
                const trainName = `${trainPrefix} ${train.trainNumber}`.trim();
                const destCode = train.timeTableRows[train.timeTableRows.length-1].stationShortCode;
                const destObj = allStations.find(s => s.stationShortCode === destCode);
                const destName = destObj ? destObj.stationName.replace(" asema", "") : destCode;

                scheduleResults.innerHTML += `
                    <div class="schedule-item">
                        <div><strong>${trainName}</strong> <br> <small>${destName} bound</small></div>
                        <div class="${colorClass}">${type}<br><strong>${time}</strong></div>
                    </div>
                `;
            });
        } catch (err) { scheduleResults.innerHTML = '<div>Error loading schedule.</div>'; }
    }

    if (stationSelect) {
        stationSelect.addEventListener('change', (e) => {
            const code = e.target.value;
            const name = e.target.options[e.target.selectedIndex].text;
            fetchStationSchedule(code, name);
        });
    }

    if (findNearMeBtn) {
        findNearMeBtn.addEventListener('click', () => {
            findNearMeBtn.textContent = "Locating...";
            locateUser((userLat, userLon) => {
                let closestStation = null;
                let minDistance = Infinity;

                allStations.forEach(station => {
                    const dLat = (station.latitude - userLat) * Math.PI / 180;
                    const dLon = (station.longitude - userLon) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(userLat * Math.PI / 180) * Math.cos(station.latitude * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                    const distance = 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
                    if (distance < minDistance) { minDistance = distance; closestStation = station; }
                });

                if (closestStation) {
                    findNearMeBtn.textContent = "📍 Find Nearest Station";
                    map.flyTo({ center: [closestStation.longitude, closestStation.latitude], zoom: 14 });
                    const cleanName = closestStation.stationName.replace(" asema", "");
                    if (stationSelect) stationSelect.value = closestStation.stationShortCode;
                    fetchStationSchedule(closestStation.stationShortCode, cleanName);
                } else { findNearMeBtn.textContent = "📍 Find Nearest Station"; }
            });
        });
    }
});