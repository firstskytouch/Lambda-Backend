'use strict';

const lambda = require('./shared/lambda');
const privUtil = require('./shared/private-lib/util');
const companyApi = require('./shared/company-api');

const handler = async (event, context) => {
	console.log(JSON.stringify(event));
    let [
        ownerships,
    ] = await Promise.all([
        await companyApi.get(`/v1/companies/${event.companyId}/ownerships`),
    ]);

    if (!ownerships || ownerships.data.length === 0) {
        throw {
            statusCode: 404
        }
    }

    const currentYear = privUtil.getMaxYear(ownerships);
    const currYearData = privUtil.findByYear(ownerships.data, currentYear);

    if (!currYearData) {
        throw {
            statusCode: 404
        }
    }
    const table = {
        "columns": [
            {
                "tdClassName": "bold",
                "title": "Name",
                "field": "personName"
            },
            {
                "title": "Title",
                "field": "title"
            },
            // {
            //     "title": "In Role Since",
            //     "field": "roleSince"
            // },
            {
                "title": "Shares",
                "field": "shares"
            },
            {
                "title": "Board Rep",
                "field": "boardRep"
            }
        ],
        "data": ownerships.data
    }

    return {
    	ownerships: {
            table,
            asOf: ownerships.data[0].month ? `${ownerships.data[0].month}/${currentYear}` : currentYear

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