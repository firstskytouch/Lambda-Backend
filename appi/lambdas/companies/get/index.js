'use strict';

const lambda = require('./shared/lambda');
const tickerCikMap = require('./ticker-cik.json');
const millify = require('millify');
const stage = process.env.stage;

const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`
});
const esIndex = `${stage}.companies`;
const esType = 'Company';

const groupBy = (arr, key) => {
    return arr.reduce((rv, x) => {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
};

const deduplicateWrongCIK = (groups, ticker_to_cik) => {
    let results = [];
    
    Object.keys(groups).map(e => { 
        if(groups[e].length > 1) { 
            let ticker = groups[e][0].ticker;
            let activeCIK = ticker_to_cik[ticker] ? ticker_to_cik[ticker] : null;

            if (activeCIK) {
                groups[e][0].company_id = activeCIK;
            }

            delete groups[e][0].duplicate;

            results.push(groups[e][0]);
        } else { 
            results.push(groups[e][0]);
        } 
    });

    return results;
};

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context) => {
	if (!event.companyName) {
		console.log('Request does not have a search query.');
		throw {
            statusCode: 400,
            errorMessage: 'Request does not have a search query.'
        }
	}
	
	const result = await esClient.search({ 
		index: esIndex, 
		type: esType, 
		body: {
			query: {
				multi_match: {
					query: event.companyName,
				    fields: [ "name", "tickersymbol" ],
					type: "phrase_prefix",
					tie_breaker: 0.3
				}
		  	},
		  	sort: [
			    // {
			    //   	marketcap: {
			    //     	order: "desc"
			    //   	}
			    // },
			    {
		    		_score: {
		    			order: "desc"
		    		}
			    }
  			]
		} 
	});

	const results = result.hits.hits.map(h => {
		return {
			company_id: h._source.symbolvalue,
			name: h._source.name,
			ticker: h._source.tickersymbol || "-",
			market_cap: `${millify(Number(h._source.marketcap).toFixed(2) * 1000 * 1000)}`,
			sic: h._source.sic || '-',
			industry: h._source.industry || '-',
			type: h._source.companytype.toLowerCase().split(' ')[0]
		};
	});
	
	const reducedResults = deduplicateWrongCIK(groupBy(results, 'name'), tickerCikMap);

	const publicCompanies = reducedResults.filter((obj, pos) => {
		return obj.ticker != "-";
	});

	return { 
		searchResults: publicCompanies 
	}

};


exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};