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
    scope:function(ref, scopes){
        scope = ref;

        // You can also access other scope with 'scopes'

        // this script filename is 'hello.js' so this
        // scope can be accessed from scopes['hello']

        // ref === scopes['hello']
        // scopes.myWorld === "my world"
        myWorld = scopes.myWorld;

        if(ref.mySaveData)
            console.log('\x1b[32m%s\x1b[0m', ref.mySaveData);
    }
}