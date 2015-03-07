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

//static files
app.use(express.static(__dirname + '/public'));

//autonomous flight
var autonomy = require('ardrone-autonomy');
var circle  = autonomy.createMission();

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

//take off, zero then attempt an octogon circle
app.post('/circle-attempt', function(req, res){
	circle.takeoff()
		.zero()
		.cw(30)
		.right(1)
		.cw(30)
		.right(1)
		.cw(30)
		.right(1)
		.cw(30)
		.right(1)
		.cw(30)
		.right(1)
		.cw(30)
		.right(1)
		.cw(30)
		.right(1)
		.cw(30)
		.right(1)
		.hover(1000)
		.land();

	circle.run(function (err, result) {
    if (err) {
        console.trace("Oops, something bad happened: %s", err.message);
        circle.client().stop();
        circle.client().land();
    } else {
        console.log("Mission success!");
        process.exit(0);
    }
});
});	


//fetch stream and attach to server
stream.listen(server);
//serve http requests at localhost:5555
server.listen(5555);