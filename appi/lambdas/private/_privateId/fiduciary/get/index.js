'use strict';

const lambda = require('./shared/lambda');
const privUtil = require('./shared/private-lib/util');
const companyApi = require('./shared/company-api');

const handler = async (event, context) => {
	console.log(JSON.stringify(event));
    let [
        fiduciaryResult,
    ] = await Promise.all([
        await companyApi.get(`/v1/companies/${event.companyId}/fiduciaries`),
    ]);

    if (!fiduciaryResult || fiduciaryResult.data.length === 0) {
        throw {
            statusCode: 404
        }
    }

    const table = {
        "columns": [
            {
                "title": "Plan Name",
                "tdClassName": "bold",
                "field": "planName"
            },
            {
                "title": "Type of Plan",
                "field": "planType"
            },
            {
                "title": "Plan Number",
                "field": "planNumber"
            },
            {
                "title": "Number of Participants",
                "field": "participants"
            },
            {
                "title": "Market Value of Plan Assets",
                "field": "marketValue"
            },
            {
                "title": "Plan Status",
                "field": "planStatus"
            }
        ],
        "data": fiduciaryResult.data
    }

    return {
    	fiduciaries: {
            table
        }
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