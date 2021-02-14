'use strict';

const lambda = require('./shared/lambda');
const validator = require('./shared/validator.js');
const stage = process.env.stage;

const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`,
	log: 'info'
});
const esIndex = `${stage}.programs`;
const esType = 'Program';

const dynamoMethods = require('./shared/dynamo.js');
const dynamoTable = process.env.programsTable;
const hashKey = 'program_id';
const rangeKey = 'company_id';

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

	validator.loadModel('Program');
	const isValidObject = validator.validate(event, 'Program', ["program_id", "num_layers", "retention", "tower_size", "worksheet_id", "effective_date"]);
	if (isValidObject !== true) {
		throw {
			statusCode: 400,
			message: validator.generateErrorMsg(isValidObject)
		}
	}

	const table = event.table;
	event.layers = { data: event.table.data };
	delete event.table;

	const carriersData = await dynamoMethods.scan(carriersTable);
	const carriersList = carriersData.Items.map((x) => {
		return x.name;
	});

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
			const results = result.hits.hits.map(h => {
				return h._source;
			});
			return results;


		});

	let obj = event;
	obj.company_id = obj.companyId;
	delete obj.programId;
	delete obj.empty;
	delete obj.companyId;
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

		console.log(carriersList, o, isCarrierExist);
	
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

	console.log('length: ', results.length);

	if (results.length > 0) {
		obj = event.program_id = results[0].program_id;

		await dynamoMethods.updateItem(event, dynamoTable, hashKey, rangeKey)
			.then(res => {
				res.table = table;
				return res;
			})
			.catch(err => {
				console.log(err, err.stack);
				throw err
			});
	} else {
		await dynamoMethods.putItem(obj, dynamoTable, hashKey, rangeKey)
			.then(res => {
				res.table = table;
				return res;
			})
			.catch(err => {
				console.log(err, err.stack);
				throw err
			});
	}
	return results;
};

exports.handler = async (event, context, callback) => {
	console.log('event:', JSON.stringify(event));

	if (event.stayWarm) {
		console.log('Warmup Event');
		return callback(null, {});
	}
	return await lambda.handler(event, context, exports.run);
};