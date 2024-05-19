const { GeminiHandler } = require("./lib/engine");
const config = require('./lib/config');
const functions = require('./lib/functions');


(async()=>{
	const handler = new GeminiHandler(config.APIKeys);
	let response = await handler.generate({model:GeminiHandler.models["gemini-1.5-flash-latest"].name,parts: [{text:"Hello."},{text:"Who are you?"}], functions:functions, safetySettings: config.safetySettings, systemInstruction: [{text:"You are Neuxbane, an AI that take over programmers tasks."}, {text:"Please use function calling to do your work!"}, {text:"Once it's done, please give the summary!"}]});
	console.log(response.text, response.functionCalls);
	while(response.next){
		response = await handler.generate(response.next);
		console.log(response.text, response.functionCalls);
	};
})();