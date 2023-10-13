fetch(`http://localhost:3000/trains/`)
.then (res => res.json)
.then (api_Url => {
    console.log(api_Url);
    fetchAndDisplayTrainInfo(api_Url);
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

//document.addEventListener("DOMContentLoaded", function () {
   
    // Add a click event listener to the button
    loadDataButton.addEventListener("click", fetchAndDisplayTrainInfo);


    // Function to handle the "Book Tickets" button click
    function bookTickets(data) {
        // Implement the ticket booking logic here
        alert("Tickets have been booked ");
    }

    // Add a click event listener to the "Book Tickets" button
    bookTicketsButton.addEventListener("click", bookTickets);

document.addEventListener("DOMContentLoaded", function () {
    const addTrainForm = document.getElementById("add-train-form");
    const trainNameInput = document.getElementById("train-name");
    const departureTimeInput = document.getElementById("departure-time");
    const arrivalTimeInput = document.getElementById("arrival-time");
    const trainList = document.getElementById("train-list");
    const imageUrlInput = document.getElementById("image-url");

});
function addTrainToList(trainData) {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
        <img src="${trainData.imageUrl}" alt="${trainData.trainName}">
        <span>${trainData.trainName} (Departure: ${trainData.departureTime}, Arrival: ${trainData.arrivalTime})</span>
        <button class="delete-button">Delete</button>
    `;

    const deleteButton = listItem.querySelector(".delete-button");
    deleteButton.addEventListener("click", function () {
        // Implement delete logic here
        // You can use an API to delete the train
        listItem.remove();
    });

    trainList.appendChild(listItem);


// Add a new train when the form is submitted
addTrainForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const trainData = {
        trainName: trainNameInput.value,
        departureTime: departureTimeInput.value,
        arrivalTime: arrivalTimeInput.value,
        imageUrl: imageUrlInput.value
    };

    // You can use an API to post the train data
    // Simulate adding to the list for demonstration purposes
    addTrainToList(trainData);

    // Clear form inputs
    trainNameInput.value = "";
    departureTimeInput.value = "";
    arrivalTimeInput.value = "";
    imageUrlInput.value = "";
});
}
    

