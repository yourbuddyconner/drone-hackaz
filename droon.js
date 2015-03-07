var arDrone = require('ar-drone');
var client = arDrone.createClient();
var cv = require('opencv');

client.takeoff();


client
	.after(8000, function(){
		this.up(1);
	})
	.after(3000, function(){
		this.clockwise(.3);
		this.left(.25);
	})
	.after(2000, function(){
		this.down()
	})
	.after(3000, function(){
		this.stop();
		this.land();
	})