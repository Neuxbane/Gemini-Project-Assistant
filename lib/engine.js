const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, FunctionDeclarationSchemaType } = require("@google/generative-ai");
const fs = require('fs');
const delay = (milliseconds)=>new Promise(resolve => setTimeout(resolve, milliseconds));
const copy = (object)=> new Function(`return ${JSON.stringify(object)}`);
class GeminiHandler {
	// handler = [{rateLimit:10, key:"", query:0, currentQueryProcess:0, engine: new GoogleGenerativeAI()}];
	static models = {
		"gemini-1.5-pro-latest": { rateLimit: 60/2 * 1000, query:0, currentQueryProcess:1, unsupportedFeatures: [] },
		"gemini-1.5-flash-latest": { rateLimit: 60/15 * 1000, query:0, currentQueryProcess:1, unsupportedFeatures: [] },
		"gemini-1.0-pro-latest": { rateLimit: 60/15 * 1000, query:0, currentQueryProcess:1, unsupportedFeatures: ['systemInstruction', 'responseMimeType', 'videos', 'images', 'audio'] },
		"gemini-1.0-pro-vision-latest": { rateLimit: 60/60 * 1000, query:0, currentQueryProcess:1, unsupportedFeatures: ['systemInstruction', 'responseMimeType', 'audio'] },
	};
	
	constructor(APIKeys) {
		this.APIKeys = APIKeys;
		this.handler = APIKeys.map(x=>({queue:copy(models), key:x, engine:new GoogleGenerativeAI(x)}));
	}

	async generate(args = {part, history, functions, safetySettings, systemInstruction, temperature, responseMimeType, model}){
		const defaultArgs = {part: "", history:[], tools:[], safetySettings:undefined, systemInstruction:{ parts: [ {text: 'You are a human.'}, {text: 'Your mission is to act like a human casually.'}, {text: 'You should use function calling'} ] }, temperature: 2, responseMimeType: "text/plain"??"application/json", model: "gemini-1.5-flash-latest" };
		args = {...defaultArgs, ...args};
		const chooseEngine = this.handler.sort((a,b)=>(a.queue?.[args.model]?.query-a.queue?.[args.model]?.currentQueryProcess)-(b.queue?.[args.model]?.query-b.queue?.[args.model]?.currentQueryProcess))[0];
		if(!chooseEngine.queue?.[args.model]) throw new Error(`Unknown model name '${args.model}'. Please add the model rate limit to this library from https://ai.google.dev/gemini-api/docs/models/gemini`)
		const id = ++chooseEngine.queue[args.model].query;
		while(id!=this.handler.filter(x=>x.key==chooseEngine.key)[0].queue[args.model].currentQueryProcess) await delay(100);
		const model = chooseEngine.engine.getGenerativeModel({ model: args.model, safetySettings:args.safetySettings, tools:[{function_declarations:args.functions}], generationConfig: {temperature:args.temperature, responseMimeType:args.responseMimeType} });
		const chat = model.startChat({history:args.history, systemInstruction:args.systemInstruction});
		while(true){
			try{
				String.prototype.format = function(...value){
					if (!value.length) {
						return text;
					}
					
					return String(this).trim().split(/\{\}/).map((part, index) => (
						index % 2 === 0 ? part : value[Math.floor(index / 2)]
					)).join('');
				}
				const startTime = Date.now();
				const { response } = await chat.sendMessage(args.part);
				const functionCalls = response.functionCalls();
				const text = response.text();
				const history = await chat.getHistory();
				const format = args.part.filter ? args.part.filter(x=>x.functionResponse)?.map(x=>x.response) : [];
				setTimeout(()=>chooseEngine.queue[args.model].currentQueryProcess++, chooseEngine.queue[args.model].rateLimit - Date.now() + startTime);
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