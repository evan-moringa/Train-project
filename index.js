document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. INITIALIZE MAP
    // ==========================================
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/dark',
        center: [22.2666, 60.4518], // Centered near Turku, zoomed out for regional view
        zoom: 7.5, 
        pitch: 45,
        bearing: 0,
        antialias: true 
    });

    let is3D = true;

    // ==========================================
    // 2. ADD 3D BUILDINGS LAYER
    // ==========================================
    map.on('load', () => {
        const layers = map.getStyle().layers;
        let labelLayerId;
        for (let i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol' && layers[i].layout['text-field']) {
                labelLayerId = layers[i].id;
                break;
            }
        }

        map.addLayer(
            {
                'id': '3d-buildings',
                'source': 'openmaptiles', 
                'source-layer': 'building',
                'type': 'fill-extrusion',
                'minzoom': 14, // Only render 3D buildings when zoomed into a city
                'paint': {
                    'fill-extrusion-color': '#2a2a2a', 
                    'fill-extrusion-height': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 0,
                        15.05, ['get', 'height']
                    ],
                    'fill-extrusion-base': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 0,
                        15.05, ['get', 'min_height']
                    ],
                    'fill-extrusion-opacity': 0.8 
                }
            },
            labelLayerId
        );
    });

    // ==========================================
    // 3. 2D / 3D TOGGLE BUTTON
    // ==========================================
    const toggleViewBtn = document.querySelector('.toggle-3d-btn');

    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', () => {
            is3D = !is3D;
            
            if (is3D) {
                toggleViewBtn.textContent = '2D'; 
                map.easeTo({ pitch: 45, duration: 1000 });
                if (map.getLayer('3d-buildings')) {
                    map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
                }
            } else {
                toggleViewBtn.textContent = '3D'; 
                map.easeTo({ pitch: 0, duration: 1000 }); // Flatten camera
                if (map.getLayer('3d-buildings')) {
                    map.setLayoutProperty('3d-buildings', 'visibility', 'none');
                }
            }
        });
    }

    // ==========================================
    // 4. LIVE DIGITRAFFIC TRACKING
    // ==========================================
    const trainMarkers = {};

    async function fetchLiveTrains() {
        try {
            const response = await fetch('https://rata.digitraffic.fi/api/v1/train-locations/latest');
            const trains = await response.json();
            
            const liveBadge = document.querySelector('.live-badge');
            if (liveBadge) {
                liveBadge.innerHTML = `<span class="live-dot"></span> ${trains.length} live trains`;
            }

            trains.forEach(train => {
                const trainId = train.trainNumber;
                
                // Format label based on API data (e.g., "Commuter 123" or "IC 45")
                const trainPrefix = train.trainCategory === 'Commuter' ? 'Commuter' : (train.trainType || '');
                const trainLabel = `${trainPrefix} ${trainId}`.trim();
                
                const coords = train.location.coordinates;
                
                if (trainMarkers[trainId]) {
                    // Move marker and update label if it already exists
                    trainMarkers[trainId].setLngLat(coords);
                    trainMarkers[trainId].getElement().textContent = trainLabel;
                } else {
                    // Create new marker
                    const el = document.createElement('div');
                    el.className = 'route-marker';
                    el.textContent = trainLabel;

                    const marker = new maplibregl.Marker({ element: el })
                        .setLngLat(coords)
                        .addTo(map);
                    trainMarkers[trainId] = marker;
                }
            });
        } catch (error) {
            console.error("Failed to fetch Digitraffic data:", error);
        }
    }

    // Fetch immediately, then poll every 5 seconds
    fetchLiveTrains();
    setInterval(fetchLiveTrains, 5000);

    // ==========================================
    // 5. STATION SCHEDULES & GEOLOCATION
    // ==========================================
    const stationPanel = document.getElementById('station-panel');
    const closePanelBtn = document.getElementById('close-panel');
    const findNearMeBtn = document.getElementById('find-near-me');
    const stationSelect = document.getElementById('station-select');
    const scheduleResults = document.getElementById('schedule-results');
    const currentStationTitle = document.getElementById('current-station-title');
    
    // Find the "Target" button in the side tools to open the panel
    const locationBtn = Array.from(document.querySelectorAll('.tool-btn')).find(btn => btn.textContent.includes('⌖'));

    let allStations = [];

    // Open/Close panel logic
    if (locationBtn && stationPanel) {
        locationBtn.addEventListener('click', () => stationPanel.classList.add('open'));
    }
    if (closePanelBtn && stationPanel) {
        closePanelBtn.addEventListener('click', () => stationPanel.classList.remove('open'));
    }

    // Fetch Station Metadata (Names and Coordinates)
    async function loadStations() {
        try {
            const res = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations');
            const data = await res.json();
            // Filter to passenger stations only
            allStations = data.filter(s => s.passengerTraffic === true);
            
            if (!stationSelect) return;
            // Populate the dropdown alphabetically
            allStations.sort((a,b) => a.stationName.localeCompare(b.stationName)).forEach(station => {
                const opt = document.createElement('option');
                opt.value = station.stationShortCode;
                opt.textContent = station.stationName.replace(" asema", ""); // Clean up name
                stationSelect.appendChild(opt);
            });
        } catch (err) { 
            console.error("Error loading stations:", err); 
        }
    }
    loadStations();

    // Fetch Live Schedule for a Station
    async function fetchStationSchedule(stationCode, stationName) {
        if (!currentStationTitle || !scheduleResults) return;
        
        currentStationTitle.textContent = `Loading ${stationName}...`;
        scheduleResults.innerHTML = '';
        
        try {
            // Fetch trains arriving/departing in the next 120 minutes
            const res = await fetch(`https://rata.digitraffic.fi/api/v1/live-trains/station/${stationCode}?minutes_before_departure=120&minutes_after_departure=0&minutes_before_arrival=120&minutes_after_arrival=0`);
            const trains = await res.json();
            
            if (trains.length === 0) {
                scheduleResults.innerHTML = '<div>No trains scheduled in the next 2 hours.</div>';
                currentStationTitle.textContent = stationName;
                return;
            }

            currentStationTitle.textContent = `${stationName} Schedule`;

            // Display up to 10 upcoming trains
            trains.slice(0, 10).forEach(train => {
                // Find the specific stop for this station in the train's timetable
                const stop = train.timeTableRows.find(row => row.stationShortCode === stationCode && row.trainStopping);
                if (!stop) return;

                const time = new Date(stop.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const type = stop.type === 'ARRIVAL' ? 'Arrives' : 'Departs';
                const colorClass = stop.type === 'ARRIVAL' ? 'time-arr' : 'time-dep';
                
                const trainPrefix = train.trainCategory === 'Commuter' ? 'Commuter' : (train.trainType || '');
                const trainName = `${trainPrefix} ${train.trainNumber}`.trim();
                const destination = train.timeTableRows[train.timeTableRows.length-1].stationShortCode;

                scheduleResults.innerHTML += `
                    <div class="schedule-item">
                        <div><strong>${trainName}</strong> <br> <small>${destination} bound</small></div>
                        <div class="${colorClass}">${type}<br><strong>${time}</strong></div>
                    </div>
                `;
            });
        } catch (err) {
            scheduleResults.innerHTML = '<div>Error loading schedule.</div>';
        }
    }

    // Manual Selection listener
    if (stationSelect) {
        stationSelect.addEventListener('change', (e) => {
            const code = e.target.value;
            const name = e.target.options[e.target.selectedIndex].text;
            fetchStationSchedule(code, name);
        });
    }

    // Geolocation: Find Nearest Station
    if (findNearMeBtn) {
        findNearMeBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser");
                return;
            }

            findNearMeBtn.textContent = "Locating...";
            
            navigator.geolocation.getCurrentPosition(position => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;
                
                let closestStation = null;
                let minDistance = Infinity;

                // Simple distance calculation formula (Haversine approximation)
                allStations.forEach(station => {
                    const dLat = (station.latitude - userLat) * Math.PI / 180;
                    const dLon = (station.longitude - userLon) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                              Math.cos(userLat * Math.PI / 180) * Math.cos(station.latitude * Math.PI / 180) *
                              Math.sin(dLon/2) * Math.sin(dLon/2);
                    const distance = 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); // Distance in km

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestStation = station;
                    }
                });

                if (closestStation) {
                    findNearMeBtn.textContent = "📍 Find Nearest Station";
                    // Fly the map to the nearest station
                    map.flyTo({ center: [closestStation.longitude, closestStation.latitude], zoom: 14 });
                    
                    // Fetch the schedule
                    const cleanName = closestStation.stationName.replace(" asema", "");
                    if (stationSelect) stationSelect.value = closestStation.stationShortCode;
                    fetchStationSchedule(closestStation.stationShortCode, cleanName);
                }
            }, () => {
                alert("Unable to retrieve your location. Please check browser permissions.");
                findNearMeBtn.textContent = "📍 Find Nearest Station";
            });
        });
    }
});