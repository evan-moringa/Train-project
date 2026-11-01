document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Initialize Map (Zoomed out for regional trains)
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/dark',
        center: [22.2666, 60.4518], // Centered near Turku, but zoomed out to see more of Finland
        zoom: 7.5, 
        pitch: 45,
        bearing: 0,
        antialias: true 
    });

    let is3D = true;

    // 2. Add 3D Buildings (visible when users manually zoom in closer to cities)
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

    // 3. 2D / 3D Toggle Button
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

    // 4. Live Digitraffic Tracking
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

});