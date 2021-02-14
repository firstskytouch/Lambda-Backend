'use strict';

const lambda = require('./shared/lambda');
const validator = require('./shared/validator.js');
const stage = process.env.stage;

const dynamoMethods = require('./shared/dynamo.js');
const dynamoTable = process.env.programsTable;
const hashKey = 'program_id';
const rangeKey = 'company_id';

const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`,
	log: 'trace'
});

const esIndex = `${stage}.programs`;
const esType = 'Program';

const carriersTable = process.env.carriersTable;
const OTHER_CARRIER = 'Other';

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
exports.run = async (event, context, callback) => {

	event.program_id = dynamoMethods.generateDynamoUUID();

	validator.loadModel('Program');
	const isValidObject = validator.validate(event, 'Program');
	if (isValidObject !== true) {
		throw {
			statusCode: 400,
			message: validator.generateErrorMsg(isValidObject)
		}
	}

	const carriersData = await dynamoMethods.scan(carriersTable);
	const carriersList = carriersData.Items.map(x => {
		return x.name;
	});

	const table = event.table;

	if (event.companyId) {
		event.company_id = event.companyId;
		delete event.companyId;
	}

	event.layers = { data: event.table.data };
	delete event.table;

	const results = await esClient.search({
		index: esIndex,
		type: esType,
		body: {
			query: {
				bool: {
					must: [
						{
							range: {
								effective_date: {
									gte: "now-1y/d"
								}
							}
						},
						{
							match: {
								worksheet_id: event.worksheet_id
							}
						}
					]
				}
			},
			from: 0, size: 1,
			sort: { effective_date: { order: "desc" } }
		}
	})
		.then(result => {
			const res = result.hits.hits.map(h => {
				return h._source;
			});
			return res;

		});

	let obj = event;

	delete obj.userId;
	delete obj.user_id;
	delete obj.email;

	for (let o of obj.layers.data) {
		if (o.other_carrier && o.carrier === o.other_carrier) {
			delete o.other_carrier;
		}
	
		if (o.carrier === OTHER_CARRIER && o.other_carrier) {
			o.carrier = o.other_carrier;
		}
	
		const isCarrierExist = carriersList.find(x => x === o.carrier);
	
		if (isCarrierExist === undefined) {
			const obj = {
				name: o.carrier,
				confirmed: false
			}
			await dynamoMethods.putItem(obj, carriersTable)
			.catch(err => {
				console.log(err, err.stack);
				throw err
			});
		}
	}

	if (results.length > 0) {
		obj.program_id = results[0].program_id;

		const response = await dynamoMethods.updateItem(event, dynamoTable, hashKey, rangeKey)
			.then(res => {
				res.table = table;
				return res;
			})
			.catch(err => {
				console.log(err, err.stack);
				throw err;
			});

		return response;
	} else {
		const response = await dynamoMethods.putItem(obj, dynamoTable, hashKey, rangeKey)
			.then(res => {
				res.table = table;
				return res;
			})
			.catch(err => {
				console.log(err, err.stack);
				throw err;
			});
		return response;
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