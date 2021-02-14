'use strict';

const dynamoMethods = require('./shared/dynamo.js');
const dynamoTable = process.env.predictionTable;
const keyName = 'companyid';
const lambda = require('./shared/lambda');
const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */

const arr = [
    'industry_narrow_size',
    'industry_broad_size',
    'sector_narrow_size',
    'sector_broad_size',
]

function getPeers(key, redshiftResult) {
    return redshiftResult.map((x) => {
        return {
            companyname: x.companyname,
            percentile: x[`${key}_p_rank`]
        }
    }).sort((a, b) => {
        return b.percentile - a.percentile;
    });
}

function calc1(data, obj, redshiftResult) {
    const key = obj.comparison;
    const relkey = obj.impact_delta;
    const response = {};
    for (const [index, a] of arr.entries()) {
        const result = redshiftResult[index]
        response[a] = {
            chart: key ? {
                p10: Math.round(data[`${key}_p10_${a}`] * 100) / 100,
                p25: Math.round(data[`${key}_p25_${a}`] * 100) / 100,
                p50: Math.round(data[`${key}_p50_${a}`] * 100) / 100,
                p75: Math.round(data[`${key}_p75_${a}`] * 100) / 100,
                p90: Math.round(data[`${key}_p90_${a}`] * 100) / 100,
                p_rank: Math.round(data[`${key}_p_rank_${a}`] * 100) / 100,
                min: Math.round(data[`${key}_min_${a}`] * 100) / 100,
                max: Math.round(data[`${key}_max_${a}`] * 100) / 100,
                actual: Math.round(data[`${key}`] * 100) / 100,
                count: data[`count_${a}`],
                peerGroups: getPeers(key, result)
            } : (obj.metric_name === 'Industry' ? data.industry_group : null),
            impact_delta: relkey ? (obj.metric_name === 'Industry' ? parseFloat(data[relkey]) : data[`${relkey}`] / data[`${relkey}_avg_${a}`]) : null
        }
    }
    return response;
}


const handler = async (event, context, callback) => {

    let query = JSON.parse(JSON.stringify(q));
    query.queries = query.queries.map(i => i.replace(/COMPANY_ID/g, event.companyId));

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const redshiftData = await redshift.query(event, query, creds);
    const dynamoData = await dynamoMethods.getItem(event.companyId, dynamoTable, keyName)

    let data;
    if (dynamoData !== undefined) {
        data = dynamoData;
    } else {
        throw {
            statusCode: 404
        }
    }

    if (data.missing) {
        throw {
            statusCode: 404
        }
    }
    if (data.model === 'ipo_yr2') {
        throw {
            statusCode: 404,
            errorMessage: 'Not available for this company,'
        }
    }

    const res = [
        {
            metric_name: 'Market Cap',
            subtitle: "Total Market Cap value of a company",
            impact_delta: 'rel_log_market_cap',
            comparison: 'market_cap'
        },
        {
            metric_name: 'Industry',
            subtitle: "Defined by S&P Global Industry Clasification System",
            impact_delta: 'rel_gics_sectors',
            comparison: null,
            type: 2
        },
        {
            metric_name: 'Restated Financials',
            subtitle: "Flags a company that has restated their financials in the past year",
            impact_delta: 'rel_cfra_earnings_decile',
            comparison: null,
        },
        {
            metric_name: 'M&A Rumors',
            subtitle: "Flags a company that has M&A rumors in the past year",
            impact_delta: 'rel_exec_ceo_chg',
            comparison: null,
        },
        {
            metric_name: 'Change in CEO',
            subtitle: "Flags a company that has had a change in CEO in the past year",
            impact_delta: 'rel_exec_ceo_chg',
            comparison: null,
        },
        {
            metric_name: 'Change in CFO',
            subtitle: "Flags a company that has had a change in CFO in the past year",
            impact_delta: 'rel_exec_ceo_chg',
            comparison: null,
        },
        {
            metric_name: 'Change in Board',
            subtitle: "Flags a company that has had a change in Board Members in the past year",
            impact_delta: 'rel_cfra_earnings_decile',
            comparison: null,
        },
        {
            metric_name: 'CFRA Earnings Score',
            subtitle: "Forensic Accounting Score",
            impact_delta: 'rel_cfra_earnings_decile',
            comparison: 'cfra_earnings_decile',
        },
        {
            metric_name: 'MSCI Overall Score',
            subtitle: "Combines Accounting and Governance scores from MSCI",
            impact_delta: 'rel_msci_agr_percentile_1yravg',
            comparison: 'msci_agr_percentile_1yravg',
        },
        {
            metric_name: 'MSCI Accounting Score',
            subtitle: "A score from MSCI on Accounting practices",
            impact_delta: 'rel_msci_agr_accounting_score_1yravg',
            comparison: 'msci_agr_accounting_score_1yravg',
        },
        {
            metric_name: 'MSCI Governance Score',
            subtitle: "A score from MSCI on Governance practices",
            impact_delta: 'rel_msci_agr_governance_score_1yravg',
            comparison: 'msci_agr_governance_score_1yravg',
        },
        {
            metric_name: 'Short Ratio',
            subtitle: "Percentage of shorted shares",
            impact_delta: 'rel_short_ratio_ui',
            comparison: 'short_ratio_ui',
        },
        {
            metric_name: 'Probability of Default Score',
            subtitle: "Probability of the company going bankrupt in the next 12 months from S&P",
            impact_delta: 'rel_log_pd',
            comparison: 'log_pd',
        }];

    const chart = res.map(x => {
        if (x.hidden && x.hidden === true) {
            return null;
        }
        return Object.assign({}, x, calc1(data, x, redshiftData));

    }).filter(n => n);

    return chart;
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};
