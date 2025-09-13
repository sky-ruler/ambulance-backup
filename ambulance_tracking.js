import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔹 DOM Elements
const infoDiv = document.getElementById("info");
const pickupBtn = document.getElementById("pickupBtn");
const completeBtn = document.getElementById("completeBtn");
const popup = document.getElementById("popup");
const popupText = document.getElementById("popupText");
const acceptBtn = document.getElementById("acceptBtn");
const rejectBtn = document.getElementById("rejectBtn");

// 🔹 Map Setup
let routeLine = null;
const driverIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3181/3181919.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});
const hospitalIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2967/2967355.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

let driverMarker = null;
let hospitalMarker = null;

const map = L.map("map").setView([20.2961, 85.8245], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

async function drawDrivingRoute(startLat, startLng, endLat, endLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.routes || data.routes.length === 0) return;
  const coords = data.routes[0].geometry.coordinates.map((c) => [
    c[1],
    c[0],
  ]);
  if (routeLine) map.removeLayer(routeLine);
  routeLine = L.polyline(coords, { color: "blue", weight: 5 }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
}

let activeRequestId = null;
const driverPlate = localStorage.getItem("driverPlate") || "TEST123";
const driverName = localStorage.getItem("driverName") || "Test Driver";

// --- continuous ambulance location update in DB ---
let gpsWorking = false;
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      gpsWorking = true; // mark GPS as available
      const ambLat = pos.coords.latitude;
      const ambLng = pos.coords.longitude;
      update(ref(db, "ambulances/" + driverPlate), {
        driver: driverName,
        plate: driverPlate,
        lat: ambLat,
        lng: ambLng,
        status: activeRequestId ? "busy" : "available",
        lastUpdated: new Date().toISOString(),
      });
    },
    (err) => console.error("Location error:", err),
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    }
  );
}

// --- fallback simulation if no GPS ---
let simLat = 20.2961;
let simLng = 85.8245;
setInterval(() => {
  if (!gpsWorking) {
    simLat += 0.0001;
    simLng += 0.0001;
    update(ref(db, "ambulances/" + driverPlate), {
      driver: driverName,
      plate: driverPlate,
      lat: simLat,
      lng: simLng,
      status: activeRequestId ? "busy" : "available",
      lastUpdated: new Date().toISOString(),
    });
  }
}, 3000);

// --- listen for requests ---
const requestsRef = ref(db, "requests");
onValue(requestsRef, (snapshot) => {
  snapshot.forEach((child) => {
    const requestId = child.key;
    const req = child.val();

    if (req.status === "requested" && req.ambulancePlate === driverPlate && !activeRequestId) {
      popupText.innerHTML = `
        Patient: ${req.patientName || "-"}<br>
        Hospital: ${req.hospitalId || "-"}<br>
        Priority: ${req.priority || "normal"}
      `;
      popup.style.display = "flex";

      acceptBtn.onclick = () => handleAccept(requestId, req);
      rejectBtn.onclick = () => handleReject();
    }
  });
});

function handleAccept(requestId, req) {
  popup.style.display = "none";
  activeRequestId = requestId;

  update(ref(db, `requests/${requestId}`), {
    status: "Accepted",
    ambulanceDriver: driverName,
  });

  navigator.geolocation.getCurrentPosition((pos) => {
    const ambLat = pos.coords.latitude;
    const ambLng = pos.coords.longitude;

    update(ref(db, `requests/${requestId}`), {
      ambulanceLat: ambLat,
      ambulanceLng: ambLng,
    });

    if (driverMarker) map.removeLayer(driverMarker);
    driverMarker = L.marker([ambLat, ambLng], { icon: driverIcon })
      .addTo(map)
      .bindPopup("🚑 You are here")
      .openPopup();

    drawDrivingRoute(ambLat, ambLng, req.pickup.lat, req.pickup.lng);
  });

  startActiveRequestTracking(requestId);

  infoDiv.innerHTML = `
    <b>Active Request:</b><br>
    Patient: ${req.patientName}<br>
    Pickup: ${req.address}<br>
    Hospital: ${req.hospitalId}<br>
    Priority: ${req.priority}
  `;
  pickupBtn.style.display = "block";
}

function handleReject() {
  popup.style.display = "none";
  // Optionally, update request status to 'rejected_by_driver' so it can be reassigned.
}

function startActiveRequestTracking(requestId) {
  const reqRef = ref(db, `requests/${requestId}`);
  onValue(reqRef, (snap) => {
    const currentReq = snap.val();
    if (!currentReq) return;

    navigator.geolocation.watchPosition((pos) => {
      const ambLat = pos.coords.latitude;
      const ambLng = pos.coords.longitude;
      update(ref(db, `requests/${activeRequestId}`), {
        ambulanceLat: ambLat,
        ambulanceLng: ambLng,
      });

      if (driverMarker) {
        driverMarker.setLatLng([ambLat, ambLng]);
      } else {
        driverMarker = L.marker([ambLat, ambLng], { icon: driverIcon })
          .addTo(map)
          .bindPopup("🚑 You are here")
          .openPopup();
      }
    });

    if (
      currentReq.status === "PickedUp" &&
      currentReq.hospitalLat &&
      currentReq.hospitalLng
    ) {
      drawDrivingRoute(
        currentReq.ambulanceLat,
        currentReq.ambulanceLng,
        currentReq.hospitalLat,
        currentReq.hospitalLng
      );

      if (hospitalMarker) map.removeLayer(hospitalMarker);
      hospitalMarker = L.marker(
        [currentReq.hospitalLat, currentReq.hospitalLng],
        { icon: hospitalIcon }
      )
        .addTo(map)
        .bindPopup("🏥 Hospital Destination")
        .openPopup();
      
      pickupBtn.style.display = 'none';
      completeBtn.style.display = 'block';
    }
  });
}

pickupBtn.onclick = async () => {
  if (!activeRequestId) return;
  await update(ref(db, `requests/${activeRequestId}`), {
    status: "PickedUp",
  });
  alert("🚑 Patient picked up, heading to hospital!");
};

completeBtn.onclick = async () => {
  if (!activeRequestId) return;
  await update(ref(db, `requests/${activeRequestId}`), {
    status: "Completed",
    completedAt: new Date().toISOString(),
  });
  await update(ref(db, `ambulances/${driverPlate}`), {
    status: "available",
  });

  alert("✅ Trip completed!");
  resetUI();
};

function resetUI() {
  infoDiv.innerHTML = "No active requests.";
  pickupBtn.style.display = "none";
  completeBtn.style.display = "none";

  if (hospitalMarker) {
    map.removeLayer(hospitalMarker);
    hospitalMarker = null;
  }
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  if(driverMarker){
    map.removeLayer(driverMarker);
    driverMarker = null;
  }
  activeRequestId = null;
}
