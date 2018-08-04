// Update this and 'hello.js' will also be reloaded

function hello(){
	return 'Hello';
}

module.exports = {
	childOf:'hello', // This parent is hello.js
	hello:hello
}