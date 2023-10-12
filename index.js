//fetch ('http://localhost:3000/trains/')

document.addEventListener("DOMContentLoaded", function () {
    const trainInfoElement = document.getElementsByClassName("train-info");

    // Replace with the URL of your train timings API.
    let apiUrl = 'http://localhost:3000/trains/';

    // Fetch train timings from the API
    fetch(apiUrl)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then((data) => {
            // Process the JSON data and display it on the web page
            const trains = data.trains;
            const trainList = document.createElement("ul");

            trains.forEach((train) => {
                const listItem = document.createElement("li");
                listItem.textContent = `train_id: ${trains.train_id}, train_name: ${trains.train_name}, departure_time: ${trains.departure_time}, arrival_time: ${trains.arrival_time}`;

                // You can also display train images if provided
                if (train.image_url) {
                    const image = document.createElement("img");
                    image.src = train.image_url;
                    listItem.appendChild(image);
                }

                trainList.appendChild(listItem);
            });

            trainInfoElement.appendChild(trainList);
        })
        .catch((error) => {
            console.error("Error fetching train data:", error);
            trainInfoElement.textContent = "Error fetching train data.";
        });
});

document.addEventListener("DOMContentLoaded", function () {
    const trainInfoElement = document.getElementById("train-info");
    const loadButton = document.getElementById("loadButton");
    const trainSelect = document.getElementById("train-select");
    const ticketCountInput = document.getElementById("ticket-count");
    const bookButton = document.getElementById("book-button");
    const ticketCountList = document.getElementById("ticket-count-list");

    let ticketCounts = {}; // Object to store ticket counts for each train

    // Function to update the ticket count display
    function updateTicketCountDisplay() {
        ticketCountList.innerHTML = "";
        for (const train_id in ticketCounts) {
            const listItem = document.createElement("li");
            listItem.textContent = `Train ID: ${train_id}, Tickets Booked: ${ticketCounts[train_id]}`;
            ticketCountList.appendChild(listItem);
        }
    }

    loadButton.addEventListener("click", function () {
        fetch('http://localhost:3000/trains')
            .then((response) => response.json())
            .then((data) => {
                trainSelect.innerHTML = ""; // Clear previous options
                data.forEach((train) => {
                    const option = document.createElement("option");
                    option.value = train.id;
                    option.textContent = `Train Name: ${train.train_name}`;
                    trainSelect.appendChild(option);
                    ticketCounts[train.id] = 0; // Initialize ticket count
                });
            })
            .catch((error) => console.error("Error fetching train data:", error));
    });

    bookButton.addEventListener("click", function () {
        const selectedTrainId = trainSelect.value;
        const bookedTickets = parseInt(ticketCountInput.value);

        if (selectedTrainId && bookedTickets > 0) {
            // Update the ticket count for the selected train
            if (ticketCounts[selectedTrainId]) {
                ticketCounts[selectedTrainId] += bookedTickets;
            }

            // Update the display
            updateTicketCountDisplay();

             // Show an alert message
             alert(`${bookedTickets} ticket(s) have been booked for Train ID: ${selectedTrainId}`);
        }
    });
});


