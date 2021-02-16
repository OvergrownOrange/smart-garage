const express = require('express');
const bodyParser = require('body-parser');
const gpio = require('onoff').Gpio;
const basicAuth = require('express-basic-auth');
const auth = require('./auth.json');
const app = express();
const port = 5000;

const garageGPIO = new gpio(23,'out');
const sensorGPIO = new gpio(24,'in');
const actionTime = 5000;       // Time taken for door to move (Needs to be measured in millis)

var garageStatus = "Unknown";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(basicAuth( { 
    authorizer: myAuthorizer,
    unauthorizedResponse: "Unauthorised!!"
}))

app.put('/api/garage/v1.0', (req, res) => {
    log(`Received PUT request: ${req.body.action}`);
    res.send(performAction(req.body.action));
})

app.listen(port, () => {
    console.log(`Smart Garage App listening at http://localhost:${port}`);
})

function myAuthorizer(username,password) {
    const userMatches = basicAuth.safeCompare(username, auth.user);
    const passwordMatches = basicAuth.safeCompare(password, auth.passwd);
 
    return userMatches & passwordMatches;
}

function log(message) {
    let now = new Date();

    let day = now.getDate();
    let month = now.getMonth()+1;
    let year = now.getFullYear();
    let hour = now.getHours();
    let minute = now.getMinutes();
    let second = now.getSeconds();

    let dateStamp = year+"/"+month+"/"+day+" "+hour+":"+minute+"."+second
    
    console.log(dateStamp+" - "+message);
}

function updateStatus() {
    garageStatus = sensorGPIO.readSync() ? "closed" : "open";
}

async function triggerGarage() {      // This function closes and opens the relay
    garageGPIO.writeSync(0);
    await sleep(500);
    garageGPIO.writeSync(1);
    await sleep(500);
    garageGPIO.writeSync(0);
    log("Garage Door Triggered")
    await sleep(actionTime)
}

async function performAction(action) {
    updateStatus();     // Get a fresh update on where the door is at

    switch(action) {
        case "open":
            log("Garage Door Opening...");
            if(garageStatus == "open") {    // The garage is already open!
                return "Garage is already open!";
            } else {
                triggerGarage();
                updateStatus();
                return "Garage Door Opened";
            }
            break;
        case "close":
            log("Garage Door Closing...");
            if(garageStatus == "closed") {
                return "Garage is already closed!";
            } else {
                await triggerGarage();
                updateStatus();
                if(garageStatus == "closed") {
                    return "Garage Door Closed";
                } else {
                    log("Went wrong way! Re-performing Action");    // The last trigger must have fully opened the door, trigger again
                    return performAction(action);
                }
            }
            break;
        default:
            return `Error! Unknown Action ${action}`;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}