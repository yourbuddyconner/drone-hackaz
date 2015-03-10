//express offers routes and junk
var express = require('express');
var app = express();

// express addon that allows it to parse the HTTP request body
var bodyparser = require('body-parser');
//http server
var http = require('http');
var server = http.createServer(app);

//opens up access to TCP stream 
//var stream = require("dronestream");
//opens up the drone API to control
var arDrone = require('ar-drone');
var client = arDrone.createClient();

//flag that determines if the drone is flying
var flying = false;

var WebSocketServer = require('ws').Server,
        wss = new WebSocketServer({server: server, path: '/dronestream'}),
        sockets = [],
        Parser = require('./PaVEParser'),

options = {};
options.timeout = 4000;

var tcpVideoStream, parser;

//static files
app.use(express.static(__dirname + '/public'));


function init() {
    console.log("Connecting to drone on 192.168.1.1");

    tcpVideoStream = client.getVideoStream();

    tcpVideoStream.on('error', function (err) {
        console.log('There was an error: %s', err.message);
        tcpVideoStream.end();
        tcpVideoStream.emit("end");
        init();
    });

    parser = new Parser();
    // tcpVideoStream.on('data', function (data) {
    //     parser.write(data);

    // });
    parser.on('data', function (data) {
        sockets.forEach(function (socket) {
            socket.send(data.payload, {binary: true});
        });
    });
    tcpVideoStream.pipe(parser);
}
init();

wss.on('connection', function (socket) {
    sockets.push(socket);

    socket.on("close", function () {
        console.log("Closing socket");
        sockets = sockets.filter(function (el) {
            return el !== socket;
        });
    });
});
//End from dronestream

//static files
app.use(express.static(__dirname + '/public'));

app.use(bodyparser.urlencoded());

//routes
app.get('/', function(req, res) {
  res.sendfile('index.html');
});

app.post('/detectfaces', function(req, res) {
    jsfeat = require('jsfeat');


    //remove old listener
    parser.removeAllListeners('data');
    //add a new one that does what we want
    parser.on('data', function (data) {
        var Canvas = require('canvas'), 
            canvas = new Canvas(data.display_width, data.display_height),
            ctx = canvas.getContext('2d');
        ctx.drawImage(data.payload, 0, 0, data.display_width, data.display_height);
        var image_data = ctx.getImageData(0, 0, data.display_width, data.display_height);
        var gray_img = new jsfeat.matrix_t(data.display_width, data.display_height, jsfeat.U8_t | jsfeat.C1_t);
        var code = jsfeat.COLOR_RGB2GRAY;
        jsfeat.imgproc.grayscale(image_data.data, data.display_width, data.display_height, gray_img, code);


        sockets.forEach(function (socket) {
            socket.send(image_data.data, {binary: true});
        });
    });
});

//serve http requests at localhost:8080
server.listen(8080);
