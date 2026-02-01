// Role protection
if (localStorage.getItem("role") !== "driver") {
    window.location.href = "index.html";
}

// Current driver info
const currentDriverId = localStorage.getItem("userId");
const currentDriverName = localStorage.getItem("driverName");
let useGPS = localStorage.getItem("driverUseGPS") === "true";

// Location tracking
let gpsWatchId = null;
let currentLocation = null;
let lastUpdateTime = new Date().toISOString();
let driverAvailable = localStorage.getItem("driverAvailable") !== "false";

// Function to load driver data from Firebase
async function loadDriverData() {
    try {
        const snapshot = await driversRef.child(currentDriverId).once('value');
        if (snapshot.exists()) {
            const driverData = snapshot.val();
            driverAvailable = driverData.available;
            useGPS = driverData.useGPS || false;
            
            if (useGPS && driverData.latitude && driverData.longitude) {
                currentLocation = {
                    lat: driverData.latitude,
                    lng: driverData.longitude,
                    description: driverData.locationDescription || "GPS Location"
                };
            } else if (driverData.currentZone) {
                currentLocation = driverData.currentZone;
            }
            
            lastUpdateTime = driverData.lastUpdated || new Date().toISOString();
            
            // Update localStorage
            localStorage.setItem("driverAvailable", driverAvailable);
            localStorage.setItem("driverUseGPS", useGPS);
            
            // Update UI
            updateUI();
            
            // Start GPS if enabled
            if (useGPS) {
                startGPSTracking();
            }
        }
    } catch (error) {
        console.error("Error loading driver data:", error);
    }
}

// Function to update UI with current values
function updateUI() {
    const toggle = document.getElementById("availabilityToggle");
    const statusText = document.getElementById("statusText");
    const lastLocationEl = document.getElementById("lastLocation");
    const lastUpdatedEl = document.getElementById("lastUpdated");
    const gpsToggle = document.getElementById("gpsToggle");
    const gpsStatus = document.getElementById("gpsStatus");
    const locationMethod = document.getElementById("locationMethod");

    // Set toggle state
    if (toggle) toggle.checked = driverAvailable;
    
    // Set status text
    if (statusText) {
        if (driverAvailable) {
            statusText.innerHTML = 'Your current status is: <strong style="color: #10b981;">Available</strong>';
        } else {
            statusText.innerHTML = 'Your current status is: <strong style="color: #ef4444;">Unavailable</strong>';
        }
    }

    // Set GPS toggle
    if (gpsToggle) gpsToggle.checked = useGPS;
    
    // Set GPS status text
    if (gpsStatus) {
        gpsStatus.textContent = useGPS ? "GPS Tracking ON (Auto-update every 30s)" : "GPS Tracking OFF (Manual zone selection)";
        gpsStatus.style.color = useGPS ? "#10b981" : "#6b7280";
    }
    
    // Set location method
    if (locationMethod) {
        locationMethod.textContent = useGPS ? "Real-time GPS location tracking" : "Zone-based location tracking";
    }

    // Set location display
    if (lastLocationEl) {
        if (useGPS && currentLocation && currentLocation.lat) {
            lastLocationEl.textContent = currentLocation.description || `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`;
        } else {
            lastLocationEl.textContent = currentLocation || "Not set";
        }
    }
    
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = getTimeAgo(lastUpdateTime);
    }
}

// Function to toggle availability
async function toggleAvailability() {
    const toggle = document.getElementById("availabilityToggle");
    const statusText = document.getElementById("statusText");

    driverAvailable = toggle.checked;

    // Update UI immediately
    if (driverAvailable) {
        statusText.innerHTML = 'Your current status is: <strong style="color: #10b981;">Available</strong>';
    } else {
        statusText.innerHTML = 'Your current status is: <strong style="color: #ef4444;">Unavailable</strong>';
    }

    try {
        // Update Firebase
        await driversRef.child(currentDriverId).update({
            available: driverAvailable,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });

        // Update localStorage
        localStorage.setItem("driverAvailable", driverAvailable);

        // Show notification
        showNotification(driverAvailable ? "You are now available for rides" : "You are now unavailable");

    } catch (error) {
        console.error("Error updating availability:", error);
        showNotification("Error updating status. Please try again.", "error");
        toggle.checked = !driverAvailable;
    }
}

