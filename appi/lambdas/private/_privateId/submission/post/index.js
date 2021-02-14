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
const lossHistoryMapping = require('./shared/privMappings/loss.json');

const companyApi = require('./shared/company-api');

const filterByYear = (year, res) => {
    const rows = res.data;
    if (rows === null) {
        return [];
    }
    return rows.filter(x => x.year >= year);
}

const diff = (startDate, i) => {

    // Do your operations
    var endDate = new Date();
    var seconds = (endDate.getTime() - startDate.getTime()) / 1000;
    console.log(`${i} ${seconds}seconds`);
}

const handler = async (event, context) => {
    if (event.year === undefined) {
        throw {
            statusCode: 400
        }
    }
    const submission = event.submission;

    const start = new Date();

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
        await companyApi.get(`/v1/states?countryId=213`), // 213 = US
    ]);

    let i = 1;
    diff(start, i++);
    const dt = new Date();
    const selectedYear = event.year || dt.getFullYear();
    const selectedMonth = event.month;

    const balanceSheets = filterByYear(selectedYear, balanceSheetsHistory);
    const cashFlows = filterByYear(selectedYear, cashFlowsHistory);
    const employments = filterByYear(selectedYear, employmentsHistory);
    const incomeStatements = filterByYear(selectedYear, incomeStatementsHistory);

    // this year
    const compensations = filterByYear(selectedYear, compensationHistory);
    const fiduciaries = filterByYear(selectedYear, fiduciaryHistory);
    const ownerships = filterByYear(selectedYear, ownershipHistory);
    const jurisdictions = filterByYear(selectedYear, jurisdictionsHistory);

    const losses = filterByYear(selectedYear, lossHistory);

    // compensation
    compensationMapping.compensationDataItem = compensationDataItems.data;

    const co = convert(submission, compensationMapping, compensations, selectedYear, selectedMonth);

    const fi = convert(submission, fiduciaryMapping, fiduciaries, selectedYear, selectedMonth);


    const ow = convert(submission, ownershipMapping, ownerships, selectedYear, selectedMonth);

    jurisdictionMapping.state = states.data;
    const ju = convert(submission, jurisdictionMapping, jurisdictions, selectedYear, selectedMonth);

    const bs = convert(submission, balancesheetsMapping, balanceSheets, selectedYear, selectedMonth);




    // cash flow
    const cf = convert(submission, cashflowMapping, cashFlows, selectedYear, selectedMonth);

    const em = convert(submission, employmentMapping, employments, selectedYear, selectedMonth);

    // income statements
    const is = convert(submission, incomestatementMapping, incomeStatements, selectedYear, selectedMonth);


    const lo = convert(submission, lossHistoryMapping, losses, selectedYear, selectedMonth);


    diff(start, i++);
    try {
        await upsert('balanceSheetId', bs, `/v1/companies/${event.companyId}/balanceSheets`);
        await upsert('cashFlowId', cf, `/v1/companies/${event.companyId}/cashFlows`);
        await upsert('compensationId', co, `/v1/companies/${event.companyId}/compensations`);
        await upsert('employmentId', em, `/v1/companies/${event.companyId}/employments`);
        await upsert('incomeStatementId', is, `/v1/companies/${event.companyId}/incomeStatements`);
        await upsert('fiduciaryId', fi, `/v1/companies/${event.companyId}/fiduciaries`);
        await upsert('ownershipId', ow, `/v1/companies/${event.companyId}/ownerships`);
        await upsert('jurisdictionId', ju, `/v1/companies/${event.companyId}/jurisdictions`);
        await upsert('lossId', lo, `/v1/companies/${event.companyId}/losses`);
    } catch (e) {
        console.log(e);
    }

    diff(start, i++);
    return {
        bs,
        cf,
        co,
        em,
        is,
        fi,
        ow,
        ju
    }

};



const upsert = async (primaryKey, data, endpoint) => {
    let arr = data.upsert;
    for (let d of arr) {
        if (!d) {
            continue;
        }
        if (d[primaryKey]) {
            console.log('update', `${endpoint}/${d[primaryKey]}`, d);
            await companyApi.put(`${endpoint}/${d[primaryKey]}`, d);
        } else {
            console.log('create', endpoint, d)
            await companyApi.post(endpoint, d);
        }
    }
    arr = data.deleted;
    for (let d of arr) {
        if (!d) {
            continue;
        }
        if (d[primaryKey]) {
            console.log('delete', `${endpoint}/${d[primaryKey]}`);
            await companyApi.delete(`${endpoint}/${d[primaryKey]}`);
        }
    }
}

const convertData = (record, mapping, key) => {
    if (mapping[key].convert) {

        for (let r of mapping[key].convert) {
            const data = mapping[r.table].find(x => x[r.to] === record[r.to]);
            record[r.from] = data && data[r.from] ? data[r.from] : null;
            delete record[r.to];
        }
    }
    return record
}


