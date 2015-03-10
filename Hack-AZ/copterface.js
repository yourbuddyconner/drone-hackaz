// Requires
var arDrone = require('ar-drone');
var cv = require('opencv');
var http = require('http');
var fs = require('fs');

// variable declarations
// max # of misses before search
const MISSES = 10;
var missCounter = MISSES;

//drone client API
var client = arDrone.createClient();
//open image stream from drone
var pngStream = client.getPngStream();
var lastPng;
//flag to prevent two image processing events
var processingImage = false;
//flag that determines if the drone is flying
var flying = false;
//flag that determines if the drone is searching
var searching = false;
//flight time recorder
var startTime = new Date().getTime();
var log = function(s) {
var time = ((new Date().getTime() - startTime ) / 1000 ).toFixed(2);
  console.log(time + ' \t'+s);
}

//may not need
var navData;
var finalPng;

// set up the stream
pngStream
  .on('error', console.log)
  .on('data', function(pngBuffer) {
    lastPng = pngBuffer;
    detectFaces();
  });

//correct trim
client.ftrim();

//setup mission
client.takeoff();
log(client.battery());
client.after(5000, function() {
  log('going up');
  this.up(.25);
}).after(5000, function() {
  log('stopping');
  this.stop();
  flying = true;
});

client.after(30000, function() {
    flying = false;
    this.stop();
    this.land();
  });

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
            // write the ellipse to the stream
            im.ellipse(biggestFace.x + biggestFace.width / 2, biggestFace.y + biggestFace.height/2, biggestFace.width/2, biggestFace.height/2);
            // and render it
            win.show(im);
            // count down frames with no face
            missCounter = MISSES;
            // attempt to correct position
            correct(biggestFace, im);
            // if the face's height/width > 1/6 the total image height/width 
            if (biggestFace.height > im.height() / 6 || biggestFace.width > im.width()/6) {
              // halt movement
              client.stop();
              client.after(100, function() {
                // back up real quick
                client.back(.25);
              }).after(500, function() {
                // halt movement
                client.stop();
              });
              //srch();
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
            srch();
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
  client.clockwise(.35);
  client.after(200, function() {
    client.stop();
    client.counterClockwise(.35);
  });
};

// function to attempt and center face on the current and
// subsequent frames
var correct = function(face, im) {
  // center of x-axis in pixels
  var faceCenterX = face.width / 2;
  // center of y-axis in pixels
  var faceCenterY = face.height / 2;
  // if face right of center
  if (faceCenterX > im.width() / 2) {
    client.clockwise(.25);
    client.after(500, function() {
      client.stop();
    });
  }
  //if face left of center
  else if (faceCenterX < im.width() / 2) {
    client.counterClockwise(.25);
    client.after(500, function() {
      client.stop();
    });
  }
  //if face is above center
  if (faceCenterY > im.height() / 2) {
    client.up(.25);
    client.after(500, function() {
      client.stop();
    });
  }
  //if face is below center
  else if (faceCenterY > im.height() / 2) {
    client.down(.25);
    client.after(500, function() {
      client.stop();
    });
  }
};


client.on('navdata', function(navdata) {
  navData = navdata;
});

//cv.readImage('./lol.png', function(err, im){
  var server = http.createServer(function(req, res) {
    if (!lastPng) {
      res.writeHead(503);
      res.end('Did not receive any png data yet.');
      return;
    }

    res.writeHead(200, {'Content-Type': 'image/png'});
    res.end(lastPng);
  });

  server.listen(8080, function() {
    console.log('Serving latest png on port 8080 ...');
  });
//});