// Function to toggle GPS
async function toggleGPS() {
    const gpsToggle = document.getElementById("gpsToggle");
    useGPS = gpsToggle.checked;
    
    try {
        // Update Firebase
        await driversRef.child(currentDriverId).update({
            useGPS: useGPS,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });
        
        localStorage.setItem("driverUseGPS", useGPS);
        
        if (useGPS) {
            startGPSTracking();
            showNotification("GPS tracking enabled. Your location will update automatically.");
        } else {
            stopGPSTracking();
            showNotification("GPS tracking disabled. Use manual zone selection.");
        }
        
        updateUI();
    } catch (error) {
        console.error("Error toggling GPS:", error);
        showNotification("Error changing GPS setting", "error");
        gpsToggle.checked = !useGPS;
    }
}

// Function to start GPS tracking
function startGPSTracking() {
    if (!navigator.geolocation) {
        showNotification("GPS not supported by your browser", "error");
        return;
    }
    
    // Get initial position
    navigator.geolocation.getCurrentPosition(
        (position) => {
            updateGPSLocation(position);
        },
        (error) => {
            console.error("GPS error:", error);
            showNotification("Could not get GPS location. Check permissions.", "error");
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
    
    // Watch position with auto-update every 30 seconds
    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
    }
    
    gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            updateGPSLocation(position);
        },
        (error) => {
            console.error("GPS watch error:", error);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 }
    );
}

// Function to stop GPS tracking
function stopGPSTracking() {
    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
}

// Function to update GPS location
async function updateGPSLocation(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    
    currentLocation = {
        lat: lat,
        lng: lng,
        description: "GPS Location"
    };
    
    lastUpdateTime = new Date().toISOString();
    
    try {
        // Update Firebase with GPS coordinates
        await driversRef.child(currentDriverId).update({
            latitude: lat,
            longitude: lng,
            locationDescription: "GPS Location",
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });
        
        updateUI();
    } catch (error) {
        console.error("Error updating GPS location:", error);
    }
}

// Function to update current location (manual zone selection)
async function updateCurrentLocation() {
    if (useGPS) {
        // Manually trigger GPS update
        if (navigator.geolocation) {
            showNotification("Getting your GPS location...");
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    await updateGPSLocation(position);
                    showNotification("GPS location updated successfully!");
                },
                (error) => {
                    console.error("GPS error:", error);
                    showNotification("Could not get GPS location. Check permissions.", "error");
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    } else {
        // Show zone selection dialog for manual update
        const zoneSelection = document.createElement('div');
        zoneSelection.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            max-width: 400px;
            width: 90%;
        `;

        zoneSelection.innerHTML = `
            <h3 style="margin-bottom: 1rem; color: #1f2937;">Select Your Current Zone</h3>
            <select id="zoneSelector" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 1rem; font-size: 1rem;">
                ${ZONES.map(zone => `<option value="${zone}" ${zone === currentLocation ? 'selected' : ''}>${zone}</option>`).join('')}
            </select>
            <div style="display: flex; gap: 1rem;">
                <button id="confirmZone" style="flex: 1; padding: 0.75rem; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Update</button>
                <button id="cancelZone" style="flex: 1; padding: 0.75rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Cancel</button>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(zoneSelection);

        document.getElementById('confirmZone').onclick = async () => {
            const selectedZone = document.getElementById('zoneSelector').value;
            
            try {
                await driversRef.child(currentDriverId).update({
                    currentZone: selectedZone,
                    lastUpdated: firebase.database.ServerValue.TIMESTAMP
                });

                currentLocation = selectedZone;
                lastUpdateTime = new Date().toISOString();
                
                updateUI();
                showNotification(`Location updated to ${currentLocation}`);

                overlay.remove();
                zoneSelection.remove();
            } catch (error) {
                console.error("Error updating location:", error);
                showNotification("Error updating location. Please try again.", "error");
            }
        };

        document.getElementById('cancelZone').onclick = () => {
            overlay.remove();
            zoneSelection.remove();
        };

        overlay.onclick = () => {
            overlay.remove();
            zoneSelection.remove();
        };
    }
}

// Function to format time difference
function getTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Function to show notifications
function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === "success" ? "#10b981" : "#ef4444"};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = "slideOut 0.3s ease";
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    @keyframes fadeOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(-20px); }
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

