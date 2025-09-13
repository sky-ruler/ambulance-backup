import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Map setup
const map = L.map("map").setView([20.59, 78.96], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Global storage
const ambulanceData = {}; // Store all ambulance data
const ambulanceMarkers = {};
const routeLines = {};
const hospitalCircles = {};

const requestsTableBody = document.querySelector("#requestsTable tbody");

// Smooth marker movement
function smoothMove(marker, newLatLng) {
  const duration = 2000; // 2 seconds
  const start = marker.getLatLng();
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = elapsed / duration;
    if (progress > 1) {
      marker.setLatLng(newLatLng);
      return;
    }
    const lat = start.lat + (newLatLng.lat - start.lat) * progress;
    const lng = start.lng + (newLatLng.lng - start.lng) * progress;
    marker.setLatLng([lat, lng]);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// Draw route using OSRM
async function drawRoute(id, ambLat, ambLng, destLat, destLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${ambLng},${ambLat};${destLng},${destLat}?overview=full&geometries=geojson`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.routes || !data.routes.length) return;

    const coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
    if (routeLines[id]) map.removeLayer(routeLines[id]);
    routeLines[id] = L.polyline(coords, {
      color: "blue",
      weight: 4,
    }).addTo(map);
  } catch (err) {
    console.error("Failed to draw route: ", err);
  }
}

// Clear visuals
function clearAmbulanceFromMap(id) {
  if (ambulanceMarkers[id]) {
    map.removeLayer(ambulanceMarkers[id]);
    delete ambulanceMarkers[id];
  }
  if (hospitalCircles[id]) {
    map.removeLayer(hospitalCircles[id]);
    delete hospitalCircles[id];
  }
  if (routeLines[id]) {
    map.removeLayer(routeLines[id]);
    delete routeLines[id];
  }
  const row = document.getElementById(`request-row-${id}`);
  if (row) row.remove();
}

// Update table row
function updateRequestTable(req, id) {
  let row = document.getElementById(`request-row-${id}`);
  if (!row) {
    row = document.createElement("tr");
    row.id = `request-row-${id}`;
    requestsTableBody.appendChild(row);
  }
  row.innerHTML = `
    <td>${req.patientName || "-"}</td>
    <td>${req.hospitalId || "-"}</td>
    <td>${req.ambulancePlate || "-"}</td>
    <td>${req.ambulanceDriver || "-"}</td> 
    <td>${req.priority || "-"}</td>
    <td>${req.status || "-"}</td>
  `;
}

// Listen to all ambulances
const ambulancesRef = ref(db, "ambulances");
onValue(ambulancesRef, (snapshot) => {
  snapshot.forEach((child) => {
    const amb = child.val();
    const plate = child.key;
    ambulanceData[plate] = amb;
  });
});

// Listen to requests
const requestsRef = ref(db, "requests");
onValue(requestsRef, (snapshot) => {
  const allPlates = new Set();
  snapshot.forEach((child) => {
    const req = child.val();
    const id = child.key;
    const plate = req.ambulancePlate;

    if (!plate || req.status === "Completed") {
      clearAmbulanceFromMap(id);
      return;
    }

    allPlates.add(plate);
    updateAmbulanceOnMap(id, req);
  });

  // Remove markers for ambulances no longer in requests
  for (const plate in ambulanceMarkers) {
    if (!allPlates.has(plate)) {
      clearAmbulanceFromMap(plate);
    }
  }
});

function updateAmbulanceOnMap(id, req) {
  const plate = req.ambulancePlate;
  const amb = ambulanceData[plate];
  if (!amb || !amb.lat || !amb.lng) return;

  updateRequestTable(req, id);

  const ambLatLng = L.latLng(amb.lat, amb.lng);

  if (!ambulanceMarkers[plate]) {
    ambulanceMarkers[plate] = L.marker(ambLatLng, {
      icon: L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/3181/3181919.png",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    })
      .addTo(map)
      .bindPopup(
        `<b>Plate:</b> ${plate}<br><b>Driver:</b> ${amb.driver || "N/A"}`
      );
  } else {
    smoothMove(ambulanceMarkers[plate], ambLatLng);
  }

  // Update popup content
  ambulanceMarkers[plate].setPopupContent(
    `<b>Plate:</b> ${plate}<br><b>Driver:</b> ${amb.driver || "N/A"}<br><b>Status:</b> ${amb.status}`
  );

  // Draw route based on request status
  if (req.status === "PickedUp" && req.hospitalLat && req.hospitalLng) {
    drawRoute(id, amb.lat, amb.lng, req.hospitalLat, req.hospitalLng);
  } else if (req.status === "Accepted" && req.pickup?.lat && req.pickup?.lng) {
    drawRoute(id, amb.lat, amb.lng, req.pickup.lat, req.pickup.lng);
  }

  // Hospital circle
  if (req.hospitalLat && req.hospitalLng && !hospitalCircles[id]) {
    hospitalCircles[id] = L.circle([req.hospitalLat, req.hospitalLng], {
      radius: 1000,
      color: "green",
      fillOpacity: 0.1,
    }).addTo(map);
  }
}
