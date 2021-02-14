'use strict';

const lambda = require('./shared/lambda');
const companyApi = require('./shared/company-api');

const handler = async (event, context) => {

    delete event.user;

    if (event.state) {
        let states = await companyApi.get(`/v1/states?countryId=213`);
        if (states.states) {
            const findState = states.states.find(x => x.abbreviation === event.state);
            if (findState) {
                event.stateId = findState.stateId;
                event.countryId = findState.countryId;
            }
        }
        
    }
    
    let res = await companyApi.post(`/v1/companies`, event);
    return {
        // companies: [res],
        data : res,
    };
};

exports.handler = async (event, context, callback) => {
    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }

    return await lambda.handler(event, context, handler);
};