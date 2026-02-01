// Firebase Configuration
// Replace these with your actual Firebase project credentials
const firebaseConfig = {
    apiKey: "AIzaSyDJfjrTFCTf4069NavogFdnvlQ_A1ERPdg",
    authDomain: "rideapp-iitk.firebaseapp.com",
    databaseURL: "https://rideapp-iitk-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "rideapp-iitk",
    storageBucket: "rideapp-iitk.firebasestorage.app",
    messagingSenderId: "232073131257",
    appId: "1:232073131257:web:30d05787431bd3589d9e28",
    measurementId: "G-S4KH7N4FWK"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get references to Firebase services
const database = firebase.database();
const auth = firebase.auth();

// Database references
const driversRef = database.ref('drivers');
const ridersRef = database.ref('riders');
const ridesRef = database.ref('rides');

// Predefined zones for IIT Kanpur
const ZONES = [
    "Hall 1", "Hall 2", "Hall 3", "Hall 4", "Hall 5",
    "Hall 6", "Hall 7", "Hall 8", "Hall 9", "Hall 10",
    "Hall 11", "Hall 12", "Hall 13",
    "Main Gate", "CC", "E Shop", "LHC", "Library",
    "SAC", "Outreach Auditorium"
];

// Helper function to calculate distance between two zones (simplified)
function calculateDistance(zone1, zone2) {
    // Simple zone distance matrix (in km)
    // In real implementation, use actual coordinates
    const zoneDistances = {
        "Main Gate": { "CC": 1.2, "Hall 10": 2.1, "E Shop": 0.8, "Hall 13": 2.5 },
        "CC": { "Main Gate": 1.2, "Hall 10": 1.5, "Library": 0.5, "Hall 13": 1.8 },
        "Hall 10": { "Main Gate": 2.1, "CC": 1.5, "Hall 13": 0.7, "E Shop": 1.9 },
        "E Shop": { "Main Gate": 0.8, "CC": 1.4, "Hall 10": 1.9, "Hall 13": 2.3 },
        "Hall 13": { "Main Gate": 2.5, "CC": 1.8, "Hall 10": 0.7, "E Shop": 2.3 }
    };

    if (zone1 === zone2) return 0;
    
    // Check if direct distance exists
    if (zoneDistances[zone1] && zoneDistances[zone1][zone2]) {
        return zoneDistances[zone1][zone2];
    }
    
    // Return a random distance if not in matrix (for demo purposes)
    return Math.random() * 3 + 0.5;
}

// Helper function to generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

console.log("Firebase initialized successfully");
