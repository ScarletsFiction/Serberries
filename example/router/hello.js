// This will be initialized as an object on initialize
// you can keep your variable here and load it even
// the script reloaded
var scope = null;

// You can also live reload your other script
var dependency = require('./ext/hello.js');

function response(req, res, closeConnection){
    res.writeHead(200);
    var output = dependency.hello() + " " + (req.get.who ? req.get.who : 'world') + '!';
    //res.write(output);
    closeConnection(output);
}

module.exports = {
    // URL path
    path: '/hello', // URL path must be started with backslash
    // If you doesn't provide the backslash, it can't be accessed with URL
    // To use this router for all subpath '/hello#'

    // Response handler
    response:response,

    // Scope initialization after script loaded
    scope:function(ref, allRef){
        scope = ref;

        // You can also access other scope with 'allRef'
    }
}