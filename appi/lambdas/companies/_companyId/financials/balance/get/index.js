'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object

const lambda = require('./shared/lambda');

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

const MAX_COL_COUNT = 3;

const removeExtraColumns = (array) => {
    if (array.length <= MAX_COL_COUNT + 1) {
        return array;
    }
    let retVal = [array[0]];
    
    let columns = array.slice(1, Math.max(array.length - MAX_COL_COUNT -1, 1) * -1);
    
    return retVal.concat(columns);
};


exports.convert =(data) => {
    const generateTable = () => {
        return {
            assets: {
                title: "Assets",
                table: {
                    columns: [],
                    data: {}
                }
            },
            liabilities: {
                title: "Liabilities",
                table: {
                    columns: [],
                    data: {}
                }
            },
            stockholder_equity: {
                title: "Stockholders' Equity",
                table: {
                    columns: [],
                    data: {}
                }
            },
            statutory_surplus: {
                title: "Statutory Surplus",
                table: {
                    columns: [],
                    data: {}
                }
            }
        };
    };

    const result = {
        annual : generateTable(),
        quarterly : generateTable(),
    };

    let subtotal_items = new Set();

    const annual = [];

    Object.keys(result).forEach(k => {
        const tables = result[k];
        let uniqueItemSet = [];
        Object.keys(data).map(queryResult => {
            const dataSubSet = data[queryResult]; 
            dataSubSet.map(dataRow => {
                const findItem = uniqueItemSet.find(x => x.item === dataRow.item);
                if(findItem === undefined) {
                    uniqueItemSet.push(dataRow);        
                }
            });

            uniqueItemSet.sort((a, b) => a.sortord - b.sortord).map(dataRow => {
                let tab = dataRow.table.toLowerCase();
                if (!tables[tab].table.data[dataRow.item]) tables[tab].table.data[dataRow.item] = {};
            });
        });
    });

    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            let dataRow = data[queryResult][row];
            let tab = dataRow.table.toLowerCase();
            let col_name = dataRow.periodenddate.toISOString().substr(0, 10);

            if (dataRow.subtotal_line && dataRow.subtotal_line === 'Y') {
                subtotal_items.add(dataRow.item);
            }

            let tables;
            if (dataRow.periodtypename === 'Annual') {
                tables = result.annual;
            } else if (dataRow.periodtypename === 'Quarterly') {
                tables = result.quarterly;
            }
            if (tables) {
                if (!tables[tab].table.data[dataRow.item]) tables[tab].table.data[dataRow.item] = {};
                tables[tab].table.data[dataRow.item][col_name] = dataRow.value ? Number(dataRow.value * 1000).toFixed().toLocaleString() : '-';
            } 
        });
    });
    
    Object.keys(result).forEach(k => {
        const tables = result[k];
        Object.keys(tables).forEach(tab_key => {
            tables[tab_key].table.data = Object.keys(tables[tab_key].table.data).map(key => {
                let has_subtotal_line = subtotal_items.has(key);
                return Object.assign({item: key, subtotal: has_subtotal_line}, tables[tab_key].table.data[key]);
            });
            if (tables[tab_key].table.data.length > 0) {
                let most_columns_element_idx = longestArrayIndex(tables[tab_key].table.data);

                Object.keys(tables[tab_key].table.data[most_columns_element_idx]).map(key => {
                    if (key != 'subtotal') {
                        tables[tab_key].table.columns.push({title: key, field: key});
                    }
                });
            }
            
            tables[tab_key].table.columns = removeExtraColumns(tables[tab_key].table.columns);
            console.log(tables[tab_key].table.columns);
        });
    });
    console.log(JSON.stringify(result));
    return result;
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
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }

    let query = JSON.parse(JSON.stringify( q ));

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const data = await redshift.query(event, query, creds);
    
    if(!data || data.length < 1 || data[0].length < 1 || data[0][0].length < 1) {
        throw {
            statusCode: 404            
        }
    }

    const result = exports.convert(data);
    
    return result;
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};