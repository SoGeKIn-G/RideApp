// Get DOM elements
const form = document.getElementById("signupForm");
const title = document.getElementById("roleTitle");
const manualBox = document.getElementById("manualBox");
const roleButtons = document.querySelectorAll(".role-btn");

let selectedRole = "rider"; // default

// Function to set role and update form
function setRole(role) {
    selectedRole = role;

    // Remove active from all buttons
    roleButtons.forEach(btn => btn.classList.remove("active"));

    // Hide manual driver box by default
    manualBox.style.display = "none";

    // Clear form
    form.innerHTML = "";

    if (role === "rider") {
        title.innerText = "Rider Signup";
        roleButtons[0].classList.add("active");
        form.innerHTML = `
            <input type="text" id="name" placeholder="Name" required>
            <input type="tel" id="phone" placeholder="Phone Number (10 digits)" required pattern="[0-9]{10}" maxlength="10">
            <input type="password" id="password" placeholder="Password" required minlength="6">
            <button type="submit" class="primary-btn">Signup</button>
        `;
    }
    else if (role === "driver") {
        title.innerText = "Driver Signup";
        roleButtons[1].classList.add("active");
        manualBox.style.display = "block";
        form.innerHTML = `
            <input type="text" id="name" placeholder="Name" required>
            <input type="tel" id="phone" placeholder="Phone Number (10 digits)" required pattern="[0-9]{10}" maxlength="10">
            <input type="text" id="vehicle" placeholder="Vehicle Type (e.g., Auto, Sedan)" required>
            <input type="text" id="vehicleNumber" placeholder="Vehicle Number (e.g., UP32AB1234)" required>
            <input type="password" id="password" placeholder="Password" required minlength="6">
            <label style="display: block; margin-bottom: 0.5rem; color: #667eea; font-weight: 600;">
                <input type="checkbox" id="useGPS" style="width: auto; margin-right: 0.5rem;"> Use Real-Time GPS Location
            </label>
            <button type="submit" class="primary-btn">Signup</button>
        `;
    }
    else if (role === "admin") {
        title.innerText = "Admin Signup";
        roleButtons[2].classList.add("active");
        form.innerHTML = `
            <input type="text" id="name" placeholder="Name" required>
            <input type="tel" id="phone" placeholder="Phone Number (10 digits)" required pattern="[0-9]{10}" maxlength="10">
            <input type="password" id="password" placeholder="Password" required minlength="6">
            <input type="text" id="adminCode" placeholder="Admin Code" required>
            <button type="submit" class="primary-btn">Signup</button>
        `;
    }

    // Re-attach form submit handler after updating innerHTML
    form.onsubmit = handleSignup;
}

// Add click listeners to role buttons
roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        setRole(btn.dataset.role);
    });
});