// Function to load ride requests from Firebase
async function loadRideRequests() {
    const requestsList = document.getElementById("requestsList");
    
    try {
        ridesRef.orderByChild('driverId').equalTo(currentDriverId).on('value', (snapshot) => {
            requestsList.innerHTML = "";
            
            if (!snapshot.exists()) {
                requestsList.innerHTML = '<p class="no-requests">No ride requests at the moment</p>';
                return;
            }

            const requests = [];
            snapshot.forEach((childSnapshot) => {
                const rideData = childSnapshot.val();
                if (rideData.status === "contacted") {
                    requests.push({
                        id: childSnapshot.key,
                        ...rideData
                    });
                }
            });

            if (requests.length === 0) {
                requestsList.innerHTML = '<p class="no-requests">No ride requests at the moment</p>';
                return;
            }

            requests.forEach(request => {
                const requestItem = document.createElement("div");
                requestItem.className = "request-item";
                requestItem.setAttribute("data-request-id", request.id);
                requestItem.innerHTML = `
                    <div class="request-info">
                        <strong>Rider:</strong> ${request.riderName}<br>
                        <strong>Route:</strong> ${request.from} → ${request.to}<br>
                        <strong>Time:</strong> ${new Date(request.contactedAt).toLocaleString()}
                    </div>
                    <button class="accept-btn" onclick="acceptRequest('${request.id}', '${request.riderName}')">
                        Accept & Complete
                    </button>
                `;
                requestsList.appendChild(requestItem);
            });
        });

    } catch (error) {
        console.error("Error loading ride requests:", error);
        requestsList.innerHTML = '<p class="no-requests">Error loading requests</p>';
    }
}

// Function to accept ride request
async function acceptRequest(rideId, riderName) {
    const confirmAccept = confirm(`Accept and complete ride for ${riderName}?`);
    
    if (confirmAccept) {
        try {
            await ridesRef.child(rideId).update({
                status: "completed",
                completedAt: firebase.database.ServerValue.TIMESTAMP
            });

            const requestElement = document.querySelector(`[data-request-id="${rideId}"]`);
            if (requestElement) {
                requestElement.style.animation = "fadeOut 0.3s ease";
                setTimeout(() => requestElement.remove(), 300);
            }

            showNotification(`Ride completed successfully!`);
        } catch (error) {
            console.error("Error accepting request:", error);
            showNotification("Error updating ride. Please try again.", "error");
        }
    }
}

// Add logout function
function logout() {
    const confirmLogout = confirm("Are you sure you want to logout?");
    if (confirmLogout) {
        stopGPSTracking(); // Stop GPS tracking before logout
        auth.signOut().then(() => {
            localStorage.clear();
            window.location.href = "index.html";
        }).catch((error) => {
            console.error("Logout error:", error);
            alert("Error logging out. Please try again.");
        });
    }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
    console.log(`Welcome ${currentDriverName}!`);
    
    await loadDriverData();
    loadRideRequests();

    // Update time display every minute
    setInterval(() => {
        const lastUpdatedEl = document.getElementById("lastUpdated");
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = getTimeAgo(lastUpdateTime);
        }
    }, 60000);
});

// Cleanup listeners when page unloads
window.addEventListener('beforeunload', () => {
    stopGPSTracking();
    ridesRef.off('value');
});
