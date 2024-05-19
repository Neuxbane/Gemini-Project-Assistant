const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const delay = (milliseconds)=>new Promise(resolve => setTimeout(resolve, milliseconds));
const copy = (object)=> new Function(`return ${JSON.stringify(object)}`)();
class GeminiHandler {
	static models = {
		"gemini-1.5-pro-latest": {name:"gemini-1.5-pro-latest", RPM: 60/2 * 1000, RPD: 50, query:0, currentQueryProcess:1, unsupportedFeatures: [] },
		"gemini-1.5-flash-latest": {name:"gemini-1.5-flash-latest", RPM: 60/15 * 1000, RPD: 1500, query:0, currentQueryProcess:1, unsupportedFeatures: [] },
		"gemini-1.0-pro-latest": {name:"gemini-1.0-pro-latest", RPM: 60/15 * 1000, RPD: 1500, query:0, currentQueryProcess:1, unsupportedFeatures: ['systemInstruction', 'responseMimeType', 'videos', 'images', 'audio'] },
		"gemini-1.0-pro-vision-latest": {name:"gemini-1.0-pro-vision-latest", RPM: 60/60 * 1000, RPD: Infinity, query:0, currentQueryProcess:1, unsupportedFeatures: ['systemInstruction', 'responseMimeType', 'audio'] },
	};

	constructor(APIKeys) {
		this.APIKeys = APIKeys;
		this.handler = APIKeys.map(x=>({models:copy(GeminiHandler.models), key:x, engine:new GoogleGenerativeAI(x)}));
	}

	async generate(args = {parts, history, functions, safetySettings, systemInstruction, temperature, responseMimeType, model}){
		const defaultArgs = {parts: "", history:[], tools:[], safetySettings:undefined, systemInstruction:[ {text: 'You are a human.'}, {text: 'Your mission is to act like a human casually.'}, {text: 'You should use function calling'} ], temperature: 1, responseMimeType: "text/plain"??"application/json", model: "gemini-1.5-flash-latest" };
		if(typeof(args.parts)==="string")args.parts=[{text:args.parts}];
		args = {...defaultArgs, ...args};
		const chooseEngine = this.handler.sort((a,b)=>(a.models?.[args.model]?.query-a.models?.[args.model]?.currentQueryProcess)-(b.models?.[args.model]?.query-b.models?.[args.model]?.currentQueryProcess))[0];
		if(!chooseEngine.models?.[args.model]) throw new Error(`Unknown model name '${args.model}'. Please add the model rate limit to this library from https://ai.google.dev/gemini-api/docs/models/gemini`)
		const id = ++chooseEngine.models[args.model].query;
		while(id!=this.handler.filter(x=>x.key==chooseEngine.key)[0].models[args.model].currentQueryProcess) await delay(100);
		
		let _tmp = { model: args.model, safetySettings:args.safetySettings, generationConfig: {temperature:args.temperature} };
		const unsupportedFeatures = chooseEngine.models[args.model].unsupportedFeatures;
		if(!unsupportedFeatures.includes("tools")) _tmp = {..._tmp, tools:[{function_declarations:args.functions}]};
		if(!unsupportedFeatures.includes("responseMimeType")) _tmp = {..._tmp, generationConfig:{..._tmp.generationConfig, responseMimeType:args.responseMimeType}};
		else args.parts.push({text: `Please response only in "${args.responseMimeType}" format`});
		const model = chooseEngine.engine.getGenerativeModel(_tmp);
		
		_tmp = {};
		if(!unsupportedFeatures.includes("systemInstruction")) _tmp = {..._tmp, systemInstruction:{ parts:args.systemInstruction }};
		else args.parts.push({text: "SYSTEM INSTRUCTION BEGIN"}, ...args.systemInstruction, {text: "SYSTEM INSTRUCTION END"});
		if(!unsupportedFeatures.includes("history")) _tmp = {..._tmp, history:args.history};
		const chat = model.startChat(_tmp);
		while(true){
			try{
				String.prototype.format = function(...v){
					if (!v.length)return text;
					return String(this).trim().split(/\{\}/).map((p,i)=>(i%2===0?p:v[Math.floor(i/2)])).join('');
				}
				const startTime = Date.now();
				const { response } = await chat.sendMessage(args.parts);
				const functionCalls = response.functionCalls();
				const text = response.text();
				const history = await chat.getHistory();
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
}



module.exports = { GeminiHandler };