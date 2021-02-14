'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object
const lambda = require('./shared/lambda');

exports.convert = (data) => {
    let chart = {
        coordinates: []
    };
    let actuals = []
    let estimates = [];

    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            let dataRow = data[queryResult][row];
            let coordinate = {
                x: `${dataRow.calendaryear} Q${dataRow.calendarquarter}`,
                y: `${dataRow.value}`
            };

            if (dataRow.section.toLowerCase() === 'eps_estimation_actual') {
                actuals.push(coordinate);
            } else if (dataRow.section.toLowerCase() === 'eps_estimation_estimated') {
                estimates.push(coordinate);
            }
        });
    });

    actuals.forEach(a => {
        estimates = estimates.filter(e => {
            if (a.x === e.x) {
                chart.coordinates.push({
                    actual: {
                        x: a.x,
                        y: a.y
                    },
                    estimate: {
                        x: e.x,
                        y: e.y
                    }
                });
                return false;
            } else {
                return true;
            }
        });
    });

    estimates.forEach(e => {
        chart.coordinates.push({
            estimate: {
                x: e.x,
                y: e.y
            }
        });
    });

    return chart;
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

    let query = JSON.parse(JSON.stringify( q ));

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const data = await redshift.query(event, query, creds);

    console.log('data', data);
    if(!data || data.length < 1 || data[0].length < 1 || data[0][0].length < 1) {
        throw {
            statusCode: 404            
        }
    }

    const chart = exports.convert(data);
    
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