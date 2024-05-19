const { FunctionDeclarationSchemaType } = require("@google/generative-ai");
const childProcess = require("node:child_process");
const fs = require("node:fs");
module.exports = [{
	name: 'currentTime',
	description: 'Gets the current time in a specific time zone.',
	parameters: {
		type: FunctionDeclarationSchemaType.OBJECT,
		properties:{
			timeZone: {
				type: FunctionDeclarationSchemaType.STRING,
				description: 'The desired time zone. (e.g., Asia/Calcutta)',
			},
		},
		required: ['timeZone'],
	},
	function: async (args) => {
		const { timeZone } = args;
		return { time: new Date().toLocaleString('en-US', { timeZone }) };
	},
},{
	name: 'runBashCommand',
	description: 'Runs a bash command. (e.g., ls, echo, etc.)',
	parameters: {
		type: FunctionDeclarationSchemaType.OBJECT,
		properties:{
			command: {
				type: FunctionDeclarationSchemaType.STRING,
				description: 'The bash command to run.',
			},
		},
		required: ['command'],
	},
	function: async (args) => {
		const { command } = args;
		return { result: await new Promise((resolve, reject) => {
			childProcess.exec(command, (error, stdout, stderr) => {
				if (error) reject(error);
				else resolve({ result: stdout });
			});
		}) };
	},
},{
	name: 'writeFile',
	description: 'Writes a file. (e.g., writing a text file, etc.)',
	parameters: {
		type: FunctionDeclarationSchemaType.OBJECT,
		properties:{
			path: {
				type: FunctionDeclarationSchemaType.STRING,
				description: 'The path of the file to write.',
			},
			content: {
				type: FunctionDeclarationSchemaType.STRING,
				description: 'The content to write to the file.',
			},
		},
		required: ['path', 'content'],
	},
	function: async (args) => {
		const { path, content } = args;
		return { result: new Promise((resolve, reject) => {
			fs.writeFile(path, content, (err) => {
				if (err) reject(err);
				else resolve({ result: `File ${path} has been written.` });
			});
		}) };
	},
}];
