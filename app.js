// ============================================================================
// ESP32 Robotic Arm - Web Interface BLE Controller
// ============================================================================

// BLE Variables
let device = null;
let server = null;
let service = null;
let rxCharacteristic = null;

// Nordic UART UUID
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

// Joint angles
const jointAngles = {
    base: 90,
    shoulder: 90,
    elbow: 90,
    wrist: 90,
    gripper: 90
};

// Servo limits (match ESP32 code)
const limits = {
    base: {min:0,max:180},
    shoulder:{min:70,max:140},
    elbow:{min:0,max:180},
    wrist:{min:0,max:180},
    gripper:{min:20,max:160}
};

// Prevent command flooding
let lastCommandTime = 0;

// ============================================================================
// LOGGING
// ============================================================================

function addLog(message,type="info")
{
    const consoleElement=document.getElementById("console");
    const time=new Date().toLocaleTimeString();

    const line=document.createElement("div");
    line.className=`console-log ${type}`;
    line.textContent=`[${time}] ${message}`;

    consoleElement.appendChild(line);
    consoleElement.scrollTop=consoleElement.scrollHeight;
}

// ============================================================================
// UI UPDATE
// ============================================================================

function updateAngleDisplay(joint,angle)
{
    const element=document.getElementById(`angle${joint.charAt(0).toUpperCase()+joint.slice(1)}`);
    if(element) element.textContent=angle;

    jointAngles[joint]=angle;
}

function updateUIState()
{
    const connected=device!==null && server!==null;

    document.getElementById("connectBtn").disabled=connected;
    document.getElementById("disconnectBtn").disabled=!connected;

    document.querySelectorAll(".btn-joint,.btn-preset").forEach(btn=>{
        btn.disabled=!connected;
    });
}

function updateConnectionStatus(connected=false)
{
    const indicator=document.getElementById("statusIndicator");
    const text=document.getElementById("statusText");

    if(connected)
    {
        indicator.classList.add("connected");
        text.textContent="Connected ✓";
        addLog("Connected to ESP32","success");
    }
    else
    {
        indicator.classList.remove("connected");
        text.textContent="Disconnected";
        addLog("Disconnected","info");
    }

    updateUIState();
}

// ============================================================================
// BLE COMMAND
// ============================================================================

async function sendCommand(command)
{
    if(!rxCharacteristic)
    {
        addLog("Device not connected","error");
        return;
    }

    const now=Date.now();

    if(now-lastCommandTime<80)
        return;

    lastCommandTime=now;

    try
    {
        const encoder=new TextEncoder();
        const data=encoder.encode(command);

        await rxCharacteristic.writeValue(data);

        addLog(`Command sent: ${command}`,"success");

        updateLocalAngle(command);

    }
    catch(error)
    {
        addLog("BLE send error: "+error.message,"error");
    }
}

// ============================================================================
// LOCAL ANGLE UPDATE
// ============================================================================

function updateLocalAngle(cmd)
{
    const step=10;

    switch(cmd)
    {

        case "A":
        updateAngleDisplay("base",
        Math.min(jointAngles.base+step,limits.base.max));
        break;

        case "B":
        updateAngleDisplay("base",
        Math.max(jointAngles.base-step,limits.base.min));
        break;

        case "C":
        updateAngleDisplay("shoulder",
        Math.min(jointAngles.shoulder+step,limits.shoulder.max));
        break;

        case "D":
        updateAngleDisplay("shoulder",
        Math.max(jointAngles.shoulder-step,limits.shoulder.min));
        break;

        case "E":
        updateAngleDisplay("elbow",
        Math.min(jointAngles.elbow+step,limits.elbow.max));
        break;

        case "F":
        updateAngleDisplay("elbow",
        Math.max(jointAngles.elbow-step,limits.elbow.min));
        break;

        case "G":
        updateAngleDisplay("wrist",
        Math.min(jointAngles.wrist+step,limits.wrist.max));
        break;

        case "H":
        updateAngleDisplay("wrist",
        Math.max(jointAngles.wrist-step,limits.wrist.min));
        break;

        case "I":
        updateAngleDisplay("gripper",
        Math.min(jointAngles.gripper+step,limits.gripper.max));
        break;

        case "J":
        updateAngleDisplay("gripper",
        Math.max(jointAngles.gripper-step,limits.gripper.min));
        break;
    }
}

