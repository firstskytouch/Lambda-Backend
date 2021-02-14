'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object
const moment = require('moment');
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
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }

    let query = JSON.parse(JSON.stringify( q ));

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const data = await redshift.query(event, query, creds);

    console.log('data', data);

    if(!data || data.length < 1 || data[0].length < 1 || data[0][0].length < 1) {
        throw {
            statusCode: 404            
        }
    }

    var table = {
        columns: [
            {
                title: "Name",
                field: "name"
            },
            {
                title: "Number of Shares Owned",
                field: "shares"
            },
            {
                title: "Percentage of Outstanding Shares",
                field: "percent"
            },
            {
                title: "Date Reported",
                field: "date_reported"
            }
        ],
        data: []
    };

    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            let dataRow = data[queryResult][row];
            table.data.push({
                name: dataRow.name,
                shares: Number(dataRow.shares).toLocaleString(),
                percent: Number(dataRow.perc).toFixed(2),
                date_reported: moment(dataRow.date_reported.toISOString().substr(0, 10)).format('MMM Do, YYYY')
            });
        });
    });

    return table;
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};