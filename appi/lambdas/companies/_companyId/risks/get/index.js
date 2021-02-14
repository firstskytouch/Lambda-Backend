'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object
const lambda = require('./shared/lambda');

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context, callback) => {

    let query = JSON.parse(JSON.stringify( q ));

    query.queries[0] = `
        SELECT 
        COUNT(CASE WHEN item_1_03 = '' THEN null ELSE item_1_03 END) as bankruptcy_or_receivership, 
        COUNT(CASE WHEN item_4_01  = '' THEN null ELSE item_4_01 END) as change_in_registrant_acc, 
        COUNT(CASE WHEN item_5_02  = '' THEN null ELSE item_5_02 END) as change_in_do, 
        COUNT(ri_chg_acctg_principle) as ri_chg_acctg_principle, COUNT(ri_chg_rev_recognition) as ri_chg_rev_recognition, 
        COUNT(ri_debt_covenant) as ri_debt_covenant, COUNT(ri_env_liabilities) as ri_env_liabilities,
        COUNT(ri_fin_restatements) as ri_fin_restatements, COUNT(ri_going_concern) as ri_going_concern, 
        COUNT(ri_goodwill_impairment) as ri_goodwill_impairment, COUNT(ri_level3_assets) as ri_level3_assets, 
        count(CASE WHEN ri_litigation  = 'True' THEN ri_litigation ELSE null END) as ri_litigation,
        COUNT(ri_material_weakness) as ri_material_weakness,
        COUNT(ri_pensions) as ri_pensions, COUNT(ri_related_parties) as ri_related_parties,
        COUNT(ri_restructuring) as ri_restructuring,
        COUNT(ri_securitization_factoring) as ri_securitization_factoring, COUNT(ri_write_offs) as ri_write_offs 
        from (
        select * from (
        SELECT ROW_NUMBER()
                        OVER(PARTITION BY accession_number
                        ORDER BY accession_number DESC) AS StRank, *
                        FROM (
                                     ${query.queries[0]}
                                    ) t1 ) where strank = 1
                                    )  GROUP BY central_index_key
    `;

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const data = await redshift.query(event, query, creds);

    if(!data || data.length < 1 || data[0].length < 1 || data[0][0].length < 1) {
        throw {
            statusCode: 404            
        }
    }
    const risks = [];

    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            Object.keys(data[queryResult][row]).map(columnName => {
                let columnData = data[queryResult][row][columnName];
                if (columnName != query.query_predicate_name && columnData != "0") {
                    risks.push({
                        filing_type: (['bankruptcy_or_receivership', 'change_in_registrant_acc', 'change_in_do'].includes(columnName)) ? '8-K' : "10-K 10-Q",
                        risk_name: query.metadata[columnName],
                        risk_frequency: columnData
                    });
                }
            });
        });
    });

    return risks;
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};