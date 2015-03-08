// Run this to receive a png image stream from your drone.

var arDrone = require('ar-drone');
var cv = require('opencv');
var http    = require('http');
var fs = require('fs');

console.log('Connecting png stream ...');

//var stream  = arDrone.createUdpNavdataStream();
var client = arDrone.createClient();
var pngStream = client.getPngStream();
var processingImage = false;
var lastPng;
var navData;
var flying = false;
var finalPng;
var win = new cv.NamedWindow("bears", 10000);
var startTime = new Date().getTime();
var log = function(s){
var time = ( ( new Date().getTime() - startTime ) / 1000 ).toFixed(2);

  console.log(time+" \t"+s);
}

pngStream
  .on('error', console.log)
  .on('data', function(pngBuffer) {
    //console.log("got image");
    lastPng = pngBuffer;
    detectFaces();
  });
     
var processingImage = false;
var detectFaces = function() {
  console.log("Detecting?");
  console.log(processingImage); 
  if( ( ! processingImage ) && lastPng ){
    cv.readImage( lastPng, function(err, im) {
      var opts = {};
      im.detectObject(cv.FACE_CASCADE, opts, function(err, faces) {

        var face;
        var biggestFace;

        for(var k = 0; k < faces.length; k++) {
          console.log("look a face!")
          face = faces[k];
          if( !biggestFace || biggestFace.width < face.width ) biggestFace = face;
        }
        if (biggestFace){
          im.ellipse(biggestFace.x + biggestFace.width/2, biggestFace.y + biggestFace.height/2, biggestFace.width/2, biggestFace.height/2);
        }
        win.show(im);
        processingImage = false;

      }, opts.scale, opts.neighbors, opts.min && opts.min[0], opts.min && opts.min[1]);
    });
  }
};

//var faceInterval = setInterval(detectFaces, 150);

/*client.takeoff();
client.after(5000,function(){ 
  log("going up");
  this.up(1);
}).after(1000,function(){ 
  log("stopping");
  this.stop(); 
  flying = true;
});


client.after(30000, function() {
    flying = false;
    this.stop();
    this.land();
  });*/

client.on('navdata', function(navdata) {
  navData = navdata;
})

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
