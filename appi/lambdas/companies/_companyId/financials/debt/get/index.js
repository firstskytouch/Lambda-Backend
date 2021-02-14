'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object
const lambda = require('./shared/lambda');

exports.convert = (data) => {
    let chart = {
        debt: [],
        cash_position: [],
        net_free_cash_flow: []
    };

    let contract_obl = {
        x: "",
        y: ""
    };


    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            let dataRow = data[queryResult][row];

            if (dataRow.item === '5+ Yrs') {
                contract_obl.x = 'Due, After 5 Yrs';
                contract_obl.y = Number(dataRow.value);
            } else {              
                chart[dataRow.section].push({
                    x: dataRow.item,
                    y: Number(dataRow.value)
                });
            }
        });
    });

    // add at the end of the chart
    if (contract_obl.x != "") {
        chart.debt.push(contract_obl);
    }

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