// Handle signup form submission
async function handleSignup(e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password")?.value;

    // Basic validation
    if (!name || !phone) {
        alert("Please fill in all required fields");
        return;
    }

    // Validate phone number
    if (!/^[0-9]{10}$/.test(phone)) {
        alert("Please enter a valid 10-digit phone number");
        return;
    }

    try {
        if (selectedRole === "rider") {
            // Create rider account
            const userCredential = await auth.createUserWithEmailAndPassword(
                `${phone}@rideapp.com`,
                password
            );

            const userId = userCredential.user.uid;

            // Save rider data to Firebase
            await ridersRef.child(userId).set({
                name: name,
                phone: phone,
                role: "rider",
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });

            // Save to localStorage
            localStorage.setItem("role", "rider");
            localStorage.setItem("userId", userId);
            localStorage.setItem("userName", name);
            localStorage.setItem("userPhone", phone);
            localStorage.setItem("isLoggedIn", "true");

            alert("Rider signup successful! Please login.");
            window.location.href = "index.html";

        } else if (selectedRole === "driver") {
            const vehicle = document.getElementById("vehicle").value.trim();
            const vehicleNumber = document.getElementById("vehicleNumber").value.trim();
            const useGPS = document.getElementById("useGPS").checked;

            if (!vehicle || !vehicleNumber) {
                alert("Please fill in all required fields");
                return;
            }

            // Create driver account
            const userCredential = await auth.createUserWithEmailAndPassword(
                `${phone}@rideapp.com`,
                password
            );

            const userId = userCredential.user.uid;

            // Prepare driver data
            const driverData = {
                name: name,
                phone: phone,
                vehicle: vehicle,
                vehicleNumber: vehicleNumber,
                available: true,
                role: "driver",
                useGPS: useGPS,
                isManualEntry: false,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };

            // If GPS is enabled, we'll get location later. Otherwise, default zone
            if (!useGPS) {
                driverData.currentZone = "Main Gate"; // Default zone for non-GPS
            }

            // Save driver data to Firebase
            await driversRef.child(userId).set(driverData);

            // Save to localStorage
            localStorage.setItem("role", "driver");
            localStorage.setItem("userId", userId);
            localStorage.setItem("driverName", name);
            localStorage.setItem("driverPhone", phone);
            localStorage.setItem("driverVehicle", vehicle);
            localStorage.setItem("driverVehicleNumber", vehicleNumber);
            localStorage.setItem("driverUseGPS", useGPS);
            localStorage.setItem("isLoggedIn", "true");

            alert("Driver signup successful! Please login.");
            window.location.href = "index.html";

        } else if (selectedRole === "admin") {
            const adminCode = document.getElementById("adminCode").value;
            
            if (adminCode !== "ADMIN2024") {
                alert("Invalid admin code!");
                return;
            }

            // Create admin account
            const userCredential = await auth.createUserWithEmailAndPassword(
                `${phone}@rideapp.com`,
                password
            );

            const userId = userCredential.user.uid;

            // Save admin data to Firebase
            await database.ref('admins').child(userId).set({
                name: name,
                phone: phone,
                role: "admin",
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });

            localStorage.setItem("role", "admin");
            localStorage.setItem("userId", userId);
            localStorage.setItem("userName", name);
            localStorage.setItem("isLoggedIn", "true");

            alert("Admin signup successful! Please login.");
            window.location.href = "index.html";
        }

    } catch (error) {
        console.error("Signup error:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("This phone number is already registered. Please login.");
        } else if (error.code === 'auth/weak-password') {
            alert("Password should be at least 6 characters long.");
        } else {
            alert(`Signup failed: ${error.message}`);
        }
    }
}

// Function to add manual driver (for drivers without smartphones)
async function addManualDriver() {
    const name = document.getElementById("manualName").value.trim();
    const phone = document.getElementById("manualPhone").value.trim();
    const vehicle = document.getElementById("manualVehicle").value.trim();
    const vehicleNo = document.getElementById("manualVehicleNo").value.trim();
    const zone = document.getElementById("manualZone").value;

    if (!name || !phone || !vehicle || !vehicleNo || !zone) {
        alert("Please fill in all fields to add a driver");
        return;
    }

    // Validate phone number
    if (!/^[0-9]{10}$/.test(phone)) {
        alert("Please enter a valid 10-digit phone number");
        return;
    }

    try {
        // Generate a unique ID for manual driver
        const manualDriverId = `manual_${generateId()}`;

        // Add manual driver to Firebase
        await driversRef.child(manualDriverId).set({
            name: name,
            phone: phone,
            vehicle: vehicle,
            vehicleNumber: vehicleNo,
            currentZone: zone,
            available: false, // Manual drivers are shown as "unavailable" but still searchable
            isManualEntry: true,
            alwaysShow: true, // Special flag to always show in searches
            role: "driver",
            useGPS: false,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
            addedBy: localStorage.getItem("userId") || "signup"
        });

        alert(`Driver ${name} added successfully to the system!\n\nNote: Manual drivers are marked as "Call to Check" since they don't have smartphones.`);

        // Clear form
        document.getElementById("manualName").value = "";
        document.getElementById("manualPhone").value = "";
        document.getElementById("manualVehicle").value = "";
        document.getElementById("manualVehicleNo").value = "";
        document.getElementById("manualZone").value = "";

    } catch (error) {
        console.error("Error adding manual driver:", error);
        alert(`Failed to add driver: ${error.message}`);
    }
}

// Populate zone dropdown for manual drivers
function populateManualZoneDropdown() {
    const manualZoneSelect = document.getElementById("manualZone");
    if (manualZoneSelect) {
        manualZoneSelect.innerHTML = '<option value="">Select Zone</option>';
        ZONES.forEach(zone => {
            const option = document.createElement('option');
            option.value = zone;
            option.textContent = zone;
            manualZoneSelect.appendChild(option);
        });
    }
}

// Initialize with rider role
setRole("rider");

// Load zones when page loads
window.addEventListener('DOMContentLoaded', () => {
    console.log("Signup page loaded. Firebase ready.");
    populateManualZoneDropdown();
});
