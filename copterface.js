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
var hitCounter = 0;
var win = new cv.NamedWindow("bears", 10000);
var startTime = new Date().getTime();
var log = function(s){
var time = ( ( new Date().getTime() - startTime ) / 1000 ).toFixed(2);

  console.log(time+" \t"+s);
}

pngStream
  .on('error', console.log)
  .on('data', function(pngBuffer) {
    lastPng = pngBuffer;
    detectFaces();
  });
     

var detectFaces = function() {
  if (flying == true){
    if( ( ! processingImage ) && lastPng ){
      processingImage = true;
      cv.readImage( lastPng, function(err, im) {
        var opts = {};
        im.detectObject(cv.FACE_CASCADE, opts, function(err, faces) {

          var face;
          var biggestFace;

          for(var k = 0; k < faces.length; k++) {
            face = faces[k];
            if( !biggestFace || biggestFace.width < face.width ) biggestFace = face;
          }
          if (biggestFace){
            correct(biggestFace, im);
            if (biggestFace.height > im.height()/4 || biggestFace.width > im.width()/4){
              client.stop()
              client.after(100, function() {
                client.back(.5);
              }).after(500, function() {
                client.stop();
              })
              spin();
            }else{
              client.stop();
              client.front(.25);
            }
            im.ellipse(biggestFace.x + biggestFace.width/2, biggestFace.y + biggestFace.height/2, biggestFace.width/2, biggestFace.height/2);
          }else{
            client.stop();
            spin();
          }
          //win.show(im);
          processingImage = false;

        }, opts.scale, opts.neighbors, opts.min && opts.min[0], opts.min && opts.min[1]);
      });
    }else if (hitCounter == 10{
      spin();
    }else{
      hitCounter++;
    }
  }
};

var spin = function() {
  client.stop()
  client.clockwise(.25);
}

var correct = function(face, im) {
    var faceCenterX = face.width/2;
    var faceCenterY = face.height/2;
    if (faceCenterX > im.width()/2){
      client.right(.25)
      client.after(500, function(){
        client.stop();
      })
    }else if (faceCenterX < im.width()/2){
      client.left(.25)
      client.after(500, function(){
        client.stop();
      })
    }if (faceCenterY > im.height()/2){
      client.up(.25)
      client.after(500, function(){
        client.stop();
      })
    }else if (faceCenterY > im.height()/2){
      client.down(.25)
      client.after(500, function(){
        client.stop();
      })
    }
}

var faceInterval;

client.takeoff();
client.after(5000,function(){ 
  log("going up");
  this.up(.25);
}).after(5000,function(){ 
  log("stopping");
  this.stop();
  flying = true;
});

client.after(30000, function() {
    flying = false;
    this.stop();
    this.land();
  });

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
