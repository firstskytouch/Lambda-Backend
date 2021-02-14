'use strict';

const lambda = require('./shared/lambda');
const balancesheetsMapping = require('./shared/privMappings/balancesheets.json');
const cashflowMapping = require('./shared/privMappings/cashflow.json');
const compensationMapping = require('./shared/privMappings/compensation.json');
const employmentMapping = require('./shared/privMappings/employment.json');
const fiduciaryMapping = require('./shared/privMappings/fiduciary.json');
const incomestatementMapping = require('./shared/privMappings/incomestatement.json');
const jurisdictionMapping = require('./shared/privMappings/jurisdiction.json');
const ownershipMapping = require('./shared/privMappings/ownership.json');
const lossMapping = require('./shared/privMappings/loss.json');
const companyApi = require('./shared/company-api');

const filterByYear = (year, res) => {
    const rows = res.data;
    if (rows === null) {
        return [];
    }
    return rows.filter(x => x.year >= year);
}

const handler = async (event, context) => {

    if (event.year === undefined ) {
        throw {
            statusCode: 400
        }
    }
    let [
        balanceSheetsHistory,
        cashFlowsHistory,
        compensationHistory,
        employmentsHistory,
        incomeStatementsHistory,
        fiduciaryHistory,
        ownershipHistory,
        jurisdictionsHistory,
        lossHistory,
        compensationDataItems,
        states,
    ] = await Promise.all([
        await companyApi.get(`/v1/companies/${event.companyId}/balanceSheets`),
        await companyApi.get(`/v1/companies/${event.companyId}/cashFlows`),
        await companyApi.get(`/v1/companies/${event.companyId}/compensations`),
        await companyApi.get(`/v1/companies/${event.companyId}/employments`),
        await companyApi.get(`/v1/companies/${event.companyId}/incomeStatements`),
        await companyApi.get(`/v1/companies/${event.companyId}/fiduciaries`),
        await companyApi.get(`/v1/companies/${event.companyId}/ownerships`),
        await companyApi.get(`/v1/companies/${event.companyId}/jurisdictions`),
        await companyApi.get(`/v1/companies/${event.companyId}/losses`),
        await companyApi.get(`/v1/compensationDataItems`),
        await companyApi.get(`/v1/states?countryId=213`),
    ]);

    const dt = new Date();
    const currentYear = event.year ? Number(event.year) : dt.getFullYear();

    // this year + last year: Need to update the past 2 years of records
    const balanceSheets = filterByYear(currentYear, balanceSheetsHistory);
    const cashFlows = filterByYear(currentYear, cashFlowsHistory);
    const employments = filterByYear(currentYear, employmentsHistory);
    const incomeStatements = filterByYear(currentYear, incomeStatementsHistory);

    // this year
    const compensations = filterByYear(currentYear, compensationHistory);
    const fiduciaries = filterByYear(currentYear, fiduciaryHistory);
    const ownerships = filterByYear(currentYear, ownershipHistory);
    const jurisdictions = filterByYear(currentYear, jurisdictionsHistory);
    const losses = filterByYear(currentYear, lossHistory);

    
    jurisdictionMapping.state = states.data;
    const ju = convert(jurisdictionMapping, jurisdictions, currentYear);

    const bs = convert(balancesheetsMapping, balanceSheets, currentYear);
    // cash flow
    const cf = convert(cashflowMapping, cashFlows, currentYear);

    // compensation
    compensationMapping.compensationDataItem = compensationDataItems.data;
    const co = convert(compensationMapping, compensations, currentYear);
    const em = convert(employmentMapping, employments, currentYear);
    
    const fi = convert(fiduciaryMapping, fiduciaries, currentYear);
    
   
    const ow = convert(ownershipMapping, ownerships, currentYear);
    const ls = convert(lossMapping, losses, currentYear);

    // income statements
    const is = convert(incomestatementMapping, incomeStatements, currentYear);

    return {
        balanceSheets: bs,
        cashFlow: cf,
        compensations: co,
        employments: em,
        incomeStatements: is,
        fiduciaries: fi,
        ownerships: ow,
        jurisdictions: ju,
        loss: ls,
        config: {
            tableWithRowHeaders: ['PROE8', 'PROE9', 'PROE10', 'PROB3', 'PROC3', 'PROI3'],
            stateDropDown: [{questionId: 'PROE9', index: 0}]
        }
    }

};

