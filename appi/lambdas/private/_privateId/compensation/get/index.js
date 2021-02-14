'use strict';

const lambda = require('./shared/lambda');
const axios = require('axios');

const handler = async (event, context) => {
	console.log(JSON.stringify(event));
    let res = await axios.get(`${process.env.COMPANY_API_URL}/companies/${event.companyId}/compensations`);
    return {
    	compensation: res
    };
};

exports.handler = async (event, context) => {
    return await lambda.handler(event, context, handler);
};