const processTableData = (sub, records, mapping, key, year, month, index) => {
    const deleted = [];
    if (mapping[key].type === 'dynamicTable' || mapping[key].type === 'row') {
        if (sub[key].answer.length > records.length) {
            const diff = sub[key].answer.length - records.length;
            for (let i = 0; i < diff; i++) {
                records.push({ year, month });
            }
        } else if (sub[key].answer.length < records.length) {
            const diff = records.length - sub[key].answer.length;
            for (let i = 0; i < diff; i++) {
                deleted.push(records.pop());
            }
        }
    }

    for (let i = 0; i < sub[key].answer.length; i++) {
        let record = mapping[key].type === 'row' || mapping[key].type === 'dynamicTable' ? records[i] : records[0];

        if (mapping[key].type === 'dynamicTable' || mapping[key].type === 'row') {
            for (let k = 0; k < mapping[key].keys.length; k++) {

                record[mapping[key].keys[k]] = sub[key].answer[i][k];
                if (record[mapping[key].keys[k]] === '') {
                    record[mapping[key].keys[k]] = null;
                }
            }
            record = convertData(record, mapping, key);
        } else {
            if (record[mapping[key].keys[i]] != sub[key].answer[i][index]) {

                record[mapping[key].keys[i]] = sub[key].answer[i][index];

                if (record[mapping[key].keys[i]] === '') {
                    record[mapping[key].keys[i]] = null;
                }

                record = convertData(record, mapping, key);
            }
        }
    }

    return {
        records,
        deleted
    };
}


const convert = (submission, mapping, history, currentYear, selectedMonth) => {
    let deleted = [];
    let currYearRecords = history.filter(x => x.year === currentYear);
    if (currYearRecords.length === 0) {
        currYearRecords.push({ year: currentYear });
    }

    for (let i = 0; i < currYearRecords.length; i++) {
        let currYearRecord = currYearRecords[i];
        currYearRecord.year = currentYear;
        currYearRecord.month = selectedMonth;
    }

    for (let sub of submission) {
        Object.keys(sub).forEach((key) => {
            if (mapping[key]) {
                if (typeof mapping[key] === 'string') {
                    for (let i = 0; i < currYearRecords.length; i++) {
                        let currYearRecord = currYearRecords[i];
                        if (currYearRecord[mapping[key]] != sub[key].answer) {

                            currYearRecord[mapping[key]] = sub[key].answer;
                            if (currYearRecord[mapping[key]] === '') {
                                currYearRecord[mapping[key]] = null;
                            }
                            currYearRecord = convertData(currYearRecord, mapping, key);
                        }
                    }
                } else if (Array.isArray(mapping[key])) {
                    for (let i = 0; i < currYearRecords.length; i++) {
                        let currYearRecord = currYearRecords[i];

                        for (let m of mapping[key]) {
                            if (currYearRecord[m] != sub[key].answer) {
                                currYearRecord[m] = sub[key].answer;
                                if (currYearRecord[m] === '') {
                                    currYearRecord[m] = null;
                                }
                            }
                        }
                        currYearRecord = convertData(currYearRecord, mapping, key);
                    }
                } else {
                    const hasRowHeader = mapping[key].rowHeader && mapping[key].rowHeader === true ? true : false;
                    let index = hasRowHeader === true ? 1 : 0;
                    for (let i = index; i < mapping[key].keys.length; i++) {

                        let processedData = processTableData(sub, currYearRecords, mapping, key, currentYear, selectedMonth, index);
                        if (processedData.deleted.length > 0) {
                            deleted = deleted.concat(processedData.deleted)
                        }
                    }
                }
            }
        });
    }

    let res = [];

    for (let o of currYearRecords) {
        if (isEmpty(o, mapping)) {
            deleted = deleted.concat(o);
        } else {
            res.push(o);
        }
    }


    return {
        upsert: res,
        deleted
    };
}
const isEmpty = (obj, mapping) => {
    const ignoreKeys = ['year', 'companyId', 'month', 'createdAt', 'updatedAt'];
    let empty = true;
    if (mapping.primaryKey) {
        ignoreKeys.push(mapping.primaryKey);
    }

    let breakLoop = false;

    Object.keys(obj).forEach(key => {
        if (breakLoop === false && ignoreKeys.indexOf(key) === -1) {
            if (obj[key] !== null) {
                empty = false;
            }
            if (mapping.required && mapping.required.indexOf(key) !== -1) {
                console.log('required', key);
                if (obj[key] === null) {
                    empty = true;
                    breakLoop = true;
                }
            }
        }
    });
    return empty;
}

exports.handler = async (event, context, callback) => {
    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }

    return await lambda.handler(event, context, handler);
};