'use strict';

const lambda = require('./shared/lambda');
const companyApi = require('./shared/company-api');

const handler = async (event, context) => {
    let companies = await companyApi.get(`/v1/companies${event.companyName ? `?companyName=${encodeURIComponent(event.companyName)}` : ''}`);
    if (companies) {
        return companies.data;
    } else {
        return [];
    }
};

exports.handler = async (event, context, callback) => {
    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }

    return await lambda.handler(event, context, handler);
};