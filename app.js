// ============================================================================
// ESP32 Robotic Arm - Web Interface BLE Controller
// ============================================================================

// Global Variables
let device = null;
let server = null;
let service = null;
let rxCharacteristic = null;

// Nordic UART Service UUIDs
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// Joint angle tracking
const jointAngles = {
    base: 90,
    shoulder: 130,
    elbow: 90,
    wrist: 90,
    gripper: 90
};

// Command mapping
const commandMap = {
    'A': 'base-inc',
    'B': 'base-dec',
    'C': 'shoulder-inc',
    'D': 'shoulder-dec',
    'E': 'elbow-inc',
    'F': 'elbow-dec',
    'G': 'wrist-inc',
    'H': 'wrist-dec',
    'I': 'gripper-inc',
    'J': 'gripper-dec'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Add log message to console
 * @param {string} message - Message to log
 * @param {string} type - 'info', 'success', 'error', 'warning'
 */
function addLog(message, type = 'info') {
    const consoleElement = document.getElementById('console');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `console-log ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    consoleElement.appendChild(logEntry);
    consoleElement.scrollTop = consoleElement.scrollHeight;
}

/**
 * Update joint angle display
 * @param {string} joint - Joint name
 * @param {number} angle - Angle value
 */
function updateAngleDisplay(joint, angle) {
    const element = document.getElementById(`angle${joint.charAt(0).toUpperCase() + joint.slice(1)}`);
    if (element) {
        element.textContent = angle;
    }
    jointAngles[joint] = angle;
}

/**
 * Update UI button states
 */
function updateUIState() {
    const isConnected = device !== null && server !== null;
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const jointButtons = document.querySelectorAll('.btn-joint, .btn-preset');

    connectBtn.disabled = isConnected;
    disconnectBtn.disabled = !isConnected;

    jointButtons.forEach(btn => {
        btn.disabled = !isConnected;
    });
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected = false) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    if (connected) {
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected ✓';
        addLog('Connected to BLE device', 'success');
    } else {
        statusIndicator.classList.remove('connected');
        statusText.textContent = 'Disconnected';
        addLog('Disconnected from BLE device', 'info');
    }

    updateUIState();
}

// ============================================================================
// BLE COMMUNICATION FUNCTIONS
// ============================================================================

/**
 * Send command to ESP32 via BLE
 * @param {string} command - Single character command ('A'-'J')
 */
async function sendCommand(command) {
    if (!device || !rxCharacteristic) {
        addLog('Error: Device not connected', 'error');
        return;
    }

    try {
        // Convert command to Uint8Array
        const encoder = new TextEncoder();
        const data = encoder.encode(command);

        // Send command to ESP32
        await rxCharacteristic.writeValue(data);

        addLog(`Sent command: ${command}`, 'success');

        // Update local angle tracking
        updateLocalAngle(command);
    } catch (error) {
        addLog(`Error sending command: ${error.message}`, 'error');
    }
}

/**
 * Update local angle tracking after command
 * @param {string} command - Command sent
 */
function updateLocalAngle(command) {
    const stepSize = 10;

    switch (command) {
        case 'A':
            updateAngleDisplay('base', Math.min(jointAngles.base + stepSize, 180));
            break;
        case 'B':
            updateAngleDisplay('base', Math.max(jointAngles.base - stepSize, 0));
            break;
        case 'C':
            updateAngleDisplay('shoulder', Math.min(jointAngles.shoulder + stepSize, 210));
            break;
        case 'D':
            updateAngleDisplay('shoulder', Math.max(jointAngles.shoulder - stepSize, 120));
            break;
        case 'E':
            updateAngleDisplay('elbow', Math.min(jointAngles.elbow + stepSize, 180));
            break;
        case 'F':
            updateAngleDisplay('elbow', Math.max(jointAngles.elbow - stepSize, 0));
            break;
        case 'G':
            updateAngleDisplay('wrist', Math.min(jointAngles.wrist + stepSize, 180));
            break;
        case 'H':
            updateAngleDisplay('wrist', Math.max(jointAngles.wrist - stepSize, 0));
            break;
        case 'I':
            updateAngleDisplay('gripper', Math.min(jointAngles.gripper + stepSize, 180));
            break;
        case 'J':
            updateAngleDisplay('gripper', Math.max(jointAngles.gripper - stepSize, 0));
            break;
    }
}

/**
 * Connect to BLE device
 */
async function connectDevice() {
    try {
        addLog('Scanning for BLE devices...', 'info');

        // Request device
        device = await navigator.bluetooth.requestDevice({
            filters: [
                { name: 'RoboticArm-BLE' }
            ],
            optionalServices: [SERVICE_UUID]
        });

        addLog(`Found device: ${device.name}`, 'info');
        document.getElementById('deviceName').textContent = `Connected: ${device.name}`;

        // Connect to GATT server
        server = await device.gatt.connect();
        addLog('Connected to GATT server', 'success');

        // Get service
        service = await server.getPrimaryService(SERVICE_UUID);
        addLog('Found Nordic UART service', 'success');

        // Get RX characteristic
        rxCharacteristic = await service.getCharacteristic(RX_CHAR_UUID);
        addLog('Found RX characteristic', 'success');

        updateConnectionStatus(true);

        // Handle disconnection
        device.addEventListener('gattserverdisconnected', onDisconnected);

    } catch (error) {
        addLog(`Connection error: ${error.message}`, 'error');
        updateConnectionStatus(false);
    }
}

/**
 * Disconnect from BLE device
 */
async function disconnectDevice() {
    if (device && device.gatt.connected) {
        try {
            device.gatt.disconnect();
            addLog('Disconnecting from device...', 'info');
        } catch (error) {
            addLog(`Disconnection error: ${error.message}`, 'error');
        }
    }
}

/**
 * Handle device disconnection
 */
function onDisconnected() {
    device = null;
    server = null;
    service = null;
    rxCharacteristic = null;
    updateConnectionStatus(false);
}

// ============================================================================
// PRESET POSITIONS
// ============================================================================

/**
 * Home position - All joints at 90 degrees
 */
async function moveToHome() {
    addLog('Moving to HOME position...', 'info');
    const commands = ['B', 'B', 'B', 'B', 'B', 'D', 'D', 'D', 'D', 'D', 'F', 'F', 'F', 'F', 'F', 'H', 'H', 'H', 'H', 'H', 'J', 'J', 'J', 'J', 'J'];

    for (const cmd of commands) {
        await sendCommand(cmd);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Reset all angles to 90
    updateAngleDisplay('base', 90);
    updateAngleDisplay('shoulder', 90);
    updateAngleDisplay('elbow', 90);
    updateAngleDisplay('wrist', 90);
    updateAngleDisplay('gripper', 90);

    addLog('Reached HOME position', 'success');
}

/**
 * Grab position - Arms positioned to grab something
 */
async function moveToGrab() {
    addLog('Moving to GRAB position...', 'info');

    // Example: Shoulder down, Elbow extend, Gripper close
    const sequence = [
        { cmd: 'D', count: 3, desc: 'Lower shoulder' },
        { cmd: 'E', count: 2, desc: 'Extend elbow' },
        { cmd: 'J', count: 5, desc: 'Close gripper' }
    ];

    for (const step of sequence) {
        for (let i = 0; i < step.count; i++) {
            await sendCommand(step.cmd);
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }

    addLog('Reached GRAB position', 'success');
}

/**
 * Reach position - Arm fully extended upward
 */
async function moveToReach() {
    addLog('Moving to REACH position...', 'info');

    // Example: Shoulder up, Elbow extend, Wrist up
    const sequence = [
        { cmd: 'C', count: 4, desc: 'Raise shoulder' },
        { cmd: 'E', count: 3, desc: 'Extend elbow' },
        { cmd: 'G', count: 2, desc: 'Raise wrist' },
        { cmd: 'I', count: 3, desc: 'Open gripper' }
    ];

    for (const step of sequence) {
        for (let i = 0; i < step.count; i++) {
            await sendCommand(step.cmd);
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }

    addLog('Reached REACH position', 'success');
}

/**
 * Reset all joints to initial position
 */
async function resetAll() {
    addLog('Resetting all joints...', 'info');
    await moveToHome();
}

// ============================================================================
// EVENT LISTENERS & INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    addLog('Web Interface Loaded', 'success');
    addLog('Waiting for connection...', 'info');

    // Connection buttons
    document.getElementById('connectBtn').addEventListener('click', connectDevice);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectDevice);

    // Joint control buttons
    document.querySelectorAll('.btn-joint').forEach(button => {
        button.addEventListener('click', async () => {
            const command = button.getAttribute('data-command');
            await sendCommand(command);
        });
    });

    // Preset buttons
    document.getElementById('presetHome').addEventListener('click', moveToHome);
    document.getElementById('presetGrab').addEventListener('click', moveToGrab);
    document.getElementById('presetReach').addEventListener('click', moveToReach);
    document.getElementById('presetReset').addEventListener('click', resetAll);

    // Initial UI state
    updateUIState();

    // Check BLE support
    if (!navigator.bluetooth) {
        addLog('Warning: Bluetooth API not supported in this browser', 'warning');
        addLog('Please use Chrome, Edge, or Opera on desktop or Android', 'warning');
    } else {
        addLog('Bluetooth API available', 'success');
    }
});

// ============================================================================
// KEYBOARD SHORTCUTS (Optional)
// ============================================================================

document.addEventListener('keydown', (event) => {
    if (!device || !rxCharacteristic) return;

    const keyMap = {
        'a': 'A', 'A': 'A',  // Base left
        'b': 'B', 'B': 'B',  // Base right
        'c': 'C', 'C': 'C',  // Shoulder up
        'd': 'D', 'D': 'D',  // Shoulder down
        'e': 'E', 'E': 'E',  // Elbow extend
        'f': 'F', 'F': 'F',  // Elbow retract
        'g': 'G', 'G': 'G',  // Wrist up
        'h': 'H', 'H': 'H',  // Wrist down
        'i': 'I', 'I': 'I',  // Gripper open
        'j': 'J', 'J': 'J'   // Gripper close
    };

    if (event.key in keyMap) {
        sendCommand(keyMap[event.key]);
        event.preventDefault();
    }
});
