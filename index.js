var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var mime = {
    html: 'text/html',
    txt: 'text/plain',
    css: 'text/css',
    gif: 'image/gif',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    js: 'application/javascript'
};

module.exports = function(options){
	if(options.maxRequestSize === undefined)
		options.maxRequestSize = 1e6;

	var scope = this;
	scope.structure = {};

	var scopes = {}; // Structure scope
	scope.scopes = scopes;
	
	var onError = [];
	scope.startup = false;
	var onInfo = {
		loading:[],
		loaded:[],
		stop:[],
		started:[],
		startup:[],
		navigation:[],
		removed:[],
		httpstatus:[]
	};

	if(options.public !== undefined)
		publicFolder = path.resolve(options.public);

	var publicFolder = false;
	scope.setPublicFolder = function(path_){
		publicFolder = path.resolve(path_);
	}

	scope.onRequest = function(req, res){
		var urlData = url.parse(req.url);
    	urlData.get = urlQueryObject(urlData.query).post;

		if(req.method === 'POST'){
			var queryData = "";
			if(res.onData !== undefined){ // uWebSocket.js
				queryData = new Uint8Array(0);
				res.onData(function(data, end){
					var tmp = new Uint8Array(queryData.length + data.byteLength);
					tmp.set(queryData, 0);
					tmp.set(new Uint8Array(data), queryData.length);
					queryData = tmp;
					if(end === true){
						tmp = urlQueryObject(Buffer.from(queryData.buffer).toString('utf8'));
						urlData.file = tmp.file;
						urlData.post = tmp.post;
						URLRequested(urlData, req, res);
						tmp = queryData = null;
					}
				});
				return;
			}

		    req.on('data', function(data) {
		        queryData += data;
		        if(queryData.length > 1e6) {
		            queryData = "";
		            hasError(1, "Data too big", urlData);
		            res.writeHead(413);
		            res.setHeader('Content-Type', 'text/plain');
		            res.end();
		        }
		    });

		    req.on('end', function() {
			    var tmp = urlQueryObject(queryData);
				urlData.file = tmp.file;
				urlData.post = tmp.post;
			    URLRequested(urlData, req, res);
		    });
		}
		
		else if(req.method === 'GET')
			URLRequested(urlData, req, res);

		else if(req.method === 'OPTIONS'){
			urlData = null;
			var origin = req.headers.origin;
			if(options.allowedOrigins === undefined || options.allowedOrigins.indexOf(origin) !== -1){
				// Set CORS headers
			    res.setHeader('Access-Control-Allow-Origin', origin);
				res.setHeader('Access-Control-Request-Method', '*');
				res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
				res.setHeader('Access-Control-Allow-Headers', '*');
				res.setHeader('Access-Control-Allow-Credentials', true);
			}
			res.writeHead(200);
			res.end(); // Close the connection
		}
	}

	scope.server = http.createServer(scope.onRequest);

	scope.on = function(event, func){
		if(event === 'error')
			onError.push(func);
		else
			onInfo[event].push(func);
	}

	scope.start = function(port){
		ScriptReloader();
		if(port === undefined) port = options.port || 80;
		if(port !== 0) scope.server.listen(port);
	}
	scope.stop = function(){
		infoEvent('stop', true);
		scope.server.close();
		scope.startup = false;
	}

	// ==== Reloader ====
	var updatedScript = [];

	var router_ = [];
	if(options.modules !== undefined){
		if(options.modules.constructor === String)
			router_.push(options.modules);
		else router_.push(...options.modules);
	}
	if(options.path !== undefined){
		if(options.path.constructor === String)
			router_.push(options.path);
		else router_.push(...options.path);
	}
	if(options.router !== undefined){
		if(options.router.constructor === String)
			router_.push(options.router);
		else router_.push(...options.router);
	}

	for (var i = 0; i < router_.length; i++) {
		let rootPath = router_[i];

		fs.watch(router_[i], {recursive: true}, function(eventType, filename){
			var name = filename.split('.js');
			if(name.length === 2 && name[1].length === 0){
				filename = rootPath+'/'+filename;
				if(updatedScript.indexOf(filename) === -1)
					updatedScript.push(filename);
			}
			setTimeout(ScriptReloader, 1000);
		});
	}

	var newScript = [];
	newScript.push(...router_);
	for (var i = 0; i < newScript.length; i++) {
		var newScript_ = getFiles(newScript[i]+'/', true);
		var realpath = fs.realpathSync(newScript[i]+'/').split('\\').join('/').split('/')
		realpath.pop();
		realpath = realpath.join('/');

		for (var a = newScript_.length - 1; a >= 0; a--) {
			var temp = newScript_[a].split('.js');

			if(temp.length !== 1 && temp[1].length === 0){
				newScript_[a] = newScript_[a].split('\\').join('/').split('/');
				updatedScript.push(newScript_[a].join('/').replace(realpath, '.'));
			}
		}
	}
	newScript.splice(0);

	var reloadLimit = false;
	function ScriptReloader(){
		if(reloadLimit) return;
		reloadLimit = true;

		if(updatedScript.length === 0)
			return;

		for (var i = 0; i < updatedScript.length; i++) {
			var fileName = updatedScript[i].split('.js');
			fileName.pop();
			fileName = fileName.join('js').replace('./', '');
			infoEvent('loading', fileName);

			if(scope.structure[fileName] === undefined)
				scope.structure[fileName] = {};
			var currentRef = scope.structure[fileName];

			try{
				var lastURL = false;
				if(currentRef)
					lastURL = currentRef.path;

				if(currentRef.destroy)
					currentRef.destroy();

				Object.assign(currentRef, reload(updatedScript[i]));
				if(lastURL && lastURL !== currentRef.path)
					infoEvent('removed', lastURL, fileName);
			} catch(e) {
				hasError(3, "Error reloading server structure", e);
			}
		}
		setTimeout(processScript, 1000);
	}

	function processScript(){
		reloadLimit = false;
		for (var i = 0; i < updatedScript.length; i++){
			var fileName = updatedScript[i].split('.js');
			fileName.pop();
			fileName = fileName.join('js').replace('./', '');

			try{
				var currentRef = scope.structure[fileName];
				var type = 'updated';
				if(!scopes[fileName]){
					scopes[fileName] = {};
					type = 'added';
				}

				if(typeof currentRef.scope === 'function')
					currentRef.scope(scopes[fileName], scopes, scope.structure);
				else if(typeof currentRef.init === 'function')
					currentRef.init(scopes[fileName], scopes, scope.structure);

				infoEvent('loaded', currentRef.path, type);
			}catch(e){
				hasError(4, "Failed to initialize the new script", e);
			}
		}

		updatedScript.splice(0);
		if(global.gc) global.gc();

		if(!scope.startup){
			scope.startup = true;
			infoEvent('started', true);
			if(options.onLoaded !== undefined)
				onLoaded();
		}
	}

	function URLRequested(urlData, req, res){
		if(!urlData.post) urlData.post = {};
		urlData.headers = req.headers;

		var closeConnection = function(data){
			urlData = null;
			if(res.end) res.end(data || '');

			// Disable another response when connection ended
			res.end = res.write = function(){
				throw new Error("Connection already closed");
			};
		};

		try{
			var keys = Object.keys(scope.structure);
			var path_ = '';
			for (var i = 0; i < keys.length; i++) {
				if(!scope.structure[keys[i]].path)
					continue;

				path_ = scope.structure[keys[i]].path.split('#');

		    	if((path_.length === 1 && urlData.pathname === path_[0])
		    		|| (path_.length === 2 && urlData.pathname.indexOf(path_[0]) !== -1))
		    	{
					infoEvent('navigation', urlData);
		    		scope.structure[keys[i]].response(urlData, res, closeConnection);
		    	    return;
		    	}
			}
		} catch(e) {
			hasError(2, "Failed to serve URL request '"+req.url+"'", e);
			res.statusCode = 500;
			infoEvent('httpstatus', 500, closeConnection);
			return closeConnection();
		}
		
		// If logic was not found
		// Check if it's file resource was found
		if(publicFolder === false)
			return resNotFound();
	    try{
			var reqpath = req.url.toString().split('?')[0].split('..').join('');
		    if (req.method !== 'GET') {
				infoEvent('navigation', urlData);
		        res.statusCode = 501;
				infoEvent('httpstatus', 501, closeConnection);
		        res.setHeader('Content-Type', 'text/plain');
		        return closeConnection('Method not implemented');
		    }

		    // Replace last slash as 'index.html'
		    var file = path.join(publicFolder, reqpath.replace(/\/$/, '/index.html'));
		    if (file.indexOf(publicFolder + path.sep) !== 0) {
				infoEvent('navigation', urlData);
			    res.statusCode = 403;
				infoEvent('httpstatus', 403, closeConnection);
			    res.setHeader('Content-Type', 'text/plain');
			    return closeConnection('Forbidden');
		    }
		} catch(e){
			hasError(4, "Something error", e);
			return closeConnection();
		}

		function resNotFound(){
			try{
				infoEvent('navigation', urlData);
		        res.setHeader('Content-Type', 'text/plain');
		        res.statusCode = 404;
				infoEvent('httpstatus', 404, closeConnection);
		        return closeConnection('Not found');
		    } catch(e){
				hasError(4, "Something error", e);
				closeConnection();
			}
		}

		if(file !== undefined){
			var type = mime[path.extname(file).slice(1)] || 'text/plain';

		    var s = fs.createReadStream(file);
		    s.on('open', function(){
		    	try{
			        res.setHeader('Content-Type', type);
			        s.pipe(res);
			    } catch(e){
					hasError(4, "Something error", e);
					closeConnection();
				}
		    });
		    s.on('error', resNotFound);
		} else resNotFound();
	}

	// Notify all user if server need to restart
	process.on('uncaughtException', function(err){
		hasError(0, "Server exception", err);
	});
	process.on('warning', function(warning){
		hasError(1, "Server warning", warning);
	});

	function hasError(code, msg, err){
		if(err && err.stack){
			var errcode = err.code;
			var stack = err.stack.split(module.filename);
			if(stack.length!=1){
				var temp = stack[1].split("\n")[0];
				stack.pop();
				stack = stack.join(module.filename)+module.filename+temp;
			} else stack = err.stack;
			stack = stack.split("\n    at ");
			var message = stack.shift();
			stack = {
				code:errcode,
				message:message,
				stack:stack
			};
		}
		for (var i = 0; i < onError.length; i++)
			onError[i](code, msg, stack);
	}

	function infoEvent(event, data, data2){
		for (var i = 0; i < onInfo[event].length; i++)
			onInfo[event][i](data, data2);
	}
}

