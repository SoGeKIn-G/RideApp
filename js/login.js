// Get DOM elements
const title = document.getElementById("roleTitle");
const roleButtons = document.querySelectorAll(".role-btn");
const loginForm = document.getElementById("loginForm");

let selectedRole = "rider"; // default

// Function to set role
function setRole(role) {
    selectedRole = role;

    // Remove active from all buttons
    roleButtons.forEach(btn => btn.classList.remove("active"));

    // Update title and active button
    if (role === "rider") {
        title.innerText = "Rider Login";
        roleButtons[0].classList.add("active");
    } 
    else if (role === "driver") {
        title.innerText = "Driver Login";
        roleButtons[1].classList.add("active");
    } 
    else if (role === "admin") {
        title.innerText = "Admin Login";
        roleButtons[2].classList.add("active");
    }
}

// Add click listeners to role buttons
roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        setRole(btn.dataset.role);
    });
});

// Function to handle login
async function login(e) {
    e.preventDefault();

    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const password = document.getElementById("password").value;

    // Basic validation
    if (!phoneNumber || !password) {
        alert("Please fill in all fields");
        return;
    }

    // Validate phone number format
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
        alert("Please enter a valid 10-digit phone number");
        return;
    }

    try {
        // Sign in with Firebase
        const userCredential = await auth.signInWithEmailAndPassword(
            `${phoneNumber}@rideapp.com`,
            password
        );

        const userId = userCredential.user.uid;

        // Verify user role matches selected role
        let userRole = null;
        let userData = null;

        // Check in respective database based on selected role
        if (selectedRole === "rider") {
            const snapshot = await ridersRef.child(userId).once('value');
            if (snapshot.exists()) {
                userData = snapshot.val();
                userRole = "rider";
            }
        } else if (selectedRole === "driver") {
            const snapshot = await driversRef.child(userId).once('value');
            if (snapshot.exists()) {
                userData = snapshot.val();
                userRole = "driver";
            }
        } else if (selectedRole === "admin") {
            const snapshot = await database.ref('admins').child(userId).once('value');
            if (snapshot.exists()) {
                userData = snapshot.val();
                userRole = "admin";
            }
        }

        // Check if user exists in correct role
        if (!userData || userRole !== selectedRole) {
            await auth.signOut();
            alert(`No ${selectedRole} account found with this phone number. Please check your role or signup.`);
            return;
        }

        // Save to localStorage
        localStorage.setItem("role", selectedRole);
        localStorage.setItem("userId", userId);
        localStorage.setItem("phoneNumber", phoneNumber);
        localStorage.setItem("userName", userData.name);
        localStorage.setItem("isLoggedIn", "true");

        // Save additional data based on role
        if (selectedRole === "driver") {
            localStorage.setItem("driverName", userData.name);
            localStorage.setItem("driverPhone", userData.phone);
            localStorage.setItem("driverVehicle", userData.vehicle);
            localStorage.setItem("driverVehicleNumber", userData.vehicleNumber);
            localStorage.setItem("driverLocation", userData.currentZone || "");
            localStorage.setItem("driverAvailable", userData.available ? "true" : "false");
            localStorage.setItem("driverUseGPS", userData.useGPS ? "true" : "false");
        }

        // Redirect based on role
        if (selectedRole === "rider") {
            window.location.href = "rider-home.html";
        } 
        else if (selectedRole === "driver") {
            window.location.href = "driver-home.html";
        } 
        else if (selectedRole === "admin") {
            window.location.href = "admin-home.html";
        }

    } catch (error) {
        console.error("Login error:", error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            alert("Invalid phone number or password. Please try again.");
        } else if (error.code === 'auth/too-many-requests') {
            alert("Too many failed login attempts. Please try again later.");
        } else {
            alert(`Login failed: ${error.message}`);
        }
    }
}

// Add submit event listener
loginForm.addEventListener('submit', login);

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged((user) => {
        if (user && localStorage.getItem("isLoggedIn") === "true") {
            const role = localStorage.getItem("role");
            if (role === "rider") {
                window.location.href = "rider-home.html";
            } else if (role === "driver") {
                window.location.href = "driver-home.html";
            } else if (role === "admin") {
                window.location.href = "admin-home.html";
            }
        }
    });
});
