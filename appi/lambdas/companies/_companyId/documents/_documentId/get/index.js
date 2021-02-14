'use strict';

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    signatureVersion: 'v4'
});

const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`,
    log: 'info'
});

const lambda = require('./shared/lambda');
const stage = process.env.stage;

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context, callback) => {

    if (!event.documentId) {
        console.log('Request does not have an id.');
        const errObj = { 
            statusCode: 400,
            errorMessage: 'Request does not have an id.'
        }
        throw  errObj;
    }

    if (!event.documentType) {
        console.log('Request does not have a search type.');
        const errObj = { 
            statusCode: 400,
            errorMessage: 'Request does not have a search type.'
        }
        throw  errObj;
    }

    const docType = event.documentType;
    const esIndex = docType === 'Complaint' ? `${stage}.sca` : `${stage}.sec`;
    const body = {
        query: {
            bool: {
                must: [
                    {
                        match: {
                            _id: event.documentId
                        }
                    }
                ]
            }
        },
        size: 1
    };

    if (docType != 'Complaint') {
        body.query.bool.must.push({
            match: {
                conformed_submission_type: docType === 'Proxy' ? 'DEF 14A' : docType
            }
        });
    }

    const response = await esClient.search({ 
        index: esIndex, 
        body: body
    })
    .then(result => {
        const results = result.hits.hits.map((h) => {
            return (docType === 'Complaint') ? h._source.batchdate + '/' +  h._source.attachment_name : h._source.file_name;
        });
        
        var params = {
            Bucket: (docType === 'Complaint') ? process.env.scaBucket : process.env.secBucket,
            Key: results[0]
        };
       
        return { 
            url: s3.getSignedUrl('getObject', params) 
        }
    })
    .catch(err => {
        console.log(err, err.stack);
        const errObj = { 
            statusCode: 400,
            url: "There was a problem getting your file."
        }
        throw  errObj;
    });
    return response;
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};