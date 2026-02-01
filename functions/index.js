// Firebase Cloud Functions for SMS Gateway Integration
// File: functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.database();

// Service phone number for SMS Gateway
const SERVICE_NUMBER = '8979980464';

// Available zones
const ZONES = [
    "Hall 1", "Hall 2", "Hall 3", "Hall 4", "Hall 5",
    "Hall 6", "Hall 7", "Hall 8", "Hall 9", "Hall 10",
    "Hall 11", "Hall 12", "Hall 13",
    "Main Gate", "CC", "E Shop", "LHC", "Library",
    "SAC", "Outreach Auditorium"
];

/**
 * Webhook endpoint to receive SMS from Capcom6 SMS Gateway
 * URL: https://YOUR-PROJECT.cloudfunctions.net/smsWebhook
 */exports.receiveSMS = (req, res) => {
  console.log("RAW BODY:", JSON.stringify(req.body));

  const payload = req.body.payload;

  if (!payload) {
    console.error("No payload");
    return res.status(400).send("No payload");
  }

  const phoneNumber =
    payload.from || payload.phone || payload.sender;

  const message =
    payload.message || payload.text || payload.body;

  if (!phoneNumber || !message) {
    console.error("Missing phoneNumber or message", payload);
    return res.status(400).send("Missing phoneNumber or message");
  }

  console.log("SMS FROM:", phoneNumber);
  console.log("MESSAGE:", message);

  // TODO: store in Firestore / process logic

  return res.status(200).send("SMS received");
};

/**
 * Process SMS command from driver
 */
async function processSMSCommand(phoneNumber, message) {
    // Convert message to uppercase for case-insensitive matching
    const cmd = message.toUpperCase().trim();

    console.log('Processing command:', cmd, 'from phone:', phoneNumber);

    // Find driver by phone number
    const driver = await findDriverByPhone(phoneNumber);

    if (!driver) {
        return {
            success: false,
            action: 'error',
            message: 'Driver not found. Please register first.',
            sendConfirmation: true,
            confirmationMessage: 'ERROR: You are not registered as a driver. Please contact admin.'
        };
    }

    // Parse command
    if (cmd.startsWith('REG ')) {
        return await registerDriver(phoneNumber, message);
    } else if (cmd.startsWith('LOC ')) {
        return await updateLocation(driver.id, phoneNumber, message);
    } else if (cmd.startsWith('AVAIL ')) {
        return await updateAvailability(driver.id, phoneNumber, message);
    } else if (cmd === 'STATUS') {
        return await getDriverStatus(driver.id, phoneNumber);
    } else if (cmd === 'HELP') {
        return getHelpMessage();
    } else {
        return {
            success: false,
            action: 'error',
            message: 'Unknown command',
            sendConfirmation: true,
            confirmationMessage: 'Invalid command. Send HELP for instructions.'
        };
    }
}

/**
 * Register a new driver via SMS
 * Format: REG Name|Vehicle|VehicleNumber|Zone
 * Example: REG John Kumar|Auto|UP32AB1234|Main Gate
 */
async function registerDriver(phoneNumber, message) {
    try {
        // Extract registration data
        const parts = message.substring(4).split('|').map(p => p.trim());
        
        if (parts.length !== 4) {
            return {
                success: false,
                action: 'register_error',
                message: 'Invalid registration format',
                sendConfirmation: true,
                confirmationMessage: 'Format: REG Name|Vehicle|Number|Zone\nExample: REG John|Auto|UP32AB1234|Main Gate'
            };
        }

        const [name, vehicle, vehicleNumber, zone] = parts;

        // Validate zone
        if (!ZONES.includes(zone)) {
            return {
                success: false,
                action: 'register_error',
                message: 'Invalid zone',
                sendConfirmation: true,
                confirmationMessage: `Invalid zone. Available zones: ${ZONES.join(', ')}`
            };
        }

        // Check if driver already exists
        const existingDriver = await findDriverByPhone(phoneNumber);
        if (existingDriver) {
            return {
                success: false,
                action: 'register_error',
                message: 'Driver already registered',
                sendConfirmation: true,
                confirmationMessage: 'You are already registered. Use LOC or AVAIL commands to update.'
            };
        }

        // Generate unique ID
        const driverId = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Register driver in Firebase
        await db.ref(`drivers/${driverId}`).set({
            name: name,
            phone: phoneNumber,
            vehicle: vehicle,
            vehicleNumber: vehicleNumber,
            currentZone: zone,
            available: true,
            isManualEntry: true,
            isSMSDriver: true,
            alwaysShow: true,
            role: "driver",
            useGPS: false,
            registeredVia: "SMS",
            createdAt: admin.database.ServerValue.TIMESTAMP,
            lastUpdated: admin.database.ServerValue.TIMESTAMP
        });

        console.log('Driver registered successfully:', driverId);

        return {
            success: true,
            action: 'register_success',
            message: 'Driver registered successfully',
            sendConfirmation: true,
            confirmationMessage: `Welcome ${name}! You are now registered.\nZone: ${zone}\nStatus: Available\n\nCommands:\nLOC <zone> - Update location\nAVAIL ON/OFF - Change availability\nSTATUS - Check status\nHELP - Get help`
        };

    } catch (error) {
        console.error('Error registering driver:', error);
        return {
            success: false,
            action: 'register_error',
            message: error.message,
            sendConfirmation: true,
            confirmationMessage: 'Registration failed. Please try again or contact support.'
        };
    }
}

