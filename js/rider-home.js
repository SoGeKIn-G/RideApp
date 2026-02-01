// Role protection
if (localStorage.getItem("role") !== "rider") {
    window.location.href = "index.html";
}

// Current user info
const currentUserId = localStorage.getItem("userId");
const currentUserName = localStorage.getItem("userName");

// Store for available drivers
let availableDrivers = [];

// Function to calculate distance between GPS coordinates (Haversine formula)
function calculateGPSDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Function to get approximate GPS coords for a zone (for distance calculation)
function getZoneCoordinates(zoneName) {
    // Approximate IIT Kanpur campus coordinates
    const zoneCoords = {
        "Main Gate": { lat: 26.5123, lng: 80.2329 },
        "Hall 1": { lat: 26.5140, lng: 80.2340 },
        "Hall 2": { lat: 26.5145, lng: 80.2350 },
        "Hall 3": { lat: 26.5150, lng: 80.2360 },
        "Hall 4": { lat: 26.5135, lng: 80.2355 },
        "Hall 5": { lat: 26.5130, lng: 80.2365 },
        "Hall 6": { lat: 26.5125, lng: 80.2375 },
        "Hall 7": { lat: 26.5120, lng: 80.2380 },
        "Hall 8": { lat: 26.5115, lng: 80.2385 },
        "Hall 9": { lat: 26.5110, lng: 80.2390 },
        "Hall 10": { lat: 26.5105, lng: 80.2395 },
        "Hall 11": { lat: 26.5100, lng: 80.2400 },
        "Hall 12": { lat: 26.5095, lng: 80.2405 },
        "Hall 13": { lat: 26.5090, lng: 80.2410 },
        "CC": { lat: 26.5128, lng: 80.2338 },
        "E Shop": { lat: 26.5132, lng: 80.2345 },
        "LHC": { lat: 26.5125, lng: 80.2350 },
        "Library": { lat: 26.5130, lng: 80.2355 },
        "SAC": { lat: 26.5135, lng: 80.2360 },
        "Outreach Auditorium": { lat: 26.5140, lng: 80.2365 }
    };
    
    return zoneCoords[zoneName] || { lat: 26.5123, lng: 80.2329 }; // Default to Main Gate
}

// Function to load and display drivers from Firebase
async function loadDrivers() {
    const fromLocation = document.getElementById("fromLocation").value.trim();
    const toLocation = document.getElementById("toLocation").value.trim();
    const container = document.getElementById("driversContainer");

    // Clear previous results
    container.innerHTML = '<p class="no-results">Loading drivers...</p>';

    // Check if locations are provided
    if (!fromLocation || !toLocation) {
        container.innerHTML = `
            <p class="no-results">Please enter both pickup and destination locations</p>
        `;
        return;
    }

    try {
        // Fetch all drivers from Firebase (both available and manual)
        const snapshot = await driversRef.once('value');
        
        if (!snapshot.exists()) {
            container.innerHTML = `
                <p class="no-results">No drivers in the system. Please try again later.</p>
            `;
            return;
        }

        // Get pickup location coordinates
        const pickupCoords = getZoneCoordinates(fromLocation);

        // Process drivers data
        availableDrivers = [];
        snapshot.forEach((childSnapshot) => {
            const driverId = childSnapshot.key;
            const driverData = childSnapshot.val();
            
            // Include: available drivers OR manual drivers (alwaysShow flag)
            if (driverData.available || driverData.alwaysShow) {
                let distance = 0;
                let locationDisplay = "";
                
                // Calculate distance based on driver's location type
                if (driverData.useGPS && driverData.latitude && driverData.longitude) {
                    // GPS-enabled driver - calculate from actual GPS coordinates
                    distance = calculateGPSDistance(
                        pickupCoords.lat,
                        pickupCoords.lng,
                        driverData.latitude,
                        driverData.longitude
                    );
                    locationDisplay = driverData.locationDescription || "GPS Location";
                } else if (driverData.currentZone) {
                    // Zone-based driver - calculate from zone coordinates
                    const driverZoneCoords = getZoneCoordinates(driverData.currentZone);
                    distance = calculateGPSDistance(
                        pickupCoords.lat,
                        pickupCoords.lng,
                        driverZoneCoords.lat,
                        driverZoneCoords.lng
                    );
                    locationDisplay = driverData.currentZone;
                }
                
                availableDrivers.push({
                    id: driverId,
                    name: driverData.name,
                    phone: driverData.phone,
                    vehicle: driverData.vehicle,
                    vehicleNumber: driverData.vehicleNumber,
                    currentLocation: locationDisplay,
                    distance: distance,
                    isManualEntry: driverData.isManualEntry || false,
                    available: driverData.available,
                    useGPS: driverData.useGPS || false,
                    lastUpdated: driverData.lastUpdated
                });
            }
        });

        // Sort by distance (nearest first)
        availableDrivers.sort((a, b) => a.distance - b.distance);

        // Display drivers
        if (availableDrivers.length === 0) {
            container.innerHTML = `
                <p class="no-results">No drivers available at the moment. Please try again later.</p>
            `;
            return;
        }

        container.innerHTML = ""; // Clear loading message

        availableDrivers.forEach((driver, index) => {
            const driverCard = document.createElement("div");
            driverCard.className = "driver-card";
            driverCard.style.animationDelay = `${index * 0.1}s`;
            
            // Determine status badge
            let statusBadge = '';
            if (driver.isManualEntry) {
                statusBadge = '<div class="status-badge manual">📱 Call to Check</div>';
            } else if (driver.available) {
                statusBadge = '<div class="status-badge available">Available</div>';
            }
            
            // Determine location display
            let locationIcon = driver.useGPS ? '📍' : '🏛️';
            let locationText = driver.currentLocation || "Location not set";
            
            driverCard.innerHTML = `
                <div class="driver-header">
                    <div class="driver-name">${driver.name}</div>
                    ${statusBadge}
                </div>
                <div class="driver-info">
                    <div class="info-row">
                        🚗 <span class="info-label">Vehicle:</span> ${driver.vehicle} (${driver.vehicleNumber})
                    </div>
                    <div class="info-row">
                        ${locationIcon} <span class="info-label">Location:</span> ${locationText}
                    </div>
                    <div class="info-row">
                        📏 <span class="info-label">Distance:</span> ${driver.distance.toFixed(2)} km away
                    </div>
                    ${!driver.isManualEntry && driver.lastUpdated ? `
                    <div class="info-row" style="font-size: 0.8rem; color: #9ca3af;">
                        🕐 Updated ${getTimeAgo(driver.lastUpdated)}
                    </div>
                    ` : ''}
                </div>
                <button class="contact-btn ${driver.isManualEntry ? 'manual-btn' : ''}" onclick="contactDriver('${driver.name}', '${driver.phone}', '${driver.id}', ${driver.isManualEntry})">
                    📞 Contact Driver
                </button>
            `;

            container.appendChild(driverCard);
        });

        // Log ride search
        await ridesRef.push({
            riderId: currentUserId,
            riderName: currentUserName,
            from: fromLocation,
            to: toLocation,
            searchedAt: firebase.database.ServerValue.TIMESTAMP,
            status: "searching",
            driversFound: availableDrivers.length
        });

    } catch (error) {
        console.error("Error loading drivers:", error);
        container.innerHTML = `
            <p class="no-results">Error loading drivers. Please try again.</p>
        `;
    }
}

