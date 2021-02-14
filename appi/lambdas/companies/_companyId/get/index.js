'use strict';

const millify = require('millify');
const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`,
});
const lambda = require('./shared/lambda');

const stage = process.env.stage;

const esIndex = `${stage}.companies`;
const esType = 'Company';

const dynamoMethods = require('./shared/dynamo.js');
const dynamoTable = process.env.predictionTable;
const keyName = 'companyid';

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context) => {

    const result = await esClient.search({
        index: esIndex,
        type: esType,
        body: {
            query: {
                match: {
                    symbolvalue: event.companyId
                }
            }
        }
    })

    const result2 = await dynamoMethods.getItem(result.hits.hits[0]._source.companyid, dynamoTable, keyName);

    const results = result.hits.hits.map((h) => {
        const msciAgrAsOfDate = h._source.msci_agr_as_of_date;
        const msciGmAsOfDate = h._source.msci_gm_as_of_date;
        const cfraAsOfDate = h._source.cfra_last_reported;

        let sweetspot = 'N/A';
        let sweetspot_bermuda = 'N/A';

        if (result2) {
            if ( !result2.model || (result2.model === 'sca' && result2.rounded_sweetspot_char)) {
                sweetspot = result2.rounded_sweetspot_char;
            } else if (result2.model === 'ipo_yr2') {
                sweetspot = result2.rounded_ipo_sweetspot_char;
            }
        }

        if (result2) {
            if (  !result2.model || (result2.model === 'sca' && result2.rounded_sweetspot_char_bermuda)) {
                sweetspot_bermuda = result2.rounded_sweetspot_char_bermuda;
            } else if (result2.model === 'ipo_yr2') {
                sweetspot_bermuda = result2.rounded_ipo_sweetspot_char;
            }
        }

        return {
            company_id: h._source.symbolvalue,
            snp_company_id: h._source.companyid,
            name: h._source.name,
            industry: h._source.industry,
            headquarters: h._source.headquarters,
            website: h._source.website,
            phone: h._source.phone,
            ticker: h._source.tickersymbol,
            sic: `${h._source.sic}`,
            market_cap: `$${millify(Number(h._source.marketcap).toFixed(2) * 1000 * 1000)}`,
            market_cap_price_delta: 'N/A',
            msci_agr_as_of_date: msciAgrAsOfDate ? `${msciAgrAsOfDate.substring(0, 4)}-${msciAgrAsOfDate.substring(4, 6)}-${msciAgrAsOfDate.substring(6, 8)}` : undefined,
            msci_agr_rating: h._source.msci_agr_rating && h._source.msci_agr_percentile ?
                `${h._source.msci_agr_rating} (${Number(h._source.msci_agr_percentile).toFixed()})` : 'N/A',
            msci_governance: h._source.msci_governance_score ? Number(h._source.msci_governance_score).toFixed(2) : 'N/A',
            msci_gm_as_of_date: msciGmAsOfDate ? `${msciGmAsOfDate.substring(0, 4)}-${msciGmAsOfDate.substring(4, 6)}-${msciGmAsOfDate.substring(6, 8)}` : undefined,
            cfra_risk_score: h._source.cfra_decile ? h._source.cfra_decile : 'N/A',
            cfra_as_of_date: cfraAsOfDate ? new Date(cfraAsOfDate).toISOString().substring(0, 10) : undefined,
            incorporationcountryname: h._source.incorporationcountryname ? h._source.incorporationcountryname : undefined,
            rounded_sweetspot_char: sweetspot,
            rounded_sweetspot_char_bermuda: sweetspot_bermuda,
            otc_flag: h._source.otc_flag,
            company_type: h._source.companytype.toLowerCase().split(' ')[0],
            predictive_model: (result2 && result2.model) ? result2.model : null 
        };
    });

    const reducedResults = results.filter((obj, pos, arr) => {
        return arr.map(mapObj => mapObj.name).indexOf(obj.name) === pos;
    });

    return {
        company: reducedResults[0]
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