/**
 * Update driver location
 * Format: LOC Zone Name
 * Example: LOC Main Gate
 */
async function updateLocation(driverId, phoneNumber, message) {
    try {
        // Extract zone name
        const zone = message.substring(4).trim();

        // Validate zone
        if (!ZONES.includes(zone)) {
            return {
                success: false,
                action: 'location_error',
                message: 'Invalid zone',
                sendConfirmation: true,
                confirmationMessage: `Invalid zone "${zone}".\n\nAvailable zones:\n${ZONES.join(', ')}\n\nExample: LOC Main Gate`
            };
        }

        // Update driver location in Firebase
        await db.ref(`drivers/${driverId}`).update({
            currentZone: zone,
            lastUpdated: admin.database.ServerValue.TIMESTAMP
        });

        console.log('Location updated for driver:', driverId, 'to zone:', zone);

        return {
            success: true,
            action: 'location_updated',
            message: 'Location updated successfully',
            sendConfirmation: true,
            confirmationMessage: `Location updated to: ${zone}\nTime: ${new Date().toLocaleTimeString('en-IN')}`
        };

    } catch (error) {
        console.error('Error updating location:', error);
        return {
            success: false,
            action: 'location_error',
            message: error.message,
            sendConfirmation: true,
            confirmationMessage: 'Failed to update location. Please try again.'
        };
    }
}

/**
 * Update driver availability
 * Format: AVAIL ON or AVAIL OFF
 * Example: AVAIL ON
 */
async function updateAvailability(driverId, phoneNumber, message) {
    try {
        // Extract availability status
        const status = message.substring(6).trim().toUpperCase();

        if (status !== 'ON' && status !== 'OFF') {
            return {
                success: false,
                action: 'availability_error',
                message: 'Invalid availability status',
                sendConfirmation: true,
                confirmationMessage: 'Use: AVAIL ON or AVAIL OFF'
            };
        }

        const available = status === 'ON';

        // Update driver availability in Firebase
        await db.ref(`drivers/${driverId}`).update({
            available: available,
            alwaysShow: !available, // If offline, still show in searches
            lastUpdated: admin.database.ServerValue.TIMESTAMP
        });

        console.log('Availability updated for driver:', driverId, 'to:', available);

        return {
            success: true,
            action: 'availability_updated',
            message: 'Availability updated successfully',
            sendConfirmation: true,
            confirmationMessage: available 
                ? '✅ You are now AVAILABLE for rides\nRiders can now see you in search results.'
                : '❌ You are now OFFLINE\nRiders can still see your number but must call to confirm availability.'
        };

    } catch (error) {
        console.error('Error updating availability:', error);
        return {
            success: false,
            action: 'availability_error',
            message: error.message,
            sendConfirmation: true,
            confirmationMessage: 'Failed to update availability. Please try again.'
        };
    }
}

/**
 * Get driver current status
 */
