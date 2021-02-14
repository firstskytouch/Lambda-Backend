'use strict';
const dynamoMethods = require('./shared/dynamo.js');
const dynamoTable = process.env.predictionTable;
const keyName = 'companyid';
const lambda = require('./shared/lambda');

const thousandsSeparators = (val) => {
    let parts = val.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts[0];
};

const convertToBigNumber = (value) => {
    if (typeof value === 'number') {
        if (value > 1000000000000) {
            value = Math.round(value / 1000000000000) + 'T';
        } else if (value > 1000000000) {
            value = Math.round(value / 1000000000) + 'B';
        } else if (value > 1000000) {
            value = Math.round(value / 1000000) + 'M';
        } else if (value > 1000) {
            value = Math.round(value / 1000) + 'K';
        }
    }
    return value;
};


const scaModel = (res) => {
    let response = {
        attachment_points_table: {
            columns: [
                {
                    title: "Item",
                    field: "item"
                },
                {
                    title: "Company",
                    field: "company"
                },
                {
                    title: "Broad Sector-Size Group",
                    field: "data4",
                    tooltip: 'The universe of north american public companies is broken down into 12 Sector groups and 4 Broad size groups. Sectors are broken down into 42 Industries. Broad size groups are broken down into 10 narrow size groups. The Broad Sector-Size Group is comprised of companies from the same Sector, in the broad size group.'
                },
                {
                    title: "Narrow Sector-Size Group",
                    field: "data3",
                    tooltip: 'The universe of north american public companies is broken down into 12 Sector groups and 4 Broad size groups. Sectors are broken down into 42 Industries. Broad size groups are broken down into 10 narrow size groups. The Narrow Sector-Size Group is comprised of companies from the same Sector, in the narrow size group.'
                },
                {
                    title: "Broad Industry-Size Group",
                    field: "data2",
                    tooltip: 'The universe of north american public companies is broken down into 12 Sector groups and 4 Broad size groups. Sectors are broken down into 42 Industries. Broad size groups are broken down into 10 narrow size groups. The Broad Industry-Size Group is comprised of companies from the same Industry, in the broad size group.'
                },
                {
                    title: "Narrow Industry-Size Group",
                    field: "data1",
                    tooltip: 'The universe of north american public companies is broken down into 12 Sector groups and 4 Broad size groups. Sectors are broken down into 42 Industries. Broad size groups are broken down into 10 narrow size groups. The Narrow Industry-Size Group is comprised of companies from the same Industry, in the narrow size group.'
                },
                {
                    title: "Public Companies",
                    field: "data5",
                    // tooltip: 'The universe of north american public companies is broken down into 12 Sector groups and 4 Broad size groups. Sectors are broken down into 42 Industries. Broad size groups are broken down into 10 narrow size groups. The Narrow Industry-Size Group is comprised of companies from the same Industry, in the narrow size group.'
                }
            ],
            data: []
        },
        settlement_probabilities_table: {
            columns: [
                {
                    title: "Item",
                    field: "item"
                },
                {
                    title: "Company",
                    field: "company"
                },
                {
                    title: "Broad Sector-Size Group",
                    field: "data4"
                },
                {
                    title: "Narrow Sector-Size Group",
                    field: "data3"
                },
                {
                    title: "Broad Industry-Size Group",
                    field: "data2"
                },
                {
                    title: "Narrow Industry-Size Group",
                    field: "data1"
                },
                {
                    title: "Public Companies",
                    field: "data5"
                }
            ],
            data: []
        }
    }



    const attachment_points_data = [
        {
            item: "Company",
            company: 1,
            data1: res.count_industry_narrow_size,
            data2: res.count_industry_broad_size,
            data3: res.count_sector_narrow_size,
            data4: res.count_sector_broad_size,
            data5: res.count_public_companies,
        },
        {
            item: "SCA Filing Probability",
            company: `${(res.claim_rate * 100).toFixed(1)}%`,
            data1: `${(res.claim_rate_avg_industry_narrow_size * 100).toFixed(1)}%`,
            data2: `${(res.claim_rate_avg_industry_broad_size * 100).toFixed(1)}%`,
            data3: `${(res.claim_rate_avg_sector_narrow_size * 100).toFixed(1)}%`,
            data4: `${(res.claim_rate_avg_sector_broad_size * 100).toFixed(1)}%`,
            data5: `${(res.claim_rate_avg_public_companies * 100).toFixed(1)}%`,
        },
        {
            item: "Dismissal Probability",
            company: `${(res.dism_rate * 100).toFixed(1)}%`,
            data1: `${(res.dism_rate_avg_industry_narrow_size * 100).toFixed(1)}%`,
            data2: `${(res.dism_rate_avg_industry_broad_size * 100).toFixed(1)}%`,
            data3: `${(res.dism_rate_avg_sector_narrow_size * 100).toFixed(1)}%`,
            data4: `${(res.dism_rate_avg_sector_broad_size * 100).toFixed(1)}%`,
            data5: `${(res.dism_rate_avg_public_companies * 100).toFixed(1)}%`,
        },
        {
            item: "Predicted Settlement",
            company: `$${thousandsSeparators(res.mu)}`,
            data1: `$${thousandsSeparators(res.mu_avg_industry_narrow_size)}`,
            data2: `$${thousandsSeparators(res.mu_avg_industry_broad_size)}`,
            data3: `$${thousandsSeparators(res.mu_avg_sector_narrow_size)}`,
            data4: `$${thousandsSeparators(res.mu_avg_sector_broad_size)}`,
            data5: `$${thousandsSeparators(res.mu_avg_public_companies)}`,
        }
    ];

    response.attachment_points_table.data = attachment_points_data;

    let settlement_probabilities_data = [];

    for (let i = 0; i <= 500; i++) {
        if (i > 20 && i % 5 !== 0) {
            continue;
        }
        if (i > 100 && i % 10 !== 0) {
            continue;
        }
        let itemName = `$${i} M`;
        if (i === 0) {
            itemName = 'Primary';
        } else if (i === 1) {
            itemName = `$${i} M`;
        } else if (i === 3) {
            itemName = `$${i} M`;
        }

        if (res[`attach_prob${i}`] !== undefined) {
            settlement_probabilities_data.push(
                {
                    item: itemName,
                    company: res[`attach_prob${i}`],
                    data1: res[`attach_prob_industry_narrow_size${i}`],
                    data2: res[`attach_prob_industry_broad_size${i}`],
                    data3: res[`attach_prob_sector_narrow_size${i}`],
                    data4: res[`attach_prob_sector_broad_size${i}`],
                    data5: res[`attach_prob_public_companies${i}`],
                }
            );
        }
    }
    response.settlement_probabilities_table.data = settlement_probabilities_data;
    return response;
}

