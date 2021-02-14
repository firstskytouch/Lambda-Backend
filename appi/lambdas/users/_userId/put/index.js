'use strict';

const validator = require('./shared/validator.js');
const dynamoMethods = require('./shared/dynamo.js');
const dynamoTable = process.env.usersTable;
const keyName = 'user_id';

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
exports.run = async (event, context, callback) => {

	validator.loadModel('User');
	const isValidObject = validator.validate(event, 'User', [ "user_id" ]);

	if (isValidObject !== true) {
		throw {
			statusCode: 400,
			message: validator.generateErrorMsg(isValidObject)
		};
	}

	const response = await dynamoMethods.updateItem(event, dynamoTable, keyName)
	.then(res => {
		return res;
	})
	.catch(err => {
		throw err;
	});
	
	return response;
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, exports.run);
};
