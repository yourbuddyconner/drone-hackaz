//express offers routes and junk
var express = require('express');
var app = express();
// express addon that allows it to parse the HTTP request body
var bodyparser = require('body-parser');

//http server
var http = require('http');
var server = http.createServer(app);

//opens up the drone API to control
var arDrone = require('ar-drone');
var client = arDrone.createClient();

//opencv hook
var cv = require('opencv');

var tcpVideoStream, parser;

//XBOX controller interface
var XboxController, euler, invert, maxAngle, setSpeed, vz, xbox, yaw;
XboxController = require("xbox-controller");
xbox = new XboxController;

//drone configuration options
client.config('control:outdoor', 'FALSE');
client.config('control:flight_without_shell', 'TRUE');
client.config('control:altitude_max', 30000);
client.config('control:altitude_min', 3000);
// turn on USB recording
client.config('VIDEO:video_on_usb', 'TRUE');

yaw = 3.05;
euler = 0.26;
vz = 1000;

//set speed for manual control
setSpeed = function(delta) {
  yaw = yaw + delta;
  if (yaw > 6.11) {
    yaw = 6.11;
  }
  if (yaw < 0.7) {
    yaw = 0.7;
  }
  delta = delta / 10.7;
  euler = euler + delta;
  if (euler > 0.52) {
    euler = 0.52;
  }
  if (euler < 0.1) {
    euler = 0.1;
  }
  delta = delta * 10.7 * 100;
  vz = vz + delta;
  if (vz > 2000) {
    vz = 2000;
  }
  if (vz < 200) {
    vz = 200;
  }
  console.log("Setting yaw: " + yaw + " - euler: " + euler + " - vz: " + vz);
  client.config('control:control_yaw', yaw);
  client.config('control:euler_angle_max', euler);
  return client.config('control:control_vz_max', vz);
};

setSpeed(0);
maxAngle = 32768;
invert = -1;

client.on("batteryChange", function(battery) {
  if (battery > 75) {
    return xbox.setLed(0x09);
  } else if (battery > 50) {
    return xbox.setLed(0x08);
  } else if (battery > 25) {
    return xbox.setLed(0x07);
  } else if (battery > 15) {
    return xbox.setLed(0x06);
  }
});

client.on("lowBattery", function(battery) {
  return xbox.setLed(0x01);
});

// call this function to set XBOX controller event listeners
// before you do, make sure any autonomous functions are not running
function manual_override() {
    xbox.on("start:press", function(key) {
      console.log("start press (takeoff or land)");
      if (client._lastState === 'CTRL_LANDED') {
        return client.takeoff();
      } else {
        return client.land();
      }
    });

    xbox.on("xboxbutton:press", function(key) {
      console.log("xboxbutton press (reset)");
      return client.disableEmergency();
    });

    xbox.on("leftshoulder:press", function(key) {
      console.log("leftshoulder - decreasing speed");
      return setSpeed(-1);
    });

    xbox.on("rightshoulder:press", function(key) {
      console.log("rightshoulder - increasing speed");
      return setSpeed(1);
    });

    xbox.on("left:move", function(position) {
      var x, y;
      x = parseFloat(position.x / maxAngle);
      y = parseFloat(position.y / maxAngle);
      console.log("left:move", {
        x: x,
        y: y
      });
      if (x === 0 && y === 0) {
        client.stop();
      }
      if (x !== 0) {
        client.right(x);
      }
      if (y !== 0) {
        return client.front(invert * y);
      }
    });

    xbox.on("right:move", function(position) {
      var x, y;
      x = parseFloat(position.x / maxAngle);
      y = parseFloat(position.y / maxAngle);
      console.log("right:move", {
        x: x,
        y: y
      });
      if (x !== 0) {
        client.clockwise(x);
      }
      if (y !== 0) {
        return client.up(invert * y);
      }
    });

    xbox.on("dup:press", function(key) {
      console.log('D up (flip front)');
      return client.animate('flipAhead', 1500);
    });

    xbox.on("ddown:press", function(key) {
      console.log('D down (flip back)');
      return client.animate('flipBehind', 1500);
    });

    xbox.on("dleft:press", function(key) {
      console.log('D left (flip left)');
      return client.animate('flipLeft', 1500);
    });

    xbox.on("dright:press", function(key) {
      console.log('D right (flip right)');
      return client.animate('flipRight', 1500);
    });

    xbox.on("x:press", function(key) {
      return client.animateLeds('fire', 5, 2);
    });

    xbox.on("y:press", function(key) {
      return client.animateLeds('blinkStandard', 5, 2);
    });

    xbox.on("rightstick:press", function(key) {
      console.log('rightstick press');
      return client.animate('turnaround', 5000);
    });

    xbox.on("a:press", function(key) {
      return console.log('a');
    });
};