const convert = (mapping, history, currentYear, lastYear) => {
    
    let res = {};
    let currYearRecord;
    let lastYearRecord;

    let currYearRecords = history.filter(x => x.year === currentYear);
    let lastYearRecords;
    if (lastYear) {
        lastYearRecords = history.filter(x => x.year === lastYear);
    }
    
    if (currYearRecords.length === 0 && (lastYearRecord === undefined || lastYearRecord.length === 0)) {
        return undefined;
    }
    if (currYearRecords.length === 0) {
        currYearRecord = {};
    } else {
        currYearRecord = currYearRecords[0];
    }
    if (lastYear && lastYearRecords.length > 0) {
        lastYearRecord = lastYearRecords[0];
    } else if (lastYear) {
        lastYearRecord  = {}
    }

    Object.keys(currYearRecord).forEach(key => {
        // find question key by table field name.
        let findKey = Object.keys(mapping).find(
            k => mapping[k] === key 
                || (
                    Array.isArray(mapping[k]) && mapping[k].findIndex(y => y === key) !== -1
                    )
        );

        if (!findKey) { // Table
            let found = false;
            let keysIndex = null;
            let questionKey = null;
            let hasRowHeader = false;
            let typeRow = false;
            let typeDynamicTable = false;
            
            Object.keys(mapping).forEach(k => {
                if (k.indexOf("PRO") === 0) {
                    if (!Array.isArray(mapping[k]) && typeof mapping[k] == 'object') {
                        let findIndex = mapping[k].keys.findIndex(x => x === key);
                        if (findIndex === -1) {
                            if (mapping[k].convert) {
                                const convKey = mapping[k].convert.find(x => x.from === key);
                                if (convKey) {
                                    findIndex = mapping[k].keys.findIndex(x => x === convKey.to);
                                    if (findIndex !== -1) {
                                        for (let i = 0; i < currYearRecords.length; i++){
                                            const convertData = mapping[convKey.table];
                                            const findConvertedData = convertData.find(x => x[convKey.from] === currYearRecords[i][key]);
                                            if (findConvertedData) {
                                                currYearRecords[i][key] = findConvertedData[convKey.to];
                                            }
                                        }
                                        if (lastYearRecords) {
                                            for (let i = 0; i < lastYearRecords.length; i++){
                                                const convertData = mapping[convKey.table];
                                                const findConvertedData = convertData.find(x => x[convKey.from] === lastYearRecords[i][key]);
                                                if (findConvertedData) {
                                                    lastYearRecords[i][key] = findConvertedData[convKey.to];
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (findIndex !== -1) {
                            found = true;
                            keysIndex = findIndex;
                            questionKey = k;
                            hasRowHeader = mapping[k].rowHeader === true ? true : false;
                            typeRow = mapping[k].type === 'row' ? true : false;
                            typeDynamicTable = mapping[k].type === 'dynamicTable' ? true : false;
                        }
                    }
                }
            });
            if (found) {
                
                if (!res[questionKey]){
                    res[questionKey] = {};
                    res[questionKey].answer = [];
                }
                let startIndex = 0;
                if (typeRow === true || typeDynamicTable === true) {
                    if (!res[questionKey].answer) {
                        res[questionKey].answer = [];
                    }
                    for (let i = 0; i < currYearRecords.length; i++){
                        if (!res[questionKey].answer[i]) {
                            res[questionKey].answer[i] = [];
                        }
                        
                        res[questionKey].answer[i][keysIndex] = currYearRecords[i][key] || '';
                    }
                } else {
                    if (hasRowHeader === true) {
                        if (!res[questionKey].answer[keysIndex]) {
                            res[questionKey].answer[keysIndex] = [];
                        }
                        res[questionKey].answer[keysIndex][0] = ''; 
                        startIndex++;
                    }
                    if (!res[questionKey].answer[keysIndex]) {
                        res[questionKey].answer[keysIndex] = [];
                    }
                    res[questionKey].answer[keysIndex][startIndex] = currYearRecord[key] || '';
                    if (lastYear) {
                        res[questionKey].answer[keysIndex][startIndex + 1] = lastYearRecord[key] || '';
                    }
                }
            }
        } else {
            if (!res[findKey]) {
                res[findKey] = {};
            }
            if (Array.isArray(mapping[findKey])) {
                console.log(currYearRecord[mapping[findKey][0]]);
                res[findKey].answer = currYearRecord[mapping[findKey][0]];
            } else {
                res[findKey].answer = currYearRecord[key];
            }
        }
    });


    return res;
}

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};