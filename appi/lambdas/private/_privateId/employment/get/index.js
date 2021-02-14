'use strict';

const lambda = require('./shared/lambda');
const privUtil = require('./shared/private-lib/util');
const companyApi = require('./shared/company-api');


const getMaxUpdatedAt = (res, year) => {
    if (res.data && res.data.length === 0) {
        return null;
    }
    const maxUpdatedAt = res.data.filter(x => x.year === year).reduce((prev, current) => {
        if (!prev.updateAt && !prev.updateAt) {
            return (prev.createdAt > current.createdAt) ? prev : current
        }
        return (prev.updateAt > current.updateAt) ? prev : current
    });
    return maxUpdatedAt;
}


const handler = async (event, context) => {
    let [
        compensationResult,
        compensationDataItems,
        empResult,
        jurisdictionResult,
        states,
    ] = await Promise.all([
        await companyApi.get(`/v1/companies/${event.companyId}/compensations`),
        await companyApi.get(`/v1/compensationDataItems`),
        await companyApi.get(`/v1/companies/${event.companyId}/employments`),
        await companyApi.get(`/v1/companies/${event.companyId}/jurisdictions`),
        await companyApi.get(`/v1/states?countryId=213`),
    ]);

    // Employment
    const maxEmpYear = privUtil.getMaxYear(empResult);
    if (!maxEmpYear) {
        throw {
            statusCode: 404
        }
    }
    let currYearData = {};
    let lastYearData = {};

    if (maxEmpYear) {
        currYearData = privUtil.findByYear(empResult.data, maxEmpYear);
        lastYearData = privUtil.findByYear(empResult.data, maxEmpYear - 1);
    }

    // End of Employment

    // Compensation
    const maxCompensationYear = privUtil.getMaxYear(compensationResult);
    const maxCompensationUpdatedAt = getMaxUpdatedAt(compensationResult, maxCompensationYear);

    let compensationsData = [];
    const compensationsFilteredData = compensationResult.data.filter(x => x.year === maxCompensationYear)

    let compAsOf;

    for (let comp of compensationDataItems.data) {
        const findData = compensationsFilteredData.find(y => y.compensationDataItemId === comp.compensationDataItemId);
        if (findData) {
            const value = findData.employeeCt ? (findData.employeeCtType === 'Percent' ? findData.employeeCt + '%': findData.employeeCt) : 'N/A';
            compensationsData.push({
                compensation: comp.compensationDataItemName,
                value: value
            })
            compAsOf = findData.month ? `${findData.month/findData.year}` : findData.year;
        } else {
            compensationsData.push({
                compensation: comp.compensationDataItemName,
                value: null
            })
        }
    }


    const compensationsTable = {
        table: {
            "columns": [
                {
                    "title": "Compensation",
                    "tdClassName": "bold",
                    "field": "compensation"
                },
                {
                    "title": "Number/Percentage of Employees",
                    "field": "value"
                }
            ],
            "data": compensationsData
        },
        asOf: compAsOf,
        updatedAt: maxCompensationUpdatedAt
    }
    // End of Compensation


    // Jurisdiction
    let jursdictionData = {}
    let jurisdictionUpdatedAt = null;

    if (maxEmpYear) {
        jursdictionData = jurisdictionResult.data.filter(x => x.year === maxEmpYear).map(x => {
            const state = states.data.find(y => y.stateId === x.stateId);
            const value = x.employeeCtType === 'Actual' ? x.employeeCt : x.employeeCt * 100 + '%'
            return {
                state: state.abbreviation,
                value: value
            }
        });

        jurisdictionUpdatedAt = getMaxUpdatedAt(jurisdictionResult, maxEmpYear);
    }

    const jursdictiosTable = {
        table: {
            "columns": [
                {
                    "title": "Jurification",
                    "tdClassName": "bold",
                    "field": "state"
                },
                {
                    "title": "Number/Percentage of Total Employees",
                    "field": "value"
                }
            ],
            "data": jursdictionData
        },
        updatedAt: jurisdictionUpdatedAt
    };
    // End of Jurisdiction

    const getRatable = (obj) => {
        const keys = ['domesticFt', 'domesticPt', 'forenginEmp', 'contractEmp', 'leasedEmp'];
        let rateble = 0;
        let isEmpty = true;
        for (let k of keys) {
            if (obj[k]) {
                isEmpty = false;
                rateble += obj[k];
            }
        }
        if (isEmpty) {
            return null;
        } else {
            return rateble;
        }
        
    }

    const columns = [
        {
            "title": "Employee Type",
            "tdClassName": "bold",
            "field": "type"
        },
        {
            "title": `${currYearData.month > 0 ?  currYearData.month  + '/':''}${currYearData.year}`,
            "subTitle": `Last uploaded ${currYearData.updateAt || currYearData.createdAt}`,
            "field": "currentYearTotal"
        }
    ];

    if (lastYearData) {
        columns.push({
            "title": `${lastYearData.month > 0 ?  lastYearData.month  + '/':''}${lastYearData.year}`,
            "subTitle": `Last uploaded ${lastYearData.updateAt || lastYearData.createdAt}`,
            "field": "prevYearTotal"
        } );   
    }



    const employmentTypeTable = {
        table: {
            "columns":columns,
            "data": [
                {
                    "type": "Domestic Full Time",
                    "currentYearTotal": currYearData.domesticFt,
                    "prevYearTotal": lastYearData && lastYearData.domesticFt
                },
                {
                    "type": "Domestic Part Time",
                    "currentYearTotal": currYearData.domesticPt,
                    "prevYearTotal": lastYearData && lastYearData.domesticPt
                },
                {
                    "type": "Foreign",
                    "currentYearTotal": currYearData.forenginEmp,
                    "prevYearTotal": lastYearData && lastYearData.forenginEmp
                },
                {
                    "type": "Independent Contractors",
                    "currentYearTotal": currYearData.contractEmp,
                    "prevYearTotal": lastYearData && lastYearData.contractEmp
                },
                {
                    "type": "Leased  Employees",
                    "currentYearTotal": currYearData.leasedEmp,
                    "prevYearTotal": lastYearData && lastYearData.leasedEmp
                },
                {
                    "type": "Total Rateable",
                    "className": "border-top-bold bold",
                    "currentYearTotal": getRatable(currYearData),
                    "prevYearTotal": lastYearData && getRatable(lastYearData)
                }
            ]
        }
    };


    const res = {
        compensations: compensationsTable,
        jurisdictions: jursdictiosTable,
        year: currYearData.year,
        month: currYearData.month,
        turnover: currYearData.turnover ? currYearData.turnover + '%' : null,
        empUpdatedAt: !currYearData ? null : (currYearData.updatedAt ? currYearData.updatedAt : currYearData.createdAt),
        prevEmpUpdatedAt: !lastYearData ? null : (lastYearData.updatedAt ? lastYearData.updatedAt : lastYearData.createdAt),
        prevTurnover: lastYearData && lastYearData.turnover ? lastYearData.turnover + '%' : null,
        unionizedEmp: currYearData.unionizedEmp ? currYearData.unionizedEmp + '%' : null,
        barganingDue: currYearData.barganingDue,
        employmentType: employmentTypeTable,
        updatedAt: {
            lastYear: lastYearData ? (lastYearData.updatedAt || lastYearData.createdAt) : null,
            currentYear: currYearData.updatedAt || currYearData.createdAt
        }
    }

    return res;
};

exports.handler = async (event, context, callback) => {

    return await lambda.handler(event, context, handler);
};