var isDirectory = function(source){
	 return fs.lstatSync(source).isDirectory();
}
function getFiles(path, recursive){
	path = fs.realpathSync(path) + '/';
	var list = fs.readdirSync(path);
	var fileList = [];
	for (var i = 0; i < list.length; i++) { //folder
		if(recursive && isDirectory(path + list[i]))
			fileList.push(...getFiles(path + list[i], true)); //file
		else fileList.push(path + list[i]);
	}
	return fileList;
}

var parent = module.parent;
function reload(name){
    var modules = parent.constructor;
    var path = modules._resolveFilename(name, parent);
    var old = modules._cache[path];
    delete modules._cache[path];

    try {
        return parent.require(path);
    } catch (e) {
        if (old !== undefined)
        	// Use the old script if the new one was failed failed
            modules._cache[path] = old;
        throw e;
    }
    return null;
}

function urlQueryObject(data_){
	var data = data_;
	var ret = {post:{}, file:{}};
	if(data){
		try{
			if(data.charAt(0) === '{' || data.charAt(0) === '[')
				ret.post = JSON.parse(data);
			else if(data.indexOf('--') === 0){
				return multipartBody(data);
			}
			else{
				ret.post = JSON.parse('{"' + data.split('&').join('","').split('=').join('":"') + '"}',
	        	    function(key, value){
	        	    	return key === "" ? value : decodeURIComponent(value)
	        	    }
	        	);
			}
		} catch(e){}
	}
	return ret;
}

