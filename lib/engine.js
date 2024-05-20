const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const delay = (milliseconds)=>new Promise(resolve => setTimeout(resolve, milliseconds));
const copy = (object)=> new Function(`return ${JSON.stringify(object)}`)();
class GeminiHandler {
	static models = {
		"gemini-1.5-pro-latest": {name:"gemini-1.5-pro-latest", RPM: 60/2 * 1000, RPD: 50, query:0, currentQueryProcess:1, unsupportedFeatures: [] },
		"gemini-1.5-flash-latest": {name:"gemini-1.5-flash-latest", RPM: 60/15 * 1000, RPD: 1500, query:0, currentQueryProcess:1, unsupportedFeatures: [] },
		"gemini-1.0-pro-latest": {name:"gemini-1.0-pro-latest", RPM: 60/15 * 1000, RPD: 1500, query:0, currentQueryProcess:1, unsupportedFeatures: ['systemInstruction', 'responseMimeType', 'videos', 'images', 'audio'] },
		"gemini-1.0-pro-vision-latest": {name:"gemini-1.0-pro-vision-latest", RPM: 60/60 * 1000, RPD: Infinity, query:0, currentQueryProcess:1, unsupportedFeatures: [ 'systemInstruction', 'responseMimeType', 'audio', 'history', 'functions'] },
	};

	constructor(APIKeys) {
		this.APIKeys = APIKeys;
		this.handler = APIKeys.map(x=>({models:copy(GeminiHandler.models), key:x, engine:new GoogleGenerativeAI(x)}));
	}

	async generate(args = {parts, history, images, videos, audio, functions, safetySettings, systemInstruction, temperature, responseMimeType, model}){
		const defaultArgs = {parts: "", history:[],images:[], videos:[], audio:[], tools:[], safetySettings:undefined, systemInstruction:[ {text: 'You are a human.'}, {text: 'Your mission is to act like a human casually.'}, {text: 'You should use function calling'} ], temperature: 1.4, responseMimeType: "text/plain"??"application/json", model: "gemini-1.5-flash-latest" };
		if(typeof(args.parts)==="string")args.parts=[{text:args.parts}];
		args = {...defaultArgs, ...args};
		const chooseEngine = this.handler.sort((a,b)=>(a.models?.[args.model]?.query-a.models?.[args.model]?.currentQueryProcess)-(b.models?.[args.model]?.query-b.models?.[args.model]?.currentQueryProcess))[0];
		if(!chooseEngine.models?.[args.model]) throw new Error(`Unknown model name '${args.model}'. Please add the model rate limit to this library from https://ai.google.dev/gemini-api/docs/models/gemini`)
		const id = ++chooseEngine.models[args.model].query;
		while(id!=this.handler.filter(x=>x.key==chooseEngine.key)[0].models[args.model].currentQueryProcess) await delay(100);
		
		let _tmp = { model: args.model, safetySettings:args.safetySettings, generationConfig: {temperature:args.temperature} };
		const unsupportedFeatures = chooseEngine.models[args.model].unsupportedFeatures;
		if(!unsupportedFeatures.includes("functions")) _tmp = {..._tmp, tools:[{function_declarations:args.functions}]};
		if(!unsupportedFeatures.includes("responseMimeType")) _tmp = {..._tmp, generationConfig:{..._tmp.generationConfig, responseMimeType:args.responseMimeType}};
		else args.parts.push({text: `Please response only in "${args.responseMimeType}" format`});
		const model = chooseEngine.engine.getGenerativeModel(_tmp);
		
		_tmp = {};
		if(!unsupportedFeatures.includes("images")) args.parts.push(...await Promise.all(args.images.map(async(x)=>await this.image(x))));
		if(!unsupportedFeatures.includes("systemInstruction")) _tmp = {..._tmp, systemInstruction:{ parts:args.systemInstruction }};
		else args.parts.push({text: "SYSTEM INSTRUCTION BEGIN"}, ...args.systemInstruction, {text: "SYSTEM INSTRUCTION END"});
		if(!unsupportedFeatures.includes("history")) _tmp = {..._tmp, history:args.history};
		else args.parts = [...args.history.map(x=>({text:JSON.stringify(x)})),...args.parts];
		let chat;
		if(!unsupportedFeatures.includes("history")) chat = model.startChat(_tmp);
		while(true){
			try{
				String.prototype.format = function(...v){
					if (!v.length)return text;
					return String(this).trim().split(/\{\}/).map((p,i)=>(i%2===0?p:v[Math.floor(i/2)])).join('');
				}
				const startTime = Date.now();
				let response;
				if(!unsupportedFeatures.includes("history")) response =  (await chat.sendMessage(args.parts)).response;
				else response = (await model.generateContent(args.parts)).response;
				const functionCalls = response.functionCalls();
				const text = response.text();
				let history;
				if(!unsupportedFeatures.includes("history")) history = await chat.getHistory();
				else history = args.history.push({role:'user', parts:args.parts}, ...response.candidates.map(x=>x.content));
				const format = args.parts.filter ? args.parts.filter(x=>x.functionResponse)?.map(x=>x.response) : [];
				setTimeout(()=>chooseEngine.models[args.model].currentQueryProcess++, chooseEngine.models[args.model].RPM - Date.now() + startTime);
				if(functionCalls){
					const newPart = [];
					for(const fc of functionCalls){
						const func = args.functions.find(f=>f.name===fc.name);
						if(func){
							const funcResponse = await func.function(fc.args);
							newPart.push({functionResponse:{name:fc.name,response:funcResponse}});
						}
					}
					return {
						next: {...args, part:newPart},
						text: text,
						functionCalls: functionCalls,
						history: history
					};
				} else return {
					text: text.format(...format),
					history: history
				};
			} catch(e) {
				console.error(e);
				await delay(1000);
			}
		}
	}

