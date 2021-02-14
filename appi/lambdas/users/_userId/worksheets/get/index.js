'use strict';

const lambda = require('./shared/lambda');
const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`,
	log: 'info'
});

const stage = process.env.stage;

const esIndex = `${stage}.worksheets`;
const esType = 'Worksheet';

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context) => {

	if (!event.userId) {
		console.log('Request does not have a userId');
		throw {
			statusCode:400,
			errorMessage: 'Request does not have a userId'
		}
	}
	
	const result = await esClient.search({ 
		index: esIndex,
		type: esType, 
		size: 500,
		body: {
			query: {
				bool: {
					must: [
						{ match: { user_id: event.userId }},
						{ bool: {
							should: [
								{
									range: {
										"submission.effective_date": {
											gt:  "now-90d/d"
										}
									}
								},
								{
									bool: {
										must: [
											{ "term" : {"state" : "wip"}},
											{range: {
												"updated_at": {
													gt:  "now-7d/d"
												}
											}}
										]
									}
									
								}
							]
						}}
					]
				}
			},
			sort: [
			    {
			      	"submission.effective_date": {
			        	order: "asc"
			      	}
			    }
  			]
		} 
	});

	const results = result.hits.hits.map(h => {
		return h._source;
	});
	
	return { 
		results: results 
	};
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};