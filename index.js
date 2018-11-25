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
	if(typeof options !== 'object' || !options.path)
		throw new Error("Structure path must be specified");

	if(options.path[options.path.length-1] !== '/'
		|| options.path[options.path.length-1] !== '\\') options.path += '/';

	var scope = this;
	scope.structure = {};

	var scopes = {}; // Structure scope
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

	var publicFolder = false;
	scope.setPublicFolder = function(path){
		publicFolder = path;
	}

	scope.server = http.createServer(function(req, res){
		var urlData = url.parse(req.url);
    	urlData.get = urlQueryObject(urlData.query);

		if(req.method === 'POST'){
			var queryData = "";

		    req.on('data', function(data) {
		        queryData += data;
		        if(queryData.length > 1e6) {
		            queryData = "";
		            hasError(1, "Data too big", urlData);
		            res.writeHead(413, {'Content-Type': 'text/plain'}).end();
		            req.connection.destroy();
		        }
		    });

		    req.on('end', function() {
			    urlData.post = urlQueryObject(queryData);
			    URLRequested(urlData, req, res)
		    });
		}
		else if(req.method === 'GET'){
			URLRequested(urlData, req, res);
		}

		else if(req.method === 'OPTIONS'){
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		    res.writeHead(200);
		    res.end();
			urlData = null;
		}
	});

	scope.on = function(event, func){
		if(event === 'error')
			onError.push(func);
		else
			onInfo[event].push(func);
	}

	scope.start = function(port){
		ScriptReloader();
		scope.server.listen(port || options.port || 80);
	}
	scope.stop = function(){
		infoEvent('stop', true);
		scope.server.close();
		scope.startup = false;
	}

	// ==== Reloader ====
	var updatedScript = [];
	fs.watch(options.path, {recursive: true}, function(eventType, filename){
		var name = filename.split('.js');
		if(name.length === 2 && name[1].length === 0){
			if(updatedScript.indexOf(filename) === -1)
				updatedScript.push(filename);
		}
		if(eventType === 'change') setTimeout(ScriptReloader, 1000);
	});

	var reloadLimit = false;
	function ScriptReloader(){
		if(reloadLimit) return;
		reloadLimit = true;

		if(updatedScript.length===0){
			updatedScript = getDirList(options.path);

			for (var i = updatedScript.length - 1; i >= 0; i--) {
				var temp = updatedScript[i].split('.js');

				if(temp.length===1||temp[1].length!==0)
					updatedScript.splice(i, 1);
			}
		}

		for (var i = 0; i < updatedScript.length; i++) {
			var fileName = updatedScript[i].split('.js');
			fileName.pop();
			fileName = fileName.join('js');
			infoEvent('loading', fileName+'.js');

			try{
				var lastURL = false;
				if(scope.structure[fileName])
					lastURL = scope.structure[fileName].path;

				scope.structure[fileName] = reload(options.path + updatedScript[i]);
				if(lastURL && lastURL !== scope.structure[fileName].path)
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
			fileName = fileName.join('js');

			if(typeof scope.structure[fileName].scope === 'function'){
				try{
					var type = 'updated';
					if(!scopes[fileName]){
						scopes[fileName] = {};
						type = 'added';
					}
					scope.structure[fileName].scope(scopes[fileName], scopes);
					infoEvent('loaded', scope.structure[fileName].path, type);
				}catch(e){
					hasError(4, "Failed to initialize the new script", e);
				}
			} else if(scope.structure[fileName].childOf && scope.structure[scope.structure[fileName].childOf]) {
				if(!scope.startup) continue;
				var parent = scope.structure[fileName].childOf;
				reload(options.path + updatedScript[i]);
				scope.structure[parent] = reload(options.path + parent);
				scope.structure[parent].scope(scopes[parent], scopes);
				infoEvent('loaded', scope.structure[parent].path, 'reloaded');
			} else {
				// Not recognized
				hasError(-1, "Not recognized '"+fileName+".js'");
				delete scope.structure[fileName];
			}
		}

		updatedScript.splice(0);
		if(global.gc) global.gc();

		if(!scope.startup){
			scope.startup = true;
			infoEvent('started', true);
		}
	}

	function URLRequested(urlData, req, res){
		if(!urlData.post) urlData.post = {};
		urlData.headers = req.headers;

		infoEvent('navigation', urlData);

		var closeConnection = function(data){
			urlData = null;
			if(res.end) res.end(data||'');
		};

		try{
			var keys = Object.keys(scope.structure);
			var path = '';
			for (var i = 0; i < keys.length; i++) {
				path = scope.structure[keys[i]].path.split('#');

		    	if((path.length === 1 && urlData.pathname === path[0])
		    		|| (path.length === 2 && urlData.pathname.indexOf(path[0]) !== -1))
		    	{
		    		scope.structure[keys[i]].response(urlData, res, closeConnection);
		    	    return;
		    	}
			}
		} catch(e) {
			hasError(2, "Failed to serve URL request '"+req.url+"'", e);
		}
		
		// If logic was not found
		// Check if it's file resource was found
	    try{
			var reqpath = req.url.toString().split('?')[0].split('..').join('');
		    if (req.method !== 'GET') {
		        res.statusCode = 501;
				infoEvent('httpstatus', 501, closeConnection);
		        res.setHeader('Content-Type', 'text/plain');
		        return closeConnection('Method not implemented');
		    }
		    var file = path.join(publicFolder, reqpath.replace(/\/$/, '/index.html'));
		    if (file.indexOf(publicFolder + path.sep) !== 0) {
			        res.statusCode = 403;
					infoEvent('httpstatus', 403, closeConnection);
			        res.setHeader('Content-Type', 'text/plain');
			        return closeConnection('Forbidden');
		    }
		} catch(e){}

	    var type = mime[path.extname(file).slice(1)] || 'text/plain';
	    var s = fs.createReadStream(file);
	    s.on('open', function () {
	    	try{
		        res.setHeader('Content-Type', type);
		        s.pipe(res);
		    } catch(e){}
	    });
	    s.on('error', function () {
	    	try{
		        res.setHeader('Content-Type', 'text/plain');
		        res.statusCode = 404;
				infoEvent('httpstatus', 404, closeConnection);
		        closeConnection('Not found');
		    } catch(e){}
	    });
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



function getDirList(path, folderOnly){
	var isDirectory = function(source){
		 return fs.lstatSync(source).isDirectory();
	}
	var list = fs.readdirSync(path);
	var fileList = [];
	for (var i = 0; i < list.length; i++) { //folder
		if(folderOnly && isDirectory(path+list[i]))
			fileList.push(list[i]); //file
		else if(!folderOnly&&!isDirectory(path+list[i]))
			fileList.push(list[i]);
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
	if(data){
		try{
			if(data.charAt(0) === '{' || data.charAt(0) === '[')
				data = JSON.parse(data);
			else{
				data = JSON.parse('{"' + data.split('&').join('","').split('=').join('":"') + '"}',
	        	    function(key, value){
	        	    	return key === "" ? value : decodeURIComponent(value)
	        	    }
	        	);
			}
		} catch(e){
			data = {};
		}
	} else data = {};
	return data;
}