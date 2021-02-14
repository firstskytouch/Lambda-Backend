'use strict';

const lambda = require('./shared/lambda');
const privUtil = require('./shared/private-lib/util');
const companyApi = require('./shared/company-api');

const handler = async (event, context) => {
	console.log(JSON.stringify(event));
    let [
        cashflows,
    ] = await Promise.all([
        await companyApi.get(`/v1/companies/${event.companyId}/cashFlows`),
    ]);

    if (!cashflows || cashflows.data.length === 0) {
        throw {
            statusCode: 404
        }
    }

    const maxYear = privUtil.getMaxYear(cashflows);
    if (!maxYear) {
        throw {
            statusCode: 404
        }
    }

    const currYearData = privUtil.findByYear(cashflows.data, maxYear);
    const lastYearData = privUtil.findByYear(cashflows.data, maxYear - 1);

    if (!currYearData && !lastYearData) {
        throw {
            statusCode: 404
        }
    }

    const currentYearTitle = currYearData ? `${!currYearData.month ? '' : currYearData.month + '/'}${currYearData.year}` : 'N/A';
    const currentYearField = currYearData ? `${currYearData.month}/${currYearData.year}` : 'currentYear';

    const lastYearTitle = lastYearData ? `${!lastYearData.month ? '' : lastYearData && lastYearData.month + '/'}${lastYearData.year}` : 'N/A';
    const lastYearField = lastYearData ? `${lastYearData.month}/${lastYearData.year}` : 'lastYear';

    const cash = {
        "operations": {
            "title": "Cash from Operations",
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
                        "item": "Cash flow from operations",
                        [currentYearField]: currYearData.cashFlowOps,
                        [lastYearField]: lastYearData && lastYearData.cashFlowOps
                    },
                    {
                        "item": "Cash flow from investments",
                        [currentYearField]: currYearData.cashFlowInv,
                        [lastYearField]: lastYearData && lastYearData.cashFlowInv
                    },
                    {
                        "item": "Cash flow from financing",
                        [currentYearField]: currYearData.cashFlowFin,
                        [lastYearField]: lastYearData && lastYearData.cashFlowFin
                    },
                    {
                        "item": "Net increase (decrease) in cash and cash equivalents",
                        [currentYearField]: currYearData.newChangeCash,
                        [lastYearField]: lastYearData && lastYearData.newChangeCash
                    }
                ]
            }
        }
    }

    return {
    	cash
    };
};

exports.handler = async (event, context) => {
    return await lambda.handler(event, context, handler);
};
