// Import Firebase and hospital data
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { odishaHospitals } from "./hospitals.js";
import { firebaseConfig } from "./firebase.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Populate Hospital Dropdown ---
const hospitalSelect = document.getElementById("hospitalSelect");
odishaHospitals.forEach((h) => {
  const opt = document.createElement("option");
  opt.value = h.name;
  opt.textContent = h.name;
  hospitalSelect.appendChild(opt);
});

// --- Handle Registration Button Click ---
document.getElementById("registerBtn").onclick = async () => {
  // Get form values
  const name = document.getElementById("driverName").value.trim();
  const plate = document.getElementById("ambulancePlate").value.trim();
  const hospital = hospitalSelect.value || null;
  const statusDiv = document.getElementById("status");

  // Clear previous status messages
  statusDiv.textContent = "";
  statusDiv.className = "";

  // --- Input Validation ---
  if (!name || !plate) {
    statusDiv.textContent = "Driver name and ambulance plate are required.";
    statusDiv.className = "error";
    return;
  }

  // Validate plate format (e.g., AP-39-TT-1234)
  const plateRegex = /^[A-Z]{2}-\d{2}-[A-Z]{1,2}-\d{4}$/;
  if (!plateRegex.test(plate)) {
    statusDiv.textContent = "Please use the format XX-00-YY-0000 for the plate.";
    statusDiv.className = "error";
    return;
  }

  // --- Firebase Database Operation ---
  try {
    // Create a reference to the ambulance in the database
    const ambRef = ref(db, "ambulances/" + plate);
    
    // Set the ambulance data
    await set(ambRef, {
      driver: name,
      plate: plate,
      hospital: hospital, // Can be null if not affiliated
      status: "available", // Initial status
      lat: null, // To be updated by the tracking page
      lng: null,
      lastUpdated: null,
    });

    // --- Success Handling ---
    // Save the driver's plate to local storage for the tracking page
    localStorage.setItem("driverPlate", plate);
    
    // Display success message and redirect
    statusDiv.textContent = "✅ Registered successfully! Redirecting...";
    statusDiv.className = "success";
    setTimeout(() => {
      window.location.href = "ambulance_tracking.html";
    }, 2000);

  } catch (error) {
    // --- Error Handling ---
    console.error("Error registering driver:", error);
    statusDiv.textContent = "❌ Registration failed. See console for details.";
    statusDiv.className = "error";
  }
};
