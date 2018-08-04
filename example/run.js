var SkyLibrary = require('../index.js');

var myserver = new SkyLibary({
	path:__dirname+'/SkyLibrary'
});

myserver.on('error', function(errcode, msg, trace){
	console.error("Error code: "+errcode+' ('+msg+')');
	if(trace){
		console.error(trace.message);
		for (var i = 0; i < trace.stack.length; i++) {
			console.error("   at "+trace.stack[i]);
		}
	}
	console.error("");
});

myserver.on('loading', function(filename){
	console.log('Loading '+filename);
});

myserver.on('loaded', function(urlpath, type){
	console.log('URL to '+urlpath+' was '+type);
});

myserver.on('stop', function(){
	console.log("Server shutdown");
});

myserver.on('started', function(){
	console.log("Server started on http://localhost:80");
});

myserver.on('removed', function(urlpath){
	console.log('URL to '+urlpath+' was removed');
});

myserver.on('navigation', function(data){
	if(data.headers['user-agent'].indexOf('Indy Library')!=-1)
		return; // Some people might have this browser bugs on port 80

	console.log("Navigation to '"+data.path+"'");
	console.log('  - '+data.headers['user-agent']);
});

myserver.start(80);
