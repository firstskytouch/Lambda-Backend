'use strict';

const lambda = require('./shared/lambda');
const axios = require('axios');

const handler = async (event, context) => {
	console.log(JSON.stringify(event));
    let res = await axios.get(`${process.env.COMPANY_API_URL}/companies/${event.companyId}`);
    return {
    	companies: [res]
    };
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};
