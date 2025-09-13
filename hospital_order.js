import { odishaHospitals } from "./hospitals.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔹 DOM Elements
const hospitalInput = document.getElementById("hospitalId");
const hospitalSuggestions = document.getElementById(
  "hospitalSuggestions"
);
const patientNameInput = document.getElementById("patientName");
const pickupSearchInput = document.getElementById("pickupSearch");
const statusArea = document.getElementById("statusArea");
const loadingIndicator = document.getElementById("loadingIndicator");
let selectedCoords = null;
let pickupMarker = null;
let selectedHospital = null;

// Modal Elements
const modal = document.getElementById("confirmationModal");
const closeModal = document.getElementsByClassName("close")[0];

// Show/Hide Modal
function showModal() {
  modal.style.display = "flex";
}

function hideModal() {
  modal.style.display = "none";
}

// Event Listeners
closeModal.onclick = hideModal;
window.onclick = function (event) {
  if (event.target == modal) {
    hideModal();
  }
};

// 🔹 Custom Icons
const ambulanceIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3181/3181919.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

const hospitalIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3176/3176366.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -35],
});

// 🔹 Map Setup
const map = L.map("map").setView([20.5937, 78.9629], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// 🔹 Helper
function safeUpdateMap(lat, lng, text, markerRef) {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return markerRef;
  if (markerRef) map.removeLayer(markerRef);
  map.setView([lat, lng], 15);
  return L.marker([lat, lng]).addTo(map).bindPopup(text).openPopup();
}

async function reverseGeocode(lat, lon) {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.error("Reverse geocoding failed:", err);
    statusArea.innerText = "Failed to get address. Please try again.";
    return null;
  }
}

