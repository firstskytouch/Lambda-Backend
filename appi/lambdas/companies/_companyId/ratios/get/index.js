'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object

const lambda = require('./shared/lambda');

const stage = process.env.stage;

const longestArrayIndex = (array) => {
    var max = -Infinity;
    var index = -1;

    array.forEach((a, i) => {
        let len = Object.keys(a).length;
        if (len > max) {
            max = len;
            index = i;
        }
    });

    return index;
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

    let peerGroup = event.peerGroup || 'sector';
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
        operations: {
            title: "Operation Ratios",
            table: {
                columns: [],
                data: {}
            }
        },
        management: {
            title: "Management Effectiveness Ratios",
            table: {
                columns: [],
                data: {}
            }
        },
        coverage_leverage: {
            title: "Coverage & Leverage Ratios",
            table: {
                columns: [],
                data: {}
            }
        },
        liquidity_activity: {
            title: "Liquidity & Activity Ratios",
            table: {
                columns: [],
                data: {}
            }
        },
        insurance: {
            title: "P&C Underwriting Ratios",
            table: {
                columns: [],
                data: {}
            }
        },
        banking: {
            title: "Bank Asset Ratios",
            table: {
                columns: [],
                data: {}
            }
        }
    };

    Object.keys(data).map((queryResult) => {
        Object.keys(data[queryResult]).map((row) => {
            let dataRow = data[queryResult][row];
            let tab = dataRow.table.toLowerCase();
            let col_name = dataRow.periodtypename === 'Annual' ? 
                            `Yr ${dataRow.fiscalyear}` : 
                            `Q${dataRow.fiscalquarter} (${dataRow.fiscalyear})`;

            if (!tables[tab].table.data[dataRow.item]) tables[tab].table.data[dataRow.item] = {};
            tables[tab].table.data[dataRow.item][col_name] = dataRow.value ? Number(dataRow.value).toFixed(1).toLocaleString() : '-';

            if (col_name.indexOf('Q') > -1 && dataRow.value) {
                tables[tab].table.data[dataRow.item]['Peer Group Comparison'] = {
                    type: 'boxplot',
                    count: Number(dataRow[`${peerGroup}_peers`]),
                    rank: dataRow[`${peerGroup}_percent_rank`] ? Number(dataRow[`${peerGroup}_percent_rank`]) : undefined,
                    data: {
                        p10: Number(dataRow[`${peerGroup}_p10`]),
                        p25: Number(dataRow[`${peerGroup}_p25`]),
                        p50: Number(dataRow[`${peerGroup}_p50`]),
                        p75: Number(dataRow[`${peerGroup}_p75`]),
                        p90: Number(dataRow[`${peerGroup}_p90`])
                    }
                }
            }
        });
    });

    Object.keys(tables).forEach((tab_key) => {
        tables[tab_key].table.data = Object.keys(tables[tab_key].table.data).map(key => Object.assign({item: key}, tables[tab_key].table.data[key]));
        if (tables[tab_key].table.data.length > 0) {
            let most_columns_element_idx = longestArrayIndex(tables[tab_key].table.data);

            Object.keys(tables[tab_key].table.data[most_columns_element_idx]).map(key => tables[tab_key].table.columns.push({title: key, field: key}));
        }
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