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
var drone = arDrone.createClient();

var cv = require('opencv');

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

app.post('/displaypngstream', function(req, res) {
    var pngStream = drone.getPngStream();
    var window = new cv.NamedWindow('Video', 0);

    pngStream
        .on('error', console.log)
        .on('data', function(pngBuffer) {
        
        cv.readImage(pngBuffer, function(err, im) {
            if (err) throw err;
            if (im.size()[0] > 0 && im.size()[1] > 0){
                window.show(im);
            }
            window.blockingWaitKey(0, 50);
        });
    });
});

app.post('/displaytcpstream', function(req, res) {
    var video = drone.getVideoStream();
    var window = new cv.NamedWindow('Video', 0);
    var PaVEParser = require('./node_modules/ar-drone/lib/video/PaVEParser');
    var parser = new PaVEParser();
    var encoder = new arDrone.Client.PngEncoder();

    parser.on('data', function(data) {
        cv.readImage(encoder.write(data.payload), function(err, im) {
            if (err) throw err;
            if (im.size()[0] > 0 && im.size()[1] > 0){
                window.show(im);
            }
            window.blockingWaitKey(0, 50);
        });
    });
    video.pipe(parser);
});

app.post('/detectFaces', function(req, res) {
    var pngStream = drone.getPngStream();
    var originalWindow = new cv.NamedWindow('Original', 1000);
    var filterWindow = new cv.NamedWindow('Filtered', 1000);
    var processingImage = false;
    var lastPng;

    pngStream
        .on('error', console.log)
        .on('data', function(pngBuffer) {
            //console.log("got image");
            lastPng = pngBuffer;

        cv.readImage(lastPng, function(err, im) {
            var lowThresh = 0;
            var highThresh = 100;
            var nIters = 2;
            var maxArea = 2500;

            var GREEN = [0, 255, 0]; // B, G, R
            var WHITE = [255, 255, 255]; // B, G, R
            var RED   = [0, 0, 255]; // B, G, R

            var lower_threshold = [20, 100, 100];
            var upper_threshold = [130, 255, 255];

            if (err) throw err;
            var width = im.width();
            var height = im.height();
            if (width < 1 || height < 1) throw new Error('Image has no size');
            var original = im.copy();

            im.inRange(RED, WHITE);
            // var big = new cv.Matrix(height, width);
            // var all = new cv.Matrix(height, width);

            // im.convertGrayscale();
            // im_canny = im.copy();

            // im_canny.canny(lowThresh, highThresh);
            // im_canny.dilate(nIters);

            // contours = im_canny.findContours();

            // for (i = 0; i < contours.size(); i++) {
            //     if (contours.area(i) > maxArea) {
            //         var moments = contours.moments(i);
            //         var cgx = Math.round(moments.m10 / moments.m00);
            //         var cgy = Math.round(moments.m01 / moments.m00);
            //         big.drawContour(contours, i, GREEN);
            //         big.line([cgx - 5, cgy], [cgx + 5, cgy], RED);
            //         big.line([cgx, cgy - 5], [cgx, cgy + 5], RED);
                // }       
        //}

        //all.drawAllContours(contours, WHITE);

        // big.save('./tmp/big.png');
        // all.save('./tmp/all.png');
        filterWindow.show(im);
        originalWindow.show(original);

        });
    });
//res.sendfile('./tmp/big.png');

});


//fetch stream and attach to server
//stream.listen(server);
//serve http requests at localhost:5555
server.listen(5555);