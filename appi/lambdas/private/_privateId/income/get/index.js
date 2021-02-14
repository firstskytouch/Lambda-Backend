'use strict';

const lambda = require('./shared/lambda');
const privUtil = require('./shared/private-lib/util');
const companyApi = require('./shared/company-api');

const handler = async (event, context) => {
	console.log(JSON.stringify(event));
    let [
        incomeStatements,
    ] = await Promise.all([
        await companyApi.get(`/v1/companies/${event.companyId}/incomeStatements`),
    ]);

    if (!incomeStatements || incomeStatements.data.length === 0) {
        throw {
            statusCode: 404
        }
    }

    const maxYear = privUtil.getMaxYear(incomeStatements);
    if (!maxYear) {
        throw {
            statusCode: 404
        }
    }

    const currYearData = privUtil.findByYear(incomeStatements.data, maxYear);
    const lastYearData = privUtil.findByYear(incomeStatements.data, maxYear - 1);

    if (!currYearData && !lastYearData) {
        throw {
            statusCode: 404
        }
    }


    const currentYearTitle = currYearData ? `${!currYearData.month ? '' : currYearData.month + '/'}${currYearData.year}` : 'N/A';
    const currentYearField = currYearData ? `${currYearData.month}/${currYearData.year}` : 'currentYear';

    const lastYearTitle = lastYearData ? `${!lastYearData.month ? '' : lastYearData && lastYearData.month + '/'}${lastYearData.year}` : null;
    const lastYearField = lastYearData ? `${lastYearData.month}/${lastYearData.year}` : 'lastYear';

    const income =  {
        "revenue": {
            "title": "Revenue",
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
                ].filter(x => x),
                "data": [
                    {
                        "item": "Total revenue/sales",
                        [currentYearField]: currYearData.totalRevenue,
                        [lastYearField]: lastYearData && lastYearData.totalRevenue
                    },
                    {
                        "item": "Cost of goods sold/cost of sales",
                        [currentYearField]: currYearData.costOfSales,
                        [lastYearField]: lastYearData && lastYearData.costOfSales
                    },
                    {
                        "className": "border-top-bold bold",
                        "item": "Gross Profit",
                        [currentYearField]: currYearData.grossProfie,
                        [lastYearField]: lastYearData && lastYearData.grossProfie
                    }
                ]
            }
        },
        "operating": {
            "title": "Operating Expenses",
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
                ].filter(x => x),
                "data": [
                    {
                        "item": "Amortization and depreciation",
                        [currentYearField]: currYearData.amortDepreciation,
                        [lastYearField]: lastYearData && lastYearData.amortDepreciation
                    },
                    {
                        "item": "Total operating expenses",
                        [currentYearField]: currYearData.totalOpExpenses,
                        [lastYearField]: lastYearData && lastYearData.totalOpExpenses
                    }
                ]
            }
        },
        "income": {
            "title": "Other Income (Expense)",
            "table": {
                "columns": [
                    {
                        "tdClassName": "bold",
                        "field": "item",
                        "item": "Total Revenue"
                    },
                    {
                        "title": currentYearTitle,
                        "field": currentYearField
                    },
                    lastYearData ? {
                        "title": lastYearTitle,
                        "field": lastYearField
                    } : null
                ].filter(x => x),
                "data": [
                    {
                        "item": "Net interest expense/income",
                        [currentYearField]: currYearData.operatingIncome,
                        [lastYearField]: lastYearData && lastYearData.operatingIncome
                    },
                    {
                        "className": "border-top-bold bold",
                        "item": "Net Income (loss)",
                        [currentYearField]: currYearData.interestExpIncome,
                        [lastYearField]: lastYearData && lastYearData.interestExpIncome
                    },
                    {
                        "item": "Net income/loss attributable to non-controlling interests",
                        [currentYearField]: currYearData.nonCtrlInterests,
                        [lastYearField]: lastYearData && lastYearData.nonCtrlInterests
                    },
                    {
                        "className": "border-top-bold bold",
                        "item": "Net comprehensive income (loss)",
                        [currentYearField]: currYearData.netCompIncome,
                        [lastYearField]: lastYearData && lastYearData.netCompIncome
                    }
                ]
            }
        }
    }

    return {
    	income
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