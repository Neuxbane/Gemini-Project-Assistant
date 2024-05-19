const { GeminiHandler } = require("./lib/engine");
const config = require('./config');
const functions = require('./functions');


(async()=>{
	const handler = new GeminiHandler(config.APIKeys);
	let dt = {part: "Hello, what time is it in Yogyakarta?", functions:functions};
	while(true){
		const response = (await handler.generate(dt));
		GeminiHandler.models.
		console.log(response)
		if(response.next) dt = response.next;
		else break;
	}
})();