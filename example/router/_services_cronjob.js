// This will be initialized as an object on initialize
// you can keep your variable here and load it even
// the script reloaded
var scope = null;

function initialize(){
	scope.every_5s_f = function(){
		console.log('Hello from cron ('+Date.now()+')');
	}

	// Run this once
	if(!scope.cron){
		
		// https://www.npmjs.com/package/node-cron
		try{
			scope.cron = require('node-cron');
			scope.every_5s = scope.cron.schedule('5 * * * *', scope.every_5s_f);
		} catch(e){
			console.log("   Cron example will be available after you install cron library");
			console.log("   npm install node-cron");
		}
	}
}

function response(){}
module.exports = {
	// URL path
	path: '_services_cronjob',

	// Response handler
	response:response,

	// Scope initialization after script loaded
	scope:function(ref){
		scope = ref;
		initialize();
	}
}