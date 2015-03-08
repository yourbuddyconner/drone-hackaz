//express offers routes and junk
var express = require('express');
var app = express();
// express addon that allows it to parse the HTTP request body
var bodyparser = require('body-parser');
//http server
var http = require('http');
var server = http.createServer(app);
var cv = require('opencv');


//opens up access to TCP stream 
//var stream = require("dronestream");
//opens up the drone API to control
var arDrone = require('ar-drone');
var client = arDrone.createClient();

//flag that determines if the drone is flying
var flying = false;

//static files
app.use(express.static(__dirname + '/public'));

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
    client.takeoff()
});

app.post('/clockwise', function(req, res) {
    client.clockwise(0.25);
});

app.post('/stop', function(req, res) {
    client.stop();
});

app.post('/land', function(req, res) {
    client.land();
});

app.post('/facefinder', function(req, res) {
    // variable declarations
    // max # of misses before search
    const MISSES = 10;
    var missCounter = MISSES;

    //drone client API
    //var client = arDrone.createClient();
    //open image stream from drone
    var pngStream = client.getPngStream();
    var lastPng;
    //flag to prevent two image processing events
    var processingImage = false;
    //flag that determines if the drone is searching
    var searching = false;
    //flight time recorder
    var startTime = new Date().getTime();
    var win = new cv.NamedWindow('Face Feed', 0);
    var log = function(s) {
    var time = ((new Date().getTime() - startTime ) / 1000 ).toFixed(2);
      console.log(time + ' \t'+s);
    }

    // set up the stream
    pngStream
      .on('error', console.log)
      .on('data', function(pngBuffer) {
        lastPng = pngBuffer;
        detectFaces();
      });

    //correct trim
    log("Correct Trim");
    client.ftrim();

    log("Battery: " + client.battery());
    //setup mission
    log("Taking Off");
    client.takeoff();
    
    client.after(5000, function() {
      log('going up');
      this.up(.25);
    }).after(2000, function() {
      log('stopping');
      this.stop();
      flying = true;
    });

    // client.after(30000, function() {
    //     flying = false;
    //     this.stop();
    //     this.land();
    // });

    // detect faces and react to them
    var detectFaces = function() {
      if (flying == true) {
        if ((!processingImage) && lastPng ) {
          //tell the world we're doing something
          processingImage = true;
          cv.readImage(lastPng, function(err, im) {
            //save image to window
            win.show(im);
            var opts = {};
            im.detectObject(cv.FACE_CASCADE, opts, function(err, faces) {
              //current face
              var face;
              //biggest face in current frame
              var biggestFace;

              //iterate over all faces and find largest
              for (var k = 0; k < faces.length; k++) {
                face = faces[k];
                // if this face is bigger, save it
                if (!biggestFace || biggestFace.width < face.width) biggestFace = face;
              }
              // if there is at least one face detected
              if (biggestFace) {
                log("Width: " + biggestFace.x)
                log("Height: " + biggestFace.y)
                // write the ellipse to the stream
                im.ellipse(biggestFace.x + biggestFace.width / 2, biggestFace.y + biggestFace.height/2, biggestFace.width/2, biggestFace.height/2);
                // and render it
                win.show(im);
                // count down frames with no face
                missCounter = MISSES;
                // attempt to correct position
                correct(biggestFace, im);
                // if the face's height/width > 1/6 the total image height/width 
                if (biggestFace.height > im.height() / 9 || biggestFace.width > im.width()/9) {
                  // halt movement
                  client.stop();
                  client.after(100, function() {
                    // back up real quick
                    client.back(.25);
                  }).after(500, function() {
                    // halt movement
                    client.stop();
                  });
                }
                // else, face isn't that close, CHASE!!
                else {
                  client.stop();
                  client.front(.1);
                }
              }
              // if we haven't seen a face for 10 consecutive frames
              else if (missCounter == 0) {
                // search
                if (!searching) {
                    console.log("calling search");
                    srch();
                }
              }
              // we still have hope we'll find that face again
              else {
                // decrement the counter
                missCounter--;
              }
              // done processing
              processingImage = false;

            }, opts.scale, opts.neighbors, opts.min && opts.min[0], opts.min && opts.min[1]);
          });
        }
      }
    };

    // search for more faces to react to
    var srch = function() {
      //halt movement
      client.stop();
      //tell the rest that we're searching
      searching = true;
      log('searching');
      //rotate clockwise, then counterclockwise
      client.counterClockwise(.25);
      client.after(500, function() {
        this.stop();
        //this.counterClockwise(.35);
      });
    };

    // function to attempt and center face on the current and
    // subsequent frames
    var correct = function(face, im) {
      // center of x-axis in pixels
      var faceCenterX = face.x + (face.width / 2);
      // center of y-axis in pixels
      var faceCenterY = face.y + (face.height / 2);
      // if face right of center
      if (faceCenterX > im.width() / 2) {
        log("Rotating Clockwise");
        client.stop();
        client.clockwise(.25);
        client.after(500, function() {
          client.stop();
        });
      }
      //if face left of center
      else if (faceCenterX < im.width() / 2) {
        log("Rotating Counter-Clockwise");
        client.stop();
        client.counterClockwise(.25);
        client.after(500, function() {
          client.stop();
        });
      }
      //if face is above center
      if (faceCenterY > im.height() / 2) {
        log("Descending");
        client.down(.25);
        client.after(500, function() {
          client.stop();
        });
      }
      //if face is below center
      else if (faceCenterY < im.height() / 2) {
        log("Ascending");
        client.up(.25);
        client.after(500, function() {
          client.stop();
        });
      }
    };
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

app.post('/filtercolor', function(req, res) {
    var pngStream = client.getPngStream();
    var originalWindow = new cv.NamedWindow('Original', 1000);
    var redFilterWindow = new cv.NamedWindow('Red Filtered', 1000);
    var blueFilterWindow = new cv.NamedWindow('Blue Filtered', 1000);
    var processingImage = false;
    var lastPng;

    pngStream
        .on('error', console.log)
        .on('data', function(pngBuffer) {
            lastPng = pngBuffer;

        cv.readImage(lastPng, function(err, im) {

            // thresholds for red and blue in BGR
            var red_lower_threshold = [0, 0, 90];
            var red_upper_threshold = [85, 85, 255];
            var blue_lower_threshold = [100, 0, 0];
            var blue_upper_threshold = [255, 140, 120];

            // thresholds for canny points
            var lowCannyThresh = 0;
            var highCannyThresh = 100;
            var nIters = 2;
            var minArea = 100;

            // colors for the lines
            var GREEN = [0, 255, 0]; // B, G, R
            var WHITE = [255, 255, 255]; // B, G, R
            var RED   = [0, 0, 255]; // B, G, R

            // check for errors
            if (err) throw err;
            // grab the size for the masks
            var width = im.width();
            var height = im.height();
            if (width < 1 || height < 1) throw new Error('Image has no size');

            // copy the buffer into new objects
            var filterRed = im.copy();
            var filterBlue = im.copy();

            // convert images to HSV
            //filterRed.convertHSVscale();
            //filterBlue.convertHSVscale();
            // truncate all but red
            filterBlue.inRange(blue_lower_threshold, blue_upper_threshold);
            // truncate all but blue
            filterRed.inRange(red_lower_threshold, red_upper_threshold);

            filterBlue.erode(1);
            filterRed.erode(2);


            var blueContours = filterBlue.findContours();
            var redContours = filterRed.findContours();

            // Access vertex data of contours
            var biggestBlueContour = 1;
            for (var c = 0; c < blueContours.size(); ++c) {
                if (blueContours.area(c) > blueContours.area(biggestBlueContour)) {
                    biggestBlueContour = c;
                }
            }
            var biggestRedContour = 1;
            for (var c = 0; c < redContours.size(); ++c) {
                if (redContours.area(c) > redContours.area(biggestRedContour)) {
                    biggestRedContour = c;
                }
            }
            console.log(redContours.area(biggestRedContour));
            blueContours.boundingRect(biggestBlueContour, false);
            blueContours.boundingRect(biggestRedContour, false);

            filterBlue.drawContour(blueContours, biggestBlueContour, RED);
            filterBlue.drawContour(redContours, biggestRedContour, RED);
            redFilterWindow.show(filterRed);
            blueFilterWindow.show(filterBlue)
            originalWindow.show(im);
        });
    });
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
//stream.listen(server);
//serve http requests at localhost:5555
server.listen(5556);