	getSignature(base64Data){
		const signatures = {
			'\x89PNG\xBD\x1E\x0E\x00\x00\x00\x0D\x49\x48\x44\x52': 'image/png',	// Extended PNG signature for robust detection
			'\xFF\xD8\xFF\xE0\x00\x10JFIF': 'image/jpeg',
			'\xFF\xD8\xFF\xE1': 'image/jpeg',	// Additional JPEG signature
			'R0lGODlhDAAMAIQAAP//9/X17unp5WZmZgAAAOfn515eXvPz7Y6OjuDg4J+fn5OTk6enp56enmleECcgggoBADs=': 'image/gif',	// Full GIF signature
			'\x47\x49\x46\x38\x37\x61': 'image/gif',	// Additional GIF signature
			'\x47\x4F\x4F\x38': 'image/webp',
			'\x47\x4F\x4F\x47': 'image/heic',	// HEIC signature
			'\xFF\xD8\xFF\xFB': 'image/heif',	// HEIF signature
		};

		// Efficiently check for signatures using a typed array
		let signature = "image/jpeg";
		const byteArray = new Uint8Array(base64Data, 0, 4);	// Check only the first 4 bytes
		for (const _signature in signatures) {
			if (byteArray.every((byte, index) => byte === _signature[index])) {
				signature = signatures[_signature]; break;
			}
		}
	}

	async image(urlOrPathOrObject){
		if(typeof urlOrPathOrObject==="string"){
			if(/^(https?:)\/\//.test(urlOrPathOrObject)){
				const response = await fetch(urlOrPathOrObject);
				return {inlineData: {data:Buffer.from(await response.arrayBuffer()).toString('base64'), mimeType:response.headers.get('content-type')}}
			} else if(fs.existsSync(urlOrPathOrObject)){
				const data = Buffer.from(fs.readFileSync("cookie.png")).toString("base64");
				return {inlineData: {data:data, mimeType:this.getSignature(data)}}
			} else throw new Error(`This image source '${urlOrPathOrObject}' is neither a file path nor an url!`)
		} else if(urlOrPathOrObject instanceof Buffer){
			const data = urlOrPathOrObject.toString('base64');
			return {inlineData: {data:data, mimeType:this.getSignature(data)}}
		} else if(typeof urlOrPathOrObject==="object" && typeof urlOrPathOrObject.data==="string" && typeof urlOrPathOrObject.type==="string"){
			return {inlineData: {data:urlOrPathOrObject.data, mimeType:urlOrPathOrObject.type}}
		} else throw new Error(`Could not convert this image source '${urlOrPathOrObject}' to gemini parts object!`)
	}
}



module.exports = { GeminiHandler };