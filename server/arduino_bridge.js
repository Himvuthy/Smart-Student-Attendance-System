const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');

// Configuration
const ARDUINO_PORT = 'COM6'; // <-- Change this to your Arduino's COM port (e.g., COM3, /dev/ttyUSB0)
const BAUD_RATE = 9600;
const SERVER_URL = 'http://localhost:3000/api/hardware';

console.log(`Connecting to Arduino on ${ARDUINO_PORT} at ${BAUD_RATE} baud...`);

const port = new SerialPort({
  path: ARDUINO_PORT,
  baudRate: BAUD_RATE,
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

port.on('open', () => {
  console.log('Successfully connected to Arduino!');
  console.log('Waiting for scanner events...');
  console.log('--------------------------------------------------');
  console.log('💡 TIP: You can type numbers here and press ENTER to send them to the Arduino!');
  console.log('--------------------------------------------------');

  // Start sending heartbeats every 5 seconds
  setInterval(() => {
    const payload = JSON.stringify({ deviceName: 'AS608-Serial', location: 'Lab 1' });
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/hardware/heartbeat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = http.request(options, (res) => {});
    req.on('error', (e) => {}); // Silent fail if server offline
    req.write(payload);
    req.end();
  }, 5000);
});

port.on('error', (err) => {
  console.error('Error connecting to Arduino: ', err.message);
  console.log('Please check that you have the correct COM port and that the Arduino IDE Serial Monitor is CLOSED.');
});

let pendingFingerIndex = null;

// Forward what you type in the terminal directly to the Arduino,
// UNLESS we are currently waiting for you to type a Student ID.
process.stdin.on('data', (data) => {
  if (pendingFingerIndex !== null) {
    const input = data.toString().trim();
    if (input) {
      const studentId = parseInt(input, 10);
      console.log(`>> Linking Fingerprint ID ${pendingFingerIndex} to Student ID ${studentId}...`);
      sendPostRequest('enroll', { 
        studentId: studentId, 
        fingerIndex: pendingFingerIndex 
      });
      pendingFingerIndex = null; // reset state
    }
  } else {
    // Normal operation: send input to Arduino
    port.write(data);
  }
});

// Helper function to send HTTP POST requests
const sendPostRequest = (endpoint, data) => {
  const payload = JSON.stringify(data);
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/hardware/${endpoint}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => responseData += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(responseData);
        if (json.success) {
          console.log(`✅ SUCCESS: ${json.message}`);
          if (json.student) console.log(`   Student: ${json.student} | Class: ${json.subject}`);
        } else {
          console.log(`❌ FAILED: ${json.error}`);
        }
      } catch(e) {
        console.log(`Server responded with status ${res.statusCode}`);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`❌ Network Error: Could not connect to backend. Is the server running? (${e.message})`);
  });

  req.write(payload);
  req.end();
};


// Listen to serial data from the Arduino
parser.on('data', (line) => {
  console.log(`[ARDUINO]: ${line}`);

  // Detect successful scan
  // e.g. "ID:5"
  const scanMatch = line.match(/^ID:\s*(\d+)$/);
  if (scanMatch) {
    const fingerIndex = parseInt(scanMatch[1], 10);
    console.log(`>> Detected attendance scan for Fingerprint ID ${fingerIndex}. Sending to server...`);
    sendPostRequest('scan', { fingerIndex });
  }

  // Detect successful enrollment
  // e.g. "Fingerprint stored as ID 5"
  const enrollMatch = line.match(/Fingerprint stored as ID\s*(\d+)/);
  if (enrollMatch) {
    const fingerIndex = parseInt(enrollMatch[1], 10);
    
    // Instead of hardcoding, we pause and ask the user for the Student ID
    pendingFingerIndex = fingerIndex;
    console.log(`\n======================================================`);
    console.log(`✅ Fingerprint ${fingerIndex} saved on sensor!`);
    console.log(`👉 PLEASE TYPE THE STUDENT ID FOR THIS FINGERPRINT AND PRESS ENTER:`);
    console.log(`======================================================\n`);
  }
});
