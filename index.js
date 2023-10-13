fetch(`http://localhost:3000/trains/`)
.then (res => res.json)
.then (data => {
    console.log(data);
    fetchAndDisplayTrainInfo(data);
})


document.addEventListener("DOMContentLoaded", function () {
    const trainInfoElement = document.getElementById("train-info");

    // Replace with the URL of your train information API
    const api_Url = `http://localhost:3000/trains/`;

    // Function to fetch and display train information
    function fetchAndDisplayTrainInfo() {
        fetch(api_Url)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }
                return response.json();
            })
            .then((data) => {
                const trainData = data.trains;

                if (trainData.length === 0) {
                    trainInfoElement.innerHTML = "No train information available.";
                } else {
                    trainInfoElement.innerHTML = ""; // Clear previous data

                    trainData.forEach((train) => {
                        const trainDiv = document.createElement("div");
                        trainDiv.className = "train-info";

                        const trainImage = document.createElement("img");
                        trainImage.src = train.image_url; // Replace with the actual image URL

                        const trainName = document.createElement("h2");
                        trainName.textContent = `Train: ${train.train_name}`;

                        const departureTime = document.createElement("p");
                        departureTime.textContent = `Departure Time: ${train.departure_time}`;

                        const arrivalTime = document.createElement("p");
                        arrivalTime.textContent = `Arrival Time: ${train.arrival_time}`;

                        trainDiv.appendChild(trainImage);
                        trainDiv.appendChild(trainName);
                        trainDiv.appendChild(departureTime);
                        trainDiv.appendChild(arrivalTime);

                        trainInfoElement.appendChild(trainDiv);
                    });
                }
            })
        
    }

    // Initial data load when the page loads
    fetchAndDisplayTrainInfo(api_Url);
});

document.addEventListener("DOMContentLoaded", function () {
    const bookingForm = document.getElementById("ticket-booking-form");
    const availableTicketsElement = document.getElementById("available-tickets");

    let availableTickets = 100; // The initial number of available tickets

    // Function to update available tickets and display the count
    function updateAvailableTickets() {
        availableTicketsElement.textContent = availableTickets;
    }

    // Event handler for form submission
    bookingForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const passengerName = document.getElementById("passenger-name").value;
        const numTickets = parseInt(document.getElementById("num-tickets").value, 10);

        if (numTickets > 0 && numTickets <= availableTickets) {
            availableTickets -= numTickets;

            // Update the available ticket count
            updateAvailableTickets();

            // Show a success message or perform other actions (e.g., display a confirmation modal).
            alert(`Tickets booked successfully for ${passengerName}!`);
        } else {
            alert("Invalid number of tickets or not enough tickets available.");
        }
    });

    // Initialize and display the available ticket count
    updateAvailableTickets();
});



    

