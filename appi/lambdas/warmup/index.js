'use strict';

//aws
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();
const lambdaList = require('./lambdas.json'); //list of lambda API endpoints

//env vars
const envStage = process.env.stage;
const stackName = process.env.stack;

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
exports.handler = (event, context, callback) => {
	console.log('event:', JSON.stringify(event));

	//invoke each function once to keep it warm (a.k.a. active)
	lambdaList.functions.forEach(functionName => {
		lambda.invoke({
			FunctionName: `${stackName}-${envStage}-${functionName}`,
			InvocationType: 'Event',
			Payload: JSON.stringify({
				"stayWarm": true
			})
		}, (err, data) => {
			if (err) {
				console.log(err, err.stack);
			}
		});
	});
};
