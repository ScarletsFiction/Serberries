<a href="https://www.patreon.com/stefansarya"><img src="http://anisics.stream/assets/img/support-badge.png" height="20"></a>

[![Written by](https://img.shields.io/badge/Written%20by-ScarletsFiction-%231e87ff.svg)](LICENSE)
[![Software License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)
[![Tweet](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?text=Serberries%20is%20a%20fast%20Nodejs%20live%20webserver%20that%20able%20to%20live%20refresh%20your%20script%20on%20the%20realtime.&url=https://github.com/ScarletsFiction/Serberries&via=github&hashtags=serberries,live,refresh,server,node)

# Serberries
Serberries is a fast Nodejs live webserver that able to live refresh your script on the realtime.

This library was useful if you always updating your server script but tired of restarting your server every changes.

## Install
To install this library, you can download from this repository or use
> $ npm install serberries

## Sample Usage

```js
var Serberries = require('serberries');

var myserver = new Serberries({
    // path:__dirname+'/router', // (Deprecated)
    router:'router', // Directory path if you want to route http request
    modules:'modules', // Directory path for non router
    // All folder above have live reload on any script changes
    
    maxRequestSize:1e6, // Maximum size when receiving POST data
    allowedOrigins:['www.example.com'], // Allow CORS request
    public:"../public", // Set public folder for serving static assets
});

// Set public folder for serving static assets (Deprecated)
// myserver.setPublicFolder("../public");

// Set variable to be accessed from the router scopes
myserver.scopes.myWorld = "my world";

// Obtaining reference of http.createServer() to be used in Socket.io or other
// var app = myserver.server;

// Starting the server
myserver.start(8000);
```

### Listen to events
```js
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
    console.log("Server was started");
});

myserver.on('removed', function(urlpath){
    console.log('URL to '+urlpath+' was removed');
});

myserver.on('httpstatus', function(code, callback){
    callback('Returning HTTP status '+code);
});

myserver.on('navigation', function(data){
    console.log("Navigation to '"+data.path+"'");
    console.log('  - '+data.headers['user-agent']);
});
```

### Using router for handling request

```js
// hello.js

// This will be initialized as an object on initialize
// you can keep your variable here and load it even
// the script reloaded
var scope = null;
var myWorld = '';

// Any variable declared not in `scope` variable
// will be reset to initial state
// so you can also live reload your other script
var dependency = require('./ext/hello.js');

function response(req, res, closeConnection){
    res.writeHead(200);

    // This will remain in `scope` variable even this script was reloaded
    // So if you have `setInterval`, you better save it on the scope
    scope.mySaveData = "I have some data that was saved";

    var output = dependency.hello() + " " + (req.get.who ? req.get.who : myWorld) + '!';

    //res.write(output);
    closeConnection(output);
}

// Minimal structure for router
module.exports = {
    // URL path
    path: '/hello', // URL path must be started with backslash
    // If you doesn't provide the backslash, it can't be accessed with URL
    // To use this router for all subpath '/hello#'

    // Response handler
    response:response,

    // Scope initialization after script loaded
    // scope:function(){}, [Deprecated]
    init:function(ref, scopes){
        scope = ref;
        myWorld = scopes.myWorld;

        if(ref.mySaveData)
            console.log(ref.mySaveData);

        // You can also access other scope with 'scopes'
        // 
        // this script filename is 'hello.js' so this
        // scope can be accessed from scopes['hello']
        // 
        // ref === scopes['hello']
        // scopes.myWorld === "my world"
    },

    // Optional if you want to destroy some data when script was reloaded
    destroy:function(){

    }
}
```

### Define modules for the server
Actually you're free to build your module structure, but make sure that you saving your variables on the scope if you want to reuse it. Any variable that not referenced in another object will be removed when garbage collection process. Variable that referenced inside of setInterval or Event is not removed if it's still running.

```js
// library-1.js
var scope = null;
module.exports = {
    // Optional if you want to access other scope
    // or saving data for current scope
    init:function(ref, allRef){
        // Running once this script was loaded
        scope = ref;
    },

    // Optional if you want to destroy some data when script was reloaded
    destroy:function(){

    }
}
```

## Contribution

If you want to help in Serberries, please fork this project and edit on your repository, then make a pull request to here.

Keep the code simple and clear.

## License

Serberries is under the MIT license.

But don't forget to put the a link to this repository.
