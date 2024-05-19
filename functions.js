const { FunctionDeclarationSchemaType } = require("@google/generative-ai");

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
}]