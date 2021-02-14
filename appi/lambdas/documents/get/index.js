'use strict';

const lambda = require('./shared/lambda');
const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`,
    log: 'info'
});

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

    const esType = event.documentType;
    const esIndex = `${stage}.sca`;
    const date = 'filing_date';

    let options;

    let sort = [
        {
            [date]: { order: 'desc' }
        }
    ];

    const array = JSON.parse("[" + event.mscads + "]");

    const esMatch = {
        bool: {
            must: [
              {
                "constant_score" : {
                    "filter" : {
                        "terms" : { 
                            "mscad_id" : array
                        }
                    }
                }
              }
            ]
        }
    };

    const result = await esClient.search({ 
        index: esIndex, 
        type: esType, 
        size: 100,
        body: {
            query: esMatch,
            sort: sort
        } 
    });

    if(!result || !result.hits  || result.hits.hits.length < 1) {
        throw {
            statusCode: 404            
        };
    }

    const table = {
        columns: [
            {
                title: "MSCAD ID",
                field: "mscad_id"
            },
            {
                title: "File Name",
                field: "filename"
            },
            {
                title: "Company Name",
                field: "company_name"
            },
            {
                title: "Case Type",
                field: "risks"
            },
            {
                title: "Filing Date",
                field: "filing_date"
            },
            {
                title: "Case Status",
                field: "casestatus"
            },{
                title: "Total Amount",
                field: "total_amount"
            },
        ],
        data: []
    };

    for(let dataRow of result.hits.hits) {
        let company_id = dataRow._source.company_id;
        try {
            company_id = company_id.toString();
            while(company_id.length < 10) {
                company_id = "0" + company_id;
            }
        } catch (e) {

        }

        if (table.data.find(x => (x.mscad_id === dataRow._source.mscad_id && x.filename === dataRow._source.filename) ) !== undefined) {
            continue;
        }
        
        table.data.push({
            mscad_id: dataRow._source.mscad_id,
            filename: dataRow._source.filename,
            company_name: dataRow._source.company_name,
            filing_date: dataRow._source.filing_date,
            casestatus: dataRow._source.casestatus,
            total_amount: dataRow._source.total_amount,
            document_id: dataRow._id,
            company_id:  company_id,
            risks: [
                {
                    riskName: "International",
                    riskFlag: dataRow._source.international ? true : false
                },
                {
                    riskName: "Investment",
                    riskFlag: dataRow._source.investment ? true : false
                },
                {
                    riskName: "Investment Banking",
                    riskFlag: dataRow._source.investment_banking ? true : false
                },
                {
                    riskName: "SCA",
                    riskFlag: dataRow._source.main_sca ? true : false
                },
                {
                    riskName: "A Side",
                    riskFlag: dataRow._source.main_a_side ? true : false
                },
                {
                    riskName: "SEC Investigation",
                    riskFlag: dataRow._source.sec_complaint ? true : false
                }
            ],
            // filename: dataRow.filename,
            // filename: dataRow.filename,
            // date_reported: dataRow.date_reported,
        });
    }
    
    return {
        result: result.hits.hits,
        table: table
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