// 🔹 Address Search
pickupSearchInput.addEventListener("input", async () => {
  const query = pickupSearchInput.value.trim();
  if (query.length < 3) {
    suggestionsList.innerHTML = "";
    return;
  }
  try {
    loadingIndicator.style.display = "block";
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5`
    );
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const data = await resp.json();
    suggestionsList.innerHTML = "";
    data.forEach((place) => {
      const li = document.createElement("li");
      li.textContent = place.display_name;
      li.onclick = () => {
        pickupSearchInput.value = place.display_name;
        selectedCoords = [parseFloat(place.lat), parseFloat(place.lon)];
        pickupMarker = safeUpdateMap(
          selectedCoords[0],
          selectedCoords[1],
          "Pickup Location",
          pickupMarker
        );
        suggestionsList.innerHTML = "";
      };
      suggestionsList.appendChild(li);
    });
  } catch (err) {
    console.error("Address search failed:", err);
    statusArea.innerText = "Address search failed. Check your connection.";
  } finally {
    loadingIndicator.style.display = "none";
  }
});

// 🔹 Current Location
document.getElementById("useMyLocation").onclick = () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  loadingIndicator.style.display = "block";
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        selectedCoords = [pos.coords.latitude, pos.coords.longitude];
        const data = await reverseGeocode(
          pos.coords.latitude,
          pos.coords.longitude
        );
        pickupSearchInput.value =
          data?.display_name || "Your Current Location";
        pickupMarker = safeUpdateMap(
          selectedCoords[0],
          selectedCoords[1],
          "Pickup Location",
          pickupMarker
        );
      } catch (err) {
        console.error("Error getting current location:", err);
        statusArea.innerText = "Could not get your location.";
      } finally {
        loadingIndicator.style.display = "none";
      }
    },
    (err) => {
      console.error(`Geolocation error: ${err.message}`);
      statusArea.innerText = `Could not get location: ${err.message}`;
      loadingIndicator.style.display = "none";
    }
  );
};

// 🔹 Hospital Autocomplete
hospitalInput.addEventListener("input", () => {
  const query = hospitalInput.value.toLowerCase().trim();
  hospitalSuggestions.innerHTML = "";
  if (!query) return;
  const matches = odishaHospitals.filter((h) =>
    (h?.name || "").toLowerCase().includes(query)
  );
  matches.forEach((hospital) => {
    const li = document.createElement("li");
    li.textContent = hospital.name;
    li.onclick = () => {
      hospitalInput.value = hospital.name;
      hospitalSuggestions.innerHTML = "";
      selectedHospital = hospital;
    };
    hospitalSuggestions.appendChild(li);
  });
});

// 🔹 Fetch real ambulances from Firebase
let ambulances = [];

function loadAmbulances() {
  const ambRef = ref(db, "ambulances");
  onValue(
    ambRef,
    (snapshot) => {
      ambulances = [];
      snapshot.forEach((child) => {
        const amb = child.val();
        if (amb.lat && amb.lng) {
          ambulances.push({
            id: child.key,
            driver: amb.driver || "-",
            plate: amb.plate || child.key,
            lat: amb.lat,
            lng: amb.lng,
            status: amb.status || "unknown",
          });
        }
      });
      console.log("✅ Loaded ambulances:", ambulances);
    },
    (err) => {
      console.error("Firebase (ambulances) read failed:", err);
      statusArea.innerText = "Could not load ambulance data.";
    }
  );
}

loadAmbulances();

// ... (The rest of the file remains largely the same, but with added try...catch blocks for Firebase writes)

// 🔹 Confirm Booking
window.confirmBooking = async (ambId) => {
  const amb = ambulances.find((a) => a.id === ambId);
  if (!amb) {
    alert("Selected ambulance is not available.");
    return;
  }
  if (!confirm(`Confirm booking ambulance ${amb.plate}?`)) return;

  try {
    loadingIndicator.style.display = "block";
    const requestRef = push(ref(db, "requests"));
    await set(requestRef, {
      hospitalId: selectedHospital.name,
      patientName: patientNameInput.value.trim(),
      pickup: { lat: selectedCoords[0], lng: selectedCoords[1] },
      address: pickupSearchInput.value,
      priority: document.getElementById("priority").value,
      notes: document.getElementById("notes").value.trim(),
      createdAt: serverTimestamp(),
      status: "requested",
      ambulanceId: amb.id,
      ambulancePlate: amb.plate,
      ambulanceDriver: amb.driver,
      hospitalLat: selectedHospital.lat,
      hospitalLng: selectedHospital.lng,
    });

    showModal();
    trackRequest(requestRef.key);
  } catch (err) {
    console.error("Booking failed:", err);
    statusArea.innerText = "Booking failed. Please try again.";
  } finally {
    loadingIndicator.style.display = "none";
  }
};

// ... (trackRequest function with added error handling)
function trackRequest(requestId) {
  if (!requestId) return;
  const reqRef = ref(db, "requests/" + requestId);
  onValue(reqRef, (snapshot) => {
    // ... (rest of the function)
  }, (err) => {
      console.error("Firebase (requests) read failed:", err);
      statusArea.innerText = "Could not track the request status.";
  });
}

document.getElementById("requestBtn").onclick = () => {
  if (!selectedCoords || !selectedHospital) {
    alert("Please select hospital and location first!");
    return;
  }
  alert("Fetching nearby ambulances...");
  showAmbulances();
};

document.getElementById("emergencyBtn").onclick = async () => {
  if (!selectedCoords || !selectedHospital) {
    alert("Please select hospital and location first!");
    return;
  }
  let cheapest = null;
  let cheapestCost = Infinity;
  ambulances.forEach((amb) => {
    const cost = calcCost(
      selectedCoords[0],
      selectedCoords[1],
      selectedHospital.lat,
      selectedHospital.lng
    );
    if (cost < cheapestCost) {
      cheapest = amb;
      cheapestCost = cost;
    }
  });
  if (!cheapest) {
    alert("No ambulances available for emergency booking.");
    return;
  }
  if (
    !confirm(
      `🚨 Emergency! Auto-book ${cheapest.plate} for ₹${cheapestCost}?`
    )
  )
    return;

  try {
    loadingIndicator.style.display = "block";
    const requestRef = push(ref(db, "requests"));
    await set(requestRef, {
      hospitalId: selectedHospital.name,
      patientName: patientNameInput.value.trim(),
      pickup: { lat: selectedCoords[0], lng: selectedCoords[1] },
      address: pickupSearchInput.value,
      priority: "critical",
      notes: "Emergency auto booking",
      createdAt: serverTimestamp(),
      status: "requested",
      ambulanceId: cheapest.id,
      ambulancePlate: cheapest.plate,
      ambulanceDriver: cheapest.driver,
      hospitalLat: cheapest.lat,
      hospitalLng: cheapest.lng,
    });

    showModal();
    trackRequest(requestRef.key);
  } catch (err) {
    console.error("Emergency booking failed:", err);
    statusArea.innerText = "Emergency booking failed. Please try again.";
  } finally {
    loadingIndicator.style.display = "none";
  }
};



