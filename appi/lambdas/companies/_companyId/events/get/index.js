'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object
const moment = require('moment');
const mapping = require('./mapping.json');
const lambda = require('./shared/lambda');

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async(event, context, callback) => {

    let query = JSON.parse(JSON.stringify( q ));

    const filters = event.filters;
    const startDate = event.startDate;
    const endDate = event.endDate;

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const data = await redshift.query(event, query, creds);

    console.log('data', data);

    if(!data || data.length < 1 || data[0].length < 1 || data[0][0].length < 1) {
        return {};
    }

    const event_list = [];

    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            let dataRow = data[queryResult][row];
            event_list.push({
                title: dataRow.title,
                since: moment(dataRow.since.toISOString().substr(0, 10)).format('MMM Do, YYYY'),
                excerpt: dataRow.excerpt,
                category: dataRow.category,
                groupCategory: mapping[dataRow.category] !== undefined ? mapping[dataRow.category] : 'Others',
                date: dataRow.since.toISOString().substr(0, 10)
            });
        });
    });

    if (startDate && endDate) {
        let filter_event_list = event_list.filter((obj, pos) => {
            return obj.date >= startDate && obj.date <= endDate;
        });

        return filter_event_list;
    } else {
        return event_list;
    }
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};