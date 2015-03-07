//express offers routes and junk
var express = require('express');
var app = express();
// express addon that allows it to parse the HTTP request body
var bodyparser = require('body-parser');
//http server
var http = require('http');
var server = http.createServer(app);

//opens up access to TCP stream 
var stream = require("dronestream");
//opens up the drone API to control
var arDrone = require('ar-drone');
var drone = arDrone.createClient();

app.use(bodyparser.urlencoded());

//routes
app.get('/', function(req, res) {
  res.sendfile('index.html');
});


//API routes
app.post('/', function(req, res) {
  console.log(req.body);
});
// makes drone takeoff, turn clockwise, and land
app.post('/takeoff', function(req, res) {
    drone.takeoff()
});

app.post('/clockwise', function(req, res) {
    drone.clockwise(0.25);
});

app.post('/stop', function(req, res) {
    drone.stop();
});

app.post('/land', function(req, res) {
    drone.land();
});

//fetch stream and attach to server
stream.listen(server);
//serve http requests at localhost:5555
server.listen(5555);