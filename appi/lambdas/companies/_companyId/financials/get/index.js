'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object
const lambda = require('./shared/lambda');

exports.convert = (data, event) => {
    let chart = {
        revenue: [],
        net_income: []
    }

    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            let dataRow = data[queryResult][row];

            if (dataRow.tab === 'Annual' && event.range.toLowerCase() === dataRow.tab.toLowerCase() && dataRow.section != 'assets') {
                chart[dataRow.section].push({
                    x: dataRow.x,
                    y: Number(dataRow.y).toFixed(2)
                });
            } else if (dataRow.tab === 'Quarterly' && event.range.toLowerCase() === dataRow.tab.toLowerCase() && dataRow.section != 'assets') {
                chart[dataRow.section].push({
                    x: `Q${dataRow.x} (${dataRow.fiscalyear})`,
                    y: Number(dataRow.y).toFixed(2)
                });
            }
        });
    });

    chart.revenue.reverse();
    chart.net_income.reverse();

    return chart;
};

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context, callback) => {

    if (!event.range) {
        console.log('Request does not have a range.');
        throw {
            statusCode: 400,
            errorMessage: 'Request does not have a range.'
        }
    }

    let query = JSON.parse(JSON.stringify( q ));

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const data = await redshift.query(event, query, creds);

    if(!data || data.length < 1 || data[0].length < 1 || data[0][0].length < 1) {
        throw {
            statusCode: 404            
        }
    }

    const chart = exports.convert(data, event);

    console.log('chart', JSON.stringify(chart));
    
    return chart;
};


exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};