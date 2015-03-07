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
var drone = require("ar-drone");

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
app.post('/clockwise', function(req, res) {
    drone.takeoff()

    drone.after(3000, function() {
        this.clockwise(0.5);
    })
    .after(3000, function() {
        this.land();
    });
});

//fetch stream and attach to server
stream.listen(server);
//serve http requests at localhost:5555
server.listen(5555);