// ============================================================================
// BLE CONNECTION
// ============================================================================

async function connectDevice()
{
    try
    {

        addLog("Scanning BLE devices...");

        device=await navigator.bluetooth.requestDevice({
            filters:[{name:"RoboticArm-BLE"}],
            optionalServices:[SERVICE_UUID]
        });

        document.getElementById("deviceName").textContent=
        `Connected: ${device.name}`;

        server=await device.gatt.connect();
        service=await server.getPrimaryService(SERVICE_UUID);

        rxCharacteristic=await service.getCharacteristic(RX_CHAR_UUID);

        device.addEventListener(
            "gattserverdisconnected",
            onDisconnected
        );

        updateConnectionStatus(true);

    }
    catch(error)
    {
        addLog("Connection failed: "+error.message,"error");
        updateConnectionStatus(false);
    }
}

async function disconnectDevice()
{
    if(device && device.gatt.connected)
    {
        device.gatt.disconnect();
    }
}

function onDisconnected()
{
    device=null;
    server=null;
    service=null;
    rxCharacteristic=null;

    updateConnectionStatus(false);
}

// ============================================================================
// PRESETS
// ============================================================================

async function moveToHome()
{

    addLog("Moving to home position...");

    const sequence=[
        ["base",90],
        ["shoulder",90],
        ["elbow",90],
        ["wrist",90],
        ["gripper",90]
    ];

    for(const joint of sequence)
    {
        updateAngleDisplay(joint[0],joint[1]);
    }

    await sendCommand("R");
}

async function moveToGrab()
{
    addLog("Grab position");

    await sendCommand("D");
    await sleep(200);

    await sendCommand("E");
    await sleep(200);

    await sendCommand("J");
}

async function moveToReach()
{
    addLog("Reach position");

    await sendCommand("C");
    await sleep(200);

    await sendCommand("E");
    await sleep(200);

    await sendCommand("G");
}

async function resetAll()
{
    addLog("Sequential reset command sent");

    await sendCommand("R");

    updateAngleDisplay("base",90);
    updateAngleDisplay("shoulder",90);
    updateAngleDisplay("elbow",90);
    updateAngleDisplay("wrist",90);
    updateAngleDisplay("gripper",90);
}

// ============================================================================
// UTIL
// ============================================================================

function sleep(ms)
{
    return new Promise(resolve=>setTimeout(resolve,ms));
}

// ============================================================================
// INIT
// ============================================================================

document.addEventListener("DOMContentLoaded",()=>{

    addLog("Interface loaded","success");

    document
    .getElementById("connectBtn")
    .addEventListener("click",connectDevice);

    document
    .getElementById("disconnectBtn")
    .addEventListener("click",disconnectDevice);

    document
    .querySelectorAll(".btn-joint")
    .forEach(btn=>{

        btn.addEventListener("click",()=>{
            const cmd=btn.getAttribute("data-command");
            sendCommand(cmd);
        });

    });

    document
    .getElementById("presetHome")
    .addEventListener("click",moveToHome);

    document
    .getElementById("presetGrab")
    .addEventListener("click",moveToGrab);

    document
    .getElementById("presetReach")
    .addEventListener("click",moveToReach);

    document
    .getElementById("presetReset")
    .addEventListener("click",resetAll);

    updateUIState();

    if(!navigator.bluetooth)
    {
        addLog("Web Bluetooth not supported in this browser","warning");
    }
    else
    {
        addLog("Bluetooth API ready","success");
    }

});
