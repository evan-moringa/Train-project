//fetch ('http://localhost:3000/trains/')
document.addEventListener("DOMContentLoaded", function () {
    const trainInfoElement = document.getElementById("train-info");

    // Replace with the URL of your train information API
    const api_Url = "https://localhost:3000/trains/";

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
            .catch((error) => {
                console.error("Error fetching train data:", error);
                trainInfoElement.innerHTML = "Error fetching train data.";
            });
    }

    // Initial data load when the page loads
    fetchAndDisplayTrainInfo(apiUrl);
});




    

