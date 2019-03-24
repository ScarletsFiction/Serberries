//var Serberries = require('serberries');
var Serberries = require('../index.js');

var myserver = new Serberries({
    router:"router", // Optional if you want to route http request
    modules:"modules", // Optional if you want to live load scripts
    // Put all your router on root folder
    // All folder on path will be reloaded on any changes
});

// Set public folder for serving static assets
// myserver.setPublicFolder("../public");

// Set variable to be accessed from the router scopes
myserver.scopes.myWorld = "my world";

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
    if(urlpath[0] === '/')
        console.log('URL to '+urlpath+' was '+type);
    else
        console.log(urlpath+' was '+type);
});

myserver.on('stop', function(){
    console.log("Server shutdown");
});

myserver.on('started', function(){
    console.log("Server started on http://localhost:8000");
});

myserver.on('removed', function(urlpath){
    console.log('URL to '+urlpath+' was removed');
});

myserver.on('httpstatus', function(code, callback){
    callback('HTTP status '+code);
});

myserver.on('navigation', function(data){
    console.log("Navigation to '"+data.path+"'");
    console.log('  - '+data.headers['user-agent']);
});

myserver.start(8000);