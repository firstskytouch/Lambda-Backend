'use strict';

const validator = require('./shared/validator.js');

const s3Methods = require('./shared/s3.js');
const s3Bucket = process.env.worksheetsBucket;

const dynamoMethods = require('./shared/dynamo.js');
const dynamoTable = process.env.worksheetsTable;
const dynamoTableUsers = process.env.usersTable;
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
exports.run = async (event, context) => {
	event.worksheet_id = dynamoMethods.generateDynamoUUID();
	event.submission.effective_date = event.submission.effective_date.substr(0, 10);

	const userInfo = event.user;
	event.user_id = userInfo.userId;
	delete event.user;

	validator.loadModel('Worksheet');
	const isValidObject = validator.validate(event, 'Worksheet');
	if (isValidObject !== true) {
		throw {
			statusCode: 400,
			message: validator.generateErrorMsg(isValidObject)
		}
	}

	const userUpdateItem = {
		user_id: event.user_id,
		email: userInfo.email,
		worksheets: [ 
			event.worksheet_id 
		]
	};
	let original_notes = event.notes;
	const item = await s3Methods.serializeNotes(event, s3Bucket);
	const resItem = await dynamoMethods.putItem(item, dynamoTable);
	const res = await dynamoMethods.getItem(userUpdateItem.user_id, dynamoTableUsers, keyName);
	resItem.notes = original_notes;

	if (res) {
		return await dynamoMethods.updateItem(userUpdateItem, dynamoTableUsers, keyName) //update the users table
			.then((resUpdate) => {
				return resItem;
			})
			.catch((err) => {
				console.log(err, err.stack);
				throw err;
			});
	} else {
		return await dynamoMethods.putItem(userUpdateItem, dynamoTableUsers) //create user
		.then((resCreate) => {
			return resItem;
		})
		.catch((err) => {
			console.log(err, err.stack);
			throw err;
		});
	}
};


exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, exports.run);
};