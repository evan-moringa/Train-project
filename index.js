fetch(`https://trains-project.onrender.com/trains/`)
.then (res => res.json)
.then (data => {
    console.log(data);
    
})

document.addEventListener("DOMContentLoaded", function () {
    const trainInfoElement = document.getElementById("train-info");
    const selectTrainElement = document.getElementById("select-train");
    const getTrainInfoButton = document.getElementById("get-train-info-button");

    // Replace with the URL of your train information API
    const apiUrl = "https://trains-project.onrender.com/trains/";

    // Function to fetch and display train information for the selected train
    function fetchAndDisplaySelectedTrainInfo() {
        const selectedTrainId = selectTrainElement.value;

        fetch(`${apiUrl}/${selectedTrainId}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }
                return response.json();
            })
            .then((data) => {
                // Display the selected train arrival and departure times
                const arrivalTime = data.arrival_time;
                const departureTime = data.departure_time;

                alert(`Selected Train Information:Arrival Time: ${arrivalTime} Departure Time: ${departureTime}`);
            })
            .catch((error) => {
                console.error("Error fetching train data:", error);
                trainInfoElement.textContent = "Error fetching train data.";
            });
    }

    // Add a click event listener to the button
    getTrainInfoButton.addEventListener("click", fetchAndDisplaySelectedTrainInfo);
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



    