// Function to format time ago
function getTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Function to contact driver
async function contactDriver(name, phone, driverId, isManual) {
    let message = `Contact ${name} at ${phone}?`;
    
    if (isManual) {
        message += `\n\nNote: This driver doesn't use the app. Call them to check current availability and location.`;
    } else {
        message += `\n\nThe driver will be notified of your interest.`;
    }
    
    const confirmCall = confirm(message);
    
    if (confirmCall) {
        try {
            // Log the contact attempt
            await ridesRef.push({
                riderId: currentUserId,
                riderName: currentUserName,
                driverId: driverId,
                driverName: name,
                driverPhone: phone,
                from: document.getElementById("fromLocation").value,
                to: document.getElementById("toLocation").value,
                contactedAt: firebase.database.ServerValue.TIMESTAMP,
                status: "contacted",
                isManualDriver: isManual
            });

            // Show success message with phone number
            if (isManual) {
                alert(`Calling ${name}...\nPhone: ${phone}\n\nReminder: This driver doesn't use the app, so call to confirm availability.`);
            } else {
                alert(`Calling ${name}...\nPhone: ${phone}\n\nYou can now contact the driver directly.`);
            }
            
            // Uncomment for actual phone call on mobile devices
            // window.location.href = `tel:${phone}`;
            
        } catch (error) {
            console.error("Error logging contact:", error);
            alert(`Phone: ${phone}\n\nYou can call the driver at this number.`);
        }
    }
}

// Real-time listener for driver changes
function setupRealtimeListener() {
    driversRef.on('child_changed', (snapshot) => {
        // Optionally reload drivers when changes occur
        console.log("Driver data changed:", snapshot.key);
    });
}

// Add logout function
function logout() {
    const confirmLogout = confirm("Are you sure you want to logout?");
    if (confirmLogout) {
        auth.signOut().then(() => {
            localStorage.clear();
            window.location.href = "index.html";
        }).catch((error) => {
            console.error("Logout error:", error);
            alert("Error logging out. Please try again.");
        });
    }
}

// Add CSS for manual driver styling
const style = document.createElement("style");
style.textContent = `
    .status-badge.manual {
        background: #fef3c7;
        color: #92400e;
    }
    .status-badge.available {
        background: #d1fae5;
        color: #065f46;
    }
    .contact-btn.manual-btn {
        background: #f59e0b;
    }
    .contact-btn.manual-btn:hover {
        background: #d97706;
    }
    .logout-btn {
        background: #ef4444 !important;
        color: white !important;
    }
    .logout-btn:hover {
        background: #dc2626 !important;
    }
`;
document.head.appendChild(style);

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log(`Welcome ${currentUserName}!`);
    setupRealtimeListener();
});

// Cleanup listener when page unloads
window.addEventListener('beforeunload', () => {
    driversRef.off('child_changed');
});
