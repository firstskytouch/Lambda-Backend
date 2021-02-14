'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object
const millify = require('millify');
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

    let query = JSON.parse(JSON.stringify( q ));

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const data = await redshift.query(event, query, creds);

    console.log('data', data);

    if((!data || data.length < 1) && (data[0].length < 1 && data[1].length < 1)) {
        throw {
            statusCode: 404            
        }
    }

    var tables = {
        estimate: {
            title: "Earning Estimate",
            table: {
                columns: [],
                data: {}
            }
        },
        history: {
            title: "Earnings History",
            table: {
                columns: [],
                data: {}
            }
        }
    };

    Object.keys(data).map(queryResult => {
        var actual, estimate;
        var actual_date, estimate_date;

        Object.keys(data[queryResult]).map(row => {
            let dataRow = data[queryResult][row];
            if (dataRow.table === 'earning_history') {
                switch(dataRow.section) {
                    case 'eps_act':
                        actual = Number(dataRow.value).toFixed(2);
                        actual_date = dataRow.periodenddate.toISOString().substr(0, 10);
                        break;
                    case 'eps_est':
                        estimate = Number(dataRow.value).toFixed(2);
                        estimate_date = dataRow.periodenddate.toISOString().substr(0, 10);
                        break;
                    default:
                        break;
                }

                if (!tables.history.table.data[dataRow.item]) tables.history.table.data[dataRow.item] = {};
                tables.history.table.data[dataRow.item][dataRow.periodenddate.toISOString().substr(0, 10)] = dataRow.value ? Number(dataRow.value).toFixed(2) : 'N/A';
                
                if (actual && estimate && (estimate_date === actual_date)) {
                    if (!tables.history.table.data['Difference']) tables.history.table.data['Difference'] = {};
                    tables.history.table.data['Difference'][dataRow.periodenddate.toISOString().substr(0, 10)] = Number(actual - estimate).toFixed(2);
                    //reset values
                    actual, estimate = undefined;
                    actual_date, estimate_date = undefined;
                }
            } else if (dataRow.table === 'earning_estimate') {
                if (!tables.estimate.table.data[dataRow.item]) tables.estimate.table.data[dataRow.item] = {};
                tables.estimate.table.data[dataRow.item][dataRow.col_name] = dataRow.value ? Number(dataRow.value).toFixed(2) : 'N/A';
            }
        });
    });

    const newHistoryData = Object.keys(tables.history.table.data).map(key => Object.assign({item: key}, tables.history.table.data[key]));        
    tables.history.table.data = newHistoryData;
    if (tables.history.table.data.length > 0) {
        Object.keys(tables.history.table.data[0]).map(key => tables.history.table.columns.push({title: key, field: key}));
    }

    const newEstimateData = Object.keys(tables.estimate.table.data).map(key => Object.assign({item: key}, tables.estimate.table.data[key]));        
    tables.estimate.table.data = newEstimateData;
    if (tables.estimate.table.data.length > 0) {
        Object.keys(tables.estimate.table.data[0]).map(key => tables.estimate.table.columns.push({title: key, field: key}));
    }

    return tables;
};


exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};