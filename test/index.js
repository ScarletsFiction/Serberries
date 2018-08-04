var SkyLibrary = require('../index.js');

var myserver = new SkyLibrary({
	path:__dirname+'/../example/router/'
});

myserver.on('error', function(errcode, msg, trace){
	console.error("Error code: "+errcode+' ('+msg+')');
	if(trace){
		console.error(trace.message);
		for (var i = 0; i < trace.stack.length; i++) {
			console.error("   at "+trace.stack[i]);
		}
	}
	process.exit(1); // Test error
});

myserver.start(8000);
setTimeout(function(){
	myserver.stop();
	console.log("Test completed");
	process.exit(); // Test success
}, 2000);