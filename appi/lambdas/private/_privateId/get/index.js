'use strict';

const lambda = require('./shared/lambda');
const companyApi = require('./shared/company-api');
const privUtil = require('./shared/private-lib/util');

const checkHasNull = (target, keys) => {
    for (var member in target) {
        if (member.indexOf(keys) !== -1 && target[member] == null)
            return true;
    }
    return false;
}

const handler = async (event, context) => {
    let [
        company,
        balanceSheets,
        incomeStatements
    ] = await Promise.all([
        await companyApi.get(`/v1/companies/${event.companyId}`),
        await companyApi.get(`/v1/companies/${event.companyId}/balanceSheets`),
        await companyApi.get(`/v1/companies/${event.companyId}/incomeStatements`),
    ]);

    let zScore = 'N/A';
    let totalRevenue = 'N/A';
    let totalRevenueYear = 'N/A';

    if (balanceSheets.data && incomeStatements.data) {
        const balanceSheet = privUtil.getMaxYearRecord(balanceSheets);
        const incomeStatement = privUtil.getMaxYearRecord(incomeStatements);
        if (balanceSheet && incomeStatement && (balanceSheet.year === incomeStatement.year)) {

            let hasNull = checkHasNull(balanceSheet, ['totalCurrAssets', 'totalAssets', 'totalCurrLiabilities', 'totalLiabilities', 'retainedEarnings']);
            if (!hasNull) {
                hasNull = checkHasNull(incomeStatement, ['operatingIncome']);
            }

            if (!hasNull) {
                const workingCapital = balanceSheet.totalCurrAssets - balanceSheet.totalCurrLiabilities;
                const bookValue = balanceSheet.totalAssets - balanceSheet.totalLiabilities;

                const value1 = workingCapital / balanceSheet.totalAssets * 6.56;
                const value2 = balanceSheet.retainedEarnings / balanceSheet.totalAssets * 3.26;
                const value3 = incomeStatement.operatingIncome / balanceSheet.totalAssets * 6.72;
                const value4 = bookValue / balanceSheet.totalLiabilities * 1.05;
                zScore = Math.round((value1 + value2 + value3 + value4) * 100) / 100;
            }
        }

        if (incomeStatement) {
            totalRevenue = incomeStatement.totalRevenue;
            totalRevenueYear = incomeStatement.year;
        }
    }


    if (company.data) {
        company.data.zScore = zScore;
        company.data.totalRevenue = totalRevenue;
        company.data.totalRevenueYear = totalRevenueYear;
        return company.data;
    } else {
        throw {
            statusCode: 404
        }
    }
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};