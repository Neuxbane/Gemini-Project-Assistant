const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, FunctionDeclarationSchemaType } = require("@google/generative-ai");
const fs = require('fs');
const delay = (milliseconds)=>new Promise(resolve => setTimeout(resolve, milliseconds));

class GeminiHandler {
	// handler = [{rateLimit:10, key:"", query:0, currentQueryProcess:0, engine: new GoogleGenerativeAI()}];
	constructor(APIKeys) {
		this.APIKeys = APIKeys;
		this.handler = APIKeys.map(x=>({rateLimit: 60/2 * 1000, key:x, query:0,currentQueryProcess:1, engine:new GoogleGenerativeAI(x)}));
	}

	async generate(args = {part, history, functions, safetySettings, systemInstruction, temperature, responseMimeType}){
		const defaultArgs = {part: "", history:[], tools:[], safetySettings:undefined, systemInstruction:{ parts: [ {text: 'You are a human.'}, {text: 'Your mission is to act like a human casually.'} ] }, temperature: 0.2, responseMimeType: "text/plain"??"application/json" };
		args = {...defaultArgs, ...args};
		const chooseEngine = this.handler.sort((a,b)=>(a.query-a.currentQueryProcess)-(b.query-b.currentQueryProcess))[0];
		const id = ++chooseEngine.query;
		while(id!=this.handler.filter(x=>x.key==chooseEngine.key)[0].currentQueryProcess) await delay(100);
		const model = chooseEngine.engine.getGenerativeModel({ model: "gemini-1.5-pro-latest", safetySettings:args.safetySettings, tools:[{function_declarations:args.functions}], generationConfig: {temperature:args.temperature, responseMimeType:args.responseMimeType} });
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
				console.log(args.part)
				const startTime = Date.now();
				const { response } = await chat.sendMessage(args.part);
				const functionCalls = response.functionCalls();
				const text = response.text();
				const history = await chat.getHistory();
				await delay(Date.now()-startTime);
				chooseEngine.currentQueryProcess++;
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
					text: text.format(...args.part.filter(x=>x.functionResponse).map(x=>x.response)),
					history: history
				};
			} catch(e) {
				console.error(e);
				await delay(chooseEngine.rateLimit);
			}
		}
	}
}



module.exports = { GeminiHandler };