function multipartBody(bodyBuffer){
	var boundary = bodyBuffer.match(/-.*/)[0];
	bodyBuffer = bodyBuffer.split(boundary);
	bodyBuffer.shift(); // First boundary
	bodyBuffer.pop(); // End of boundary

	var data = {post:{}, file:{}};

	for (var i = 0; i < bodyBuffer.length; i++) {
		var ref = bodyBuffer[i];

	    // Parse stream
		if(ref.indexOf('application/octet-stream') !== -1){
			var match = ref.match(/name="([^"]*)".*stream[;\r\n]+([^\r\n].*)$/s);
			data.post[match[1]] = $match[2] || '';
		}

		// Parse file data
		else if(ref.indexOf('; filename=') !== -1){
			var match = ref.match(/name="([^"]*)"; filename="([^"]*)"[;\r\n]+([^\r\n].*)$/s);
			var mime = match[3].match(/Content-Type: (.*)?/);

			var content = match[3].replace(/Content-Type: (.*)[^\n\r]/, '').trim();
			var index = match[1].match(/^(.*)\[\]$/i);
			if(!index) index = match[1];

	        data.file[index] = {
	        	name:match[2],
	        	type:mime[1],
	        	data:Buffer.from(content)
	        }
		}

	    // Parse multiform data
	    else {
	        var match = ref.match(/name="([^"]*)"[;\r\n]+([^\r\n].*)$/s);
	        var tmp = match[1].match(/^(.*)\[\]$/i);
	        var content = match[2].trim() || '';

	        if(tmp){
	        	if(data.post[tmp[1]] === undefined)
	        		data.post[tmp[1]] = [];
	        	data.post[tmp[1]].push(content);
	        }
	        else data.post[match[1]] = content;
	    }
	}
	return data;
}