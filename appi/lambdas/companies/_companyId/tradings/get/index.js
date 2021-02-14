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
    
    if(!data || data.length < 1 || data[0].length < 1 || data[0][0].length < 1) {
        throw {
            statusCode: 404            
        }
    }

    var tables = {
        stock_history: {
            title: "Stock Price History",
            table: {
                columns: [
                    {
                        title: "Item",
                        field: "item"
                    },
                    {
                        title: "Value",
                        field: "value"
                    }
                ],
                data: []
            }
        },
        share_stats: {
            title: "Share Statistics",
            table: {
                columns: [
                    {
                        title: "Item",
                        field: "item"
                    },
                    {
                        title: "Value",
                        field: "value"
                    }
                ],
                data: []
            }
        },
        dividends_splits: {
            title: "Dividends & Splits",
            table: {
                columns: [
                    {
                        title: "Item",
                        field: "item"
                    },
                    {
                        title: "Value",
                        field: "value"
                    }
                ],
                data: []
            }
        }
    };

    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            let dataRow = data[queryResult][row];
            if (dataRow.table.toLowerCase() === 'stock_history') {
                tables.stock_history.table.data.push({
                    item: dataRow.item,
                    value: dataRow.item.indexOf('Change') > -1 ? `${Number(dataRow.value * 100).toFixed(2)}%` : Number(dataRow.value).toFixed(2)
                });
            } else if (dataRow.table.toLowerCase() === 'dividends_splits') {
                tables.dividends_splits.table.data.push({
                    item: dataRow.item,
                    value: Number(dataRow.value).toFixed(2)
                });
            } else if (dataRow.table.toLowerCase() === 'dividends_splits_dates') {
                tables.dividends_splits.table.data.push({
                    item: dataRow.item,
                    value: moment(dataRow.value).format('MMM Do, YYYY')
                });
            } else if (dataRow.table.toLowerCase() === 'share_stats') {
                tables.share_stats.table.data.push({
                    item: dataRow.item,
                    value: dataRow.unit === 'Millions' ? `${Number(dataRow.value).toFixed(2)}M` : (dataRow.item === '10 Day Average Volume' ? `${Number(dataRow.value/1000000).toFixed(2)}M`: `${Number(dataRow.value).toFixed(2)}%`)
                });
            }
        });
    });

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