// server that will serve video frames 
var WebSocketServer = require('ws').Server,
        wss = new WebSocketServer({server: server, path: '/dronestream'}),
        sockets = [],
        Parser = require('./PaVEParser'),

options = {};
options.timeout = 4000;

//configure websocket server to send video frames to connected clients
function init() {
    console.log("Connecting to drone on 192.168.1.1");

    tcpVideoStream = client.getVideoStream();

    tcpVideoStream.on('error', function(err) {
        console.log('There was an error: %s', err.message);
        tcpVideoStream.end();
        tcpVideoStream.emit("end");
        init();
    });

    parser = new Parser();
    // tcpVideoStream.on('data', function (data) {
    //     parser.write(data);

    // });
    parser.on('data', function(data) {
        sockets.forEach(function(socket) {
            //console.log(data.payload);
            socket.send(data.payload, {binary: true});
        });
    });
    tcpVideoStream.pipe(parser);
}
init();

wss.on('connection', function(socket) {
    sockets.push(socket);

    socket.on("close", function() {
        console.log("Closing socket");
        sockets = sockets.filter(function(el) {
            return el !== socket;
        });
    });
});

// BEGIN EXPRESS APP
//static files
app.use(express.static(__dirname + '/public'));

app.use(bodyparser.urlencoded());

//routes
app.get('/', function(req, res) {
  res.sendfile('index.html');
});

//toggle this 
var frontCamera = true;
app.post('/toggle_front_camera', function(req, res) {
    if (frontCamera) {
        // access the bottom camera
        client.config('video:video_channel', 3);
    }
    else {
        // access the front camera
        client.config('video:video_channel', 0);
    }
    //toggle
    frontCamera = !frontCamera;
    //return value to browser
    res.send(frontCamera)
});

//toggle this 
var usbVideoOn = true;
app.post('/toggle_usb_video', function(req, res) {
    if (!usbVideoOn)   {
        console.log("On");
        // turn on USB recording
        client.config('VIDEO:video_on_usb', 'TRUE');
    }
    else {
        console.log("Off");
        // turn off USB recording
        client.config('VIDEO:video_on_usb', 'FALSE');
    }
    //toggle
    usbVideoOn = !usbVideoOn;
    //return value to browser
    res.send(usbVideoOn);
});

app.post('/manual_override', function(req, res) {
    manual_override();
    res.send(true);
});

app.post('/detectfaces', function(req, res) {
    tracking = require('./lib/trackingjs/sandbox.js')

    //remove old listener
    parser.removeAllListeners('data');
    //add a new one that does what we want
    parser.on('data', function (data) {
        cv.readImage(data.payload, function(err, im) {
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
                    hitCounter--;
                    if(hitCounter <= 0){
                        searching = false;
                    }
                    //log("Width: " + biggestFace.x)
                    //log("Height: " + biggestFace.y)
                    // write the ellipse to the stream
                    im.ellipse(biggestFace.x + biggestFace.width / 2, biggestFace.y + biggestFace.height/2, biggestFace.width/2, biggestFace.height/2);
                    sockets.forEach(function (socket) {
                        socket.send(im, {binary: true});
                    });
                }
                else {
                    sockets.forEach(function (socket) {
                        socket.send(im, {binary: true});
                    });
                }
            });
        });
    });
});

var navdata;
client.on('navdata', function(data) {
    navdata = data;
});

app.get('/get_nav_data', function(req, res) {
    res.send(navdata);
});
//serve http requests at localhost:8080
server.listen(8080);
