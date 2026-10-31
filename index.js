document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. LIVE MAP & DIGITRAFFIC INTEGRATION
    // ==========================================
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [22.2666, 60.4518], // Turku
        zoom: 7,
        pitch: 45,
        bearing: 0
    });

    const trainMarkers = {};

    async function fetchLiveTrains() {
        try {
            const response = await fetch('https://rata.digitraffic.fi/api/v1/train-locations/latest');
            const trains = await response.json();
            
            const liveBadge = document.querySelector('.live-badge');
            if (liveBadge) {
                liveBadge.innerHTML = `<span class="live-dot"></span> ${trains.length} live`;
            }

            trains.forEach(train => {
                const trainId = train.trainNumber;
                const coords = train.location.coordinates;
                
                if (trainMarkers[trainId]) {
                    trainMarkers[trainId].setLngLat(coords);
                } else {
                    const el = document.createElement('div');
                    el.className = 'route-marker marker-green';
                    el.textContent = trainId;

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

    fetchLiveTrains();
    setInterval(fetchLiveTrains, 5000); // Poll every 5 seconds


    // ==========================================
    // 2. RENDER API: TRAIN INFO FETCHING
    // ==========================================
    const apiUrl = "https://trains-project.onrender.com/trains";
    
    // Initial console check
    fetch(apiUrl)
        .then(res => res.json())
        .then(data => console.log("Render API Data:", data))
        .catch(err => console.error("Render API Error:", err));

    const selectTrainElement = document.getElementById("select-train");
    const getTrainInfoButton = document.getElementById("get-train-info-button");

    if (getTrainInfoButton) {
        getTrainInfoButton.addEventListener("click", () => {
            const selectedTrainId = selectTrainElement.value;

            fetch(`${apiUrl}/${selectedTrainId}`)
                .then(response => {
                    if (!response.ok) throw new Error("Network response was not ok");
                    return response.json();
                })
                .then(data => {
                    alert(`Selected Train Information:\nArrival Time: ${data.arrival_time}\nDeparture Time: ${data.departure_time}`);
                })
                .catch(error => {
                    console.error("Error fetching train data:", error);
                    alert("Error fetching train data.");
                });
        });
    }


    // ==========================================
    // 3. TICKET BOOKING LOGIC
    // ==========================================
    const bookingForm = document.getElementById("ticket-booking-form");
    const availableTicketsElement = document.getElementById("available-tickets");
    let availableTickets = 100; 

    function updateAvailableTickets() {
        if (availableTicketsElement) {
            availableTicketsElement.textContent = availableTickets;
        }
    }

    if (bookingForm) {
        bookingForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const passengerName = document.getElementById("passenger-name").value;
            const numTickets = parseInt(document.getElementById("num-tickets").value, 10);

            if (numTickets > 0 && numTickets <= availableTickets) {
                availableTickets -= numTickets;
                updateAvailableTickets();
                
                alert(`Tickets booked successfully for ${passengerName}!`);
                bookingForm.reset(); // Clears inputs after successful booking
            } else {
                alert("Invalid number of tickets or not enough tickets available.");
            }
        });
    }

    updateAvailableTickets();
});

    

