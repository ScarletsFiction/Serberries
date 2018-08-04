// This will be initialized as an object on initialize
// you can keep your variable here and load it even
// the script reloaded
var scope = null;

function response(req, res, closeConnection){
    res.writeHead(200);
	var output = "Hello " + (req.get.who ? req.get.who : 'world') + '!';
	//res.write(output);
	closeConnection(output);
}

module.exports = {
	// URL path
	path: '/hello',

	// Response handler
	response:response,

	// Scope initialization after script loaded
	scope:function(ref, allRef){
		scope = ref;

		// You can also access other scope with 'allRef'
	}
}