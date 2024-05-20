const { GeminiHandler } = require("./lib/engine");
const config = require('./lib/config');
const functions = require('./lib/functions');


(async()=>{
	const handler = new GeminiHandler(config.APIKeys);
	let response = await handler.generate({model:GeminiHandler.models["gemini-1.0-pro-vision-latest"].name,parts: [{text:"Hello."},{text:"Describes this image!"}],
	 images: ["https://t3.ftcdn.net/jpg/05/59/27/48/360_F_559274893_O9iSRQwTKIkAooNTglilMgx2yMcXK9Or.jpg"],
	  functions:functions, safetySettings: config.safetySettings, systemInstruction: [{text:"You are Neuxbane. Developed by Banu Chrisnadi."}]});
	console.log(response.text, response.functionCalls);
	while(response.next){
		response = await handler.generate(response.next);
		console.log(response.text, response.functionCalls);
	};
})();