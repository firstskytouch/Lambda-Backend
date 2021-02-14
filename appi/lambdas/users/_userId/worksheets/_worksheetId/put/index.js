'use strict';

const lambda = require('./shared/lambda');
const validator = require('./shared/validator.js');

const s3Methods = require('./shared/s3.js');
const s3Bucket = process.env.worksheetsBucket;

const dynamoMethods = require('./shared/dynamo.js');
const dynamoTable = process.env.worksheetsTable;
const keyName = 'worksheet_id';

const dynamoTable2= process.env.programsTable;
const hashKey = 'program_id';
const rangeKey = 'company_id';

const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`,
	log: 'info'
});

const stage = process.env.stage;
const esIndex = `${stage}.programs`;
const esType = 'Program';

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
exports.run = async (event, context, callback) => {

	const userInfo = event.user;
	event.user_id = userInfo.userId;
	delete event.user;

	validator.loadModel('Worksheet');
	const isValidObject = validator.validate(event, 'Worksheet', [ "user_id", "worksheet_id" ]);

	if (isValidObject !== true) {
		throw {
			statusCode: 400,
			message: validator.generateErrorMsg(isValidObject)
		}
	}

	const res = await s3Methods.serializeNotes(event, s3Bucket)
	.then((item) => {
		dynamoMethods.updateItem(item, dynamoTable, keyName);
	})

	const results = await esClient.search({
		index: esIndex,
		type: esType, 
		body: {
			query: {
				bool: {
					must: [
					  {
						match: {
							worksheet_id: event.worksheet_id
						}
					  }
					]
				}
			}
		}
	})
	.then((result) => {
		const rs = result.hits.hits.map((h) => {
			return h._source;
		});
		return rs;
	});
	
	if (results.length > 0) {
		const currentProgram = results[0];
		
		currentProgram.effective_date = event.submission.effective_date;
		currentProgram.worksheet_id = event.worksheet_id;

		const r = await dynamoMethods.updateItem(currentProgram, dynamoTable2, hashKey, rangeKey)
		.then((response) => {
			return response;
		}).catch((e) => {
			console.log(e);
			throw e;
		});
		return r;
	} else {
		return results;
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