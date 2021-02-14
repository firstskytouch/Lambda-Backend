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

    console.log('data', data);

    if(!data || data.length < 1 || data[0].length < 1 || data[0][0].length < 1) {
        return [];
    }
    var cards = [];
    var categories = {};

    Object.keys(data).map(queryResult => {
        let rows = data[queryResult];
        if (rows[0].since && rows[0].category) {
            rows.forEach((row) => {
                categories[moment(row.since.toISOString().substr(0, 10)).format('MM/DD/YYYY')] = row.category;
            });
        } else {
            //reduce array to changes of 10% or higher
            for (var i = 0; i < rows.length - 2; i++) {
                let a = Number(rows[i].value);
                let b = Number(rows[i + 1].value);
                let value = (a - b) * 100 / b;

                if (value >= 10 || value <= -10) {
                    cards.push({
                        value: value.toFixed(2),
                        date: moment(rows[i].date.toISOString().substr(0, 10)).format('MM/DD/YYYY'),
                        text: '-',
                        is_negative: (value < 0)
                    });
                }
            }
        }
    });

    cards.forEach(card => {
        if (categories[card.date]) {
            card.text = categories[card.date];
        } else if ( categories[ moment(card.date).subtract(1, 'day').format('MM/DD/YYYY') ]) {
            card.text = categories[ moment(card.date).subtract(1, 'day').format('MM/DD/YYYY') ];
        } else {
            card.text = 'N/A';
        }
        // categories[card.date] ? categories[card.date] : 'N/A';
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