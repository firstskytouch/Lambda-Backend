'use strict';

const lambda = require('./shared/lambda');
const privUtil = require('./shared/private-lib/util');
const companyApi = require('./shared/company-api');

const handler = async (event, context) => {
    console.log(JSON.stringify(event));
    let [
        balanceSheets,
    ] = await Promise.all([
        await companyApi.get(`/v1/companies/${event.companyId}/balanceSheets`),
    ]);

    if (!balanceSheets || balanceSheets.data.length === 0) {
        throw {
            statusCode: 404
        }
    }

    const maxYear = privUtil.getMaxYear(balanceSheets);
    if (!maxYear) {
        throw {
            statusCode: 404
        }
    }

    const currYearData = privUtil.findByYear(balanceSheets.data, maxYear);
    const lastYearData = privUtil.findByYear(balanceSheets.data, maxYear - 1);

    if (!currYearData && !lastYearData) {
        throw {
            statusCode: 404
        }
    }

    const currentYearTitle = currYearData ? `${!currYearData.month ? '' : currYearData.month + '/'}${currYearData.year}` : 'N/A';
    const currentYearField = currYearData ? `${currYearData.month}/${currYearData.year}` : 'currentYear';

    const lastYearTitle = lastYearData ? `${!lastYearData.month ? '' : lastYearData && lastYearData.month + '/'}${lastYearData.year}` : 'N/A';
    const lastYearField = lastYearData ? `${lastYearData.month}/${lastYearData.year}` : 'lastYear';

    const balance = {
        "revenue": {
            "title": "Assets",
            "table": {
                "columns": [
                    {
                        "tdClassName": "bold",
                        "title": "Item",
                        "field": "item"
                    },
                    {
                        "title": currentYearTitle,
                        "field": currentYearField
                    },
                    lastYearData ? {
                        "title": lastYearTitle,
                        "field": lastYearField
                    } : null
                ].filter(n => n),
                "data": [
                    {
                        "item": "Cash & Equivalents",
                        [currentYearField]: currYearData.cashEquiv,
                        [lastYearField]: lastYearData && lastYearData.cashEquiv
                    },
                    {
                        "item": "Total Current Assets",
                        [currentYearField]: currYearData.totalCurrAssets,
                        [lastYearField]: lastYearData && lastYearData.totalCurrAssets
                    },
                    {
                        "className": "border-top-bold bold",
                        "item": "Total Assets",
                        [currentYearField]: currYearData.totalAssets,
                        [lastYearField]: lastYearData && lastYearData.totalAssets
                    }
                ]
            }
        },
        "operating": {
            "title": "Liabilitis",
            "table": {
                "columns": [
                    {
                        "tdClassName": "bold",
                        "title": "Item",
                        "field": "item"
                    },
                    {
                        "title": currentYearTitle,
                        "field": currentYearField
                    },
                    lastYearData ? {
                        "title": lastYearTitle,
                        "field": lastYearField
                    } : null
                ].filter(n => n),
                "data": [
                    {
                        "item": "Deferred revenue",
                        [currentYearField]: currYearData.deferredRevenue,
                        [lastYearField]: lastYearData && lastYearData.deferredRevenue
                    },
                    {
                        "className": "border-top-bold bold",
                        "item": "Total Current Liabilities",
                        [currentYearField]: currYearData.totalCurrLiabilities,
                        [lastYearField]: lastYearData && lastYearData.totalCurrLiabilities
                    },
                    {
                        "item": "Total Short Term Debt",
                        [currentYearField]: currYearData.shortTermDebt,
                        [lastYearField]: lastYearData && lastYearData.shortTermDebt
                    },
                    {
                        "item": "Total Long Term Debt",
                        [currentYearField]: currYearData.longTermDebt,
                        [lastYearField]: lastYearData && lastYearData.longTermDebt
                    },
                    {
                        "className": "border-top-bold bold",
                        "item": "Total Liabilities",
                        [currentYearField]: currYearData.totalLiabilities,
                        [lastYearField]: lastYearData && lastYearData.totalLiabilities
                    },
                    {
                        "item": "Retained Earnings",
                        [currentYearField]: currYearData.retainedEarnings,
                        [lastYearField]: lastYearData && lastYearData.retainedEarnings
                    },
                    {
                        "item": "Total Equity",
                        "className": "border-top-bold bold",
                        [currentYearField]: currYearData.totalEquity,
                        [lastYearField]: lastYearData && lastYearData.totalEquity
                    }
                ]
            }
        }
    }

    return {
        balance
    };
};

exports.handler = async (event, context) => {
    return await lambda.handler(event, context, handler);
};