async function getDriverStatus(driverId, phoneNumber) {
    try {
        const snapshot = await db.ref(`drivers/${driverId}`).once('value');
        const driver = snapshot.val();

        if (!driver) {
            return {
                success: false,
                action: 'status_error',
                message: 'Driver not found',
                sendConfirmation: true,
                confirmationMessage: 'Driver profile not found.'
            };
        }

        const statusMessage = `📊 YOUR STATUS\n\n` +
            `Name: ${driver.name}\n` +
            `Vehicle: ${driver.vehicle} (${driver.vehicleNumber})\n` +
            `Zone: ${driver.currentZone}\n` +
            `Status: ${driver.available ? '✅ Available' : '❌ Offline'}\n` +
            `Last Updated: ${new Date(driver.lastUpdated).toLocaleString('en-IN')}\n\n` +
            `Send HELP for commands`;

        return {
            success: true,
            action: 'status_retrieved',
            message: 'Status retrieved',
            sendConfirmation: true,
            confirmationMessage: statusMessage
        };

    } catch (error) {
        console.error('Error getting status:', error);
        return {
            success: false,
            action: 'status_error',
            message: error.message,
            sendConfirmation: true,
            confirmationMessage: 'Failed to get status. Please try again.'
        };
    }
}

/**
 * Get help message with all commands
 */
function getHelpMessage() {
    const helpText = `📱 RIDEAPP SMS COMMANDS\n\n` +
        `🆕 REGISTER (First Time):\n` +
        `REG Name|Vehicle|Number|Zone\n` +
        `Example: REG John|Auto|UP32AB1234|Main Gate\n\n` +
        
        `📍 UPDATE LOCATION:\n` +
        `LOC Zone Name\n` +
        `Example: LOC Hall 10\n\n` +
        
        `✅ GO ONLINE:\n` +
        `AVAIL ON\n\n` +
        
        `❌ GO OFFLINE:\n` +
        `AVAIL OFF\n\n` +
        
        `📊 CHECK STATUS:\n` +
        `STATUS\n\n` +
        
        `❓ GET HELP:\n` +
        `HELP\n\n` +
        
        `Available Zones:\n${ZONES.slice(0, 5).join(', ')}, and more...\n\n` +
        
        `Send to: ${SERVICE_NUMBER}`;

    return {
        success: true,
        action: 'help',
        message: 'Help message',
        sendConfirmation: true,
        confirmationMessage: helpText
    };
}

/**
 * Find driver by phone number
 */
async function findDriverByPhone(phoneNumber) {
    try {
        const snapshot = await db.ref('drivers')
            .orderByChild('phone')
            .equalTo(phoneNumber)
            .once('value');

        if (snapshot.exists()) {
            const drivers = snapshot.val();
            const driverId = Object.keys(drivers)[0];
            return {
                id: driverId,
                ...drivers[driverId]
            };
        }

        return null;
    } catch (error) {
        console.error('Error finding driver:', error);
        return null;
    }
}

/**
 * Clean phone number (remove +91, spaces, dashes)
 */
function cleanPhoneNumber(phone) {
    return phone.replace(/[\s\-\+]/g, '').replace(/^91/, '');
}

/**
 * Send confirmation SMS back to driver
 * This uses Capcom6 SMS Gateway API to send SMS
 */
async function sendConfirmationSMS(phoneNumber, message) {
    try {
        // Note: You'll need to set up Capcom6 API credentials in Firebase Config
        const capcom6ApiUrl = functions.config().capcom6?.api_url || 'YOUR_CAPCOM6_API_URL';
        const capcom6ApiKey = functions.config().capcom6?.api_key || 'YOUR_API_KEY';

        // Capcom6 API call to send SMS
        const response = await fetch(capcom6ApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${capcom6ApiKey}`
            },
            body: JSON.stringify({
                phoneNumber: phoneNumber,
                message: message
            })
        });

        if (response.ok) {
            console.log('Confirmation SMS sent to:', phoneNumber);
        } else {
            console.error('Failed to send confirmation SMS:', await response.text());
        }

    } catch (error) {
        console.error('Error sending confirmation SMS:', error);
        // Don't throw error - SMS sending failure shouldn't break the webhook
    }
}

/**
 * Test endpoint to verify webhook is working
 */
exports.testWebhook = functions.https.onRequest((req, res) => {
    res.status(200).json({
        success: true,
        message: 'Webhook is working!',
        timestamp: new Date().toISOString(),
        serviceNumber: SERVICE_NUMBER
    });
});
