'use strict';

const dynamoMethods = require('./shared/dynamo.js');
const dynamoTable = process.env.usersTable;
const keyName = 'user_id';
const lambda = require('./shared/lambda');

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context) => {
	return await dynamoMethods.getItem(event[keyName], dynamoTable, keyName);
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }

    return await lambda.handler(event, context, handler);
};