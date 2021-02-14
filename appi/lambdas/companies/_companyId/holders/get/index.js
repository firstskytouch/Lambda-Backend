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

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const data = await redshift.query(event, query, creds);

    console.log('data', data);

    if(!data || data.length < 1 ) {
        return [];
    }

    let cards = {
        percent_all_insider_shares: "N/A",
        last_filed: "N/A"
    };

    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            Object.keys(data[queryResult][row]).map(columnName => {
                if (columnName === 'percent_all_insider_shares' && data[queryResult][row][columnName]) {
                    cards.percent_all_insider_shares = Number(data[queryResult][row][columnName]).toFixed(2);
                } else if (columnName === 'filingdate' && data[queryResult][row][columnName]) {
                    cards.last_filed = data[queryResult][row][columnName].toISOString().substr(0, 10);
                }
            });
        });
    });

    return cards;
};


exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};