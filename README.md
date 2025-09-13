# Ambulance Tracking System

This is a real-time ambulance tracking system built with HTML, CSS, JavaScript, and Firebase.

## Features

*   **Hospital View:** Hospitals can request ambulances for patients, specifying pickup locations, priority, and any relevant notes.
*   **Ambulance/Driver View:** Ambulance drivers can register, see incoming requests, and update their status (e.g., "Patient Picked Up," "Trip Completed").
*   **Police/Admin View:** A centralized dashboard for law enforcement or administrators to monitor all active ambulances and their statuses.
*   **Real-Time Tracking:** All views feature a real-time map that tracks the location of ambulances.

## Setup

1.  **Firebase:** Create a new Firebase project and obtain your Firebase configuration credentials.
2.  **`firebase.js`:** Create a `firebase.js` file in the `ambulance-tracking-system` directory and add your Firebase configuration to it. This file is included in the `.gitignore` to prevent it from being committed to version control.
3.  **Dependencies:** There are no external dependencies to install. All necessary libraries are included via CDN.
4.  **Running the project:** Open the HTML files in your browser to use the application.
