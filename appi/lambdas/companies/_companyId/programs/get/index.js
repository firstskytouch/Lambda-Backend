'use strict';

const lambda = require('./shared/lambda');
const dynamoMethods = require('./shared/dynamo.js');
const dynamoTable = process.env.carriersTableName;

const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`,
	log: 'info'
});

const stage = process.env.stage;

const esIndex = `${stage}.programs`;
const esType = 'Program';

const carriers = require('./carriers');
const OTHER_CARRIER = 'Other';


function generateTable() {
	const table =  {
		"columns": [
			{
				"title": "Layer",
				"field": "layer"
			},
			{
				"title": "Carrier",
				"field": "carrier"
			},
			{
				"title": "Limit ($)",
				"field": "limit"
			},
			{
				"title": "Attachment/Retention",
				"field": "attachment"
			},
			{
				"title": "Premium ($)",
				"field": "premium"
			},
			{
				"title": "Technical Price",
				"field": "technicalPrice"
			},
			{
				"title": "RPM",
				"tooltip": `Rate per Mill
				Premium ($K) / limit ($M)`,
				"field": "rpm"
			},
			{
				"title": "ROL (%)",
				"tooltip": "Rate on line",
				"field": "rol"
			}
		],
		"data": [

		]
	}
	return table;
}

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context, callback) => {
	// if (carriers) {
	// 	for (let a of carriers) {
	// 		await dynamoMethods.putItem( {name: a}, dynamoTable);
	// 	}
	// }
	
	let carriersList = carriers;

	if (dynamoTable) {
		const data = await dynamoMethods.scan(dynamoTable);
		carriersList = data.Items.map((x) => {
			if (x.confirmed === false) {
				return null;
			}
			return x.name;
		}).filter( (el) => {
			return el != null;
		})
	}

	if (carriersList.length === 0) {
		carriersList = carriers;
	} else {
		carriersList.push(OTHER_CARRIER);
	}
	

	let table = generateTable();

	const mustObjs = [];
	const mustNotObjs = [];
	let dateRante = {
		gte: "now/d",
		format: "yyyy-mm-dd"
	};
	let size = 1;

	let matchObj = {
		worksheet_id: event.worksheet_id
	};

	if (event.type && event.type === 'expired') {
		size = 3;
		dateRante = {
			lt: "now/d",
			format: "yyyy-mm-dd"
		};

		matchObj = {
			company_id: event.companyId
		}

		mustObjs.push({
			range: {
				effective_date: dateRante
			}
		});
		if (event.worksheet_id && event.worksheet_id !== 'undefined') {
			mustNotObjs.push({
				"match": {
					worksheet_id: event.worksheet_id
				}
			});
		}
	}

	mustObjs.push({
		match: matchObj
	});

	let response = { table: generateTable() };

	const getCarrier = (carrierList, row) => {
		if (!row.carrier) {
			row.carrier = OTHER_CARRIER;
			return row;
		}
		const find = carrierList.find(x => x === row.carrier);
		if (!find) {
			row.other_carrier = row.carrier;
			row.carrier = OTHER_CARRIER;

			return row;
		} else {
			return row;
		}
	}

	await esClient.search({
		index: esIndex,
		type: esType,
		size: 500,
		body: {
			query: {
				bool: {
					must: mustObjs,
					must_not: mustNotObjs
				}
			},
			from: 0, size: size,
			sort: { effective_date: { order: "desc" } }
		}
	})
		.then((result) => {
			const results = result.hits.hits.map((h) => {
				return h._source;
			});

			if (event.type && event.type === 'expired') {
				let expiredResponse = [];
				if (results.length > 0) {
					for (let r of results) {
						let t = generateTable();
						t.data = r.layers.data

						for (let i = 0; i < t.data.length; i++) {
							if (i === 0) {
								t.data[i].layer = 'Primary';
							} else if (i === 1) {
								t.data[i].layer = '1st XS';
							} else if (i === 2) {
								t.data[i].layer = '2nd XS';
							} else if (i === 3) {
								t.data[i].layer = '3rd XS';
							} else {
								t.data[i].layer = `${i}th XS`;
							}
							delete r.layers;
							t = getCarrier(carriersList, t);
							r.table = t;
						}
						expiredResponse.push(r);
					}
				}

				response = expiredResponse;
				return expiredResponse;
			} else {
				if (results.length > 0) {
					response = results[0];
					table.data = response.layers.data;

					for (let i = 0; i < table.data.length; i++) {
						if (i === 0) {
							table.data[i].layer = 'Primary';
						} else if (i === 1) {
							table.data[i].layer = '1st XS';
						} else if (i === 2) {
							table.data[i].layer = '2nd XS';
						} else if (i === 3) {
							table.data[i].layer = '3rd XS';
						} else {
							table.data[i].layer = `${i}th XS`;
						}
						table.data[i] = getCarrier(carriersList, table.data[i]);
					}

					response.empty = false;
					delete response.layers;
				} else {
					response.empty = true;
					if (event.type && event.type === 'expired') {
						return {};
					} else {
						table.data = [
							{ carrier: "", premium: "0", limit: "0" }
						];
					}
				}
				response.table = table;
				response.carriers = carriersList;
				return response;
			}

		}).catch((err) => {
			console.log('err', err);
			throw err

		});

	return response;
};

exports.handler = async (event, context, callback) => {
	console.log('event:', JSON.stringify(event));

	if (event.stayWarm) {
		console.log('Warmup Event');
		return callback(null, {});
	}
	return await lambda.handler(event, context, handler);
};