const ipo2yr = (res) => {
    let response = {
        attachment_points_table: {
            columns: [
                {
                    title: "Item",
                    field: "item"
                },
                {
                    title: "Company",
                    field: "company"
                }
            ],
            data: []
        },
        settlement_probabilities_table: {
            columns: [
                {
                    title: "Item",
                    field: "item"
                },
                {
                    title: "Company",
                    field: "company"
                }
            ],
            data: []
        }
    }



    const attachment_points_data = [
        {
            item: "Company",
            company: 1,
        },
        {
            item: "SCA & non-SCA Combined Filing Probability",
            company: `${(res.adjusted_claim_rate_yr2 * 100).toFixed(1)}%`,
        },
        {
            item: "Dismissal Probability",
            company: `${(res.dism_rate_poisson_final * 100).toFixed(1)}%`,
        },
        {
            item: "Predicted Settlement",
            company: `$${thousandsSeparators(res.mu_yr2)}`,
        }
    ];

    response.attachment_points_table.data = attachment_points_data;

    let settlement_probabilities_data = [];

    for (let i = 0; i <= 500; i++) {
        if (i > 20 && i % 5 !== 0) {
            continue;
        }
        if (i > 100 && i % 10 !== 0) {
            continue;
        }
        let itemName = `$${i} M`;
        if (i === 0) {
            itemName = 'Primary';
        } else if (i === 1) {
            itemName = `$${i} M`;
        } else if (i === 3) {
            itemName = `$${i} M`;
        }

        if (res[`attach_prob${i}`] !== undefined) {
            settlement_probabilities_data.push(
                {
                    item: itemName,
                    company: res[`attach_prob${i}`]
                }
            );
        }
    }
    response.settlement_probabilities_table.data = settlement_probabilities_data;
    return response;
}

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context, callback) => {

    // let query = JSON.parse(JSON.stringify( q ));

    // console.log(event.companyId, dynamoTable, keyName);
    const res = await dynamoMethods.getItem(event.companyId, dynamoTable, keyName)
        .then((res) => {
            return res;
        });

    if (!res) {
        throw {
            statusCode: 404
        }
    } else if (res.missing) {
        throw {
            statusCode: 404
        }
    }

    let data = null;
    if (res.model === 'ipo_yr2') {
        data = ipo2yr(res);
    } else {
        res.model = 'sca';
        data = scaModel(res);
    }
    data.model = res.model;
    return data;
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};