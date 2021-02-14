'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object
const moment = require('moment');
const lambda = require('./shared/lambda');

const generatePartialDate = (year, month) => {
    if (year && month) {
        return moment(`${year}-${month}-1`).format('MMM, YYYY');
    } else if (year) {
        return year;
    } else {
        return 'N/A';
    }
};

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context, callback) => {
    let query = JSON.parse(JSON.stringify( q ));

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const data = await redshift.query(event, query, creds);

    console.log('data', data);

    if(!data || data.length < 1 || data[0].length < 1 || data[0][0].length < 1) {
        throw {
            statusCode: 404            
        }
    }

    var table = {
        columns: [
            {
                title: "Name",
                field: "name"
            },
            {
                title: "Risk Flag",
                field: "riskFlag"
            },
            {
                title: "Title",
                field: "title"
            },
            {
                title: "Since",
                field: "since"
            },
            {
                title: "Total Calculated Comp",
                field: "compensation"
            },
            {
                title: "Comp Fiscal Year",
                field: "compensationfiscalyear"
            },
            {
                title: "Shares",
                field: "shares"
            },
            {
                title: "% of Outstanding Shares",
                field: "percentages"
            },
            {
                title: "Date Reported",
                field: "date_reported"
            }
        ],
        data: []
    };

    function getUnique(arr, comp) {
        
        const unique = arr
             .map(e => e[comp])
      
           // store the keys of the unique objects
          .map((e, i, final) => final.indexOf(e) === i && i)
      
          // eliminate the dead keys & store unique objects
          .filter(e => arr[e]).map(e => arr[e]);
      
         return unique;
      }
      
    Object.keys(data).map(queryResult => {
        const uniqueData = getUnique(data[queryResult], 'personid');
        Object.keys(uniqueData).map(row => {
            let dataRow = uniqueData[row];
            let date = moment(`${dataRow.startyear}-${dataRow.startmonth}-${dataRow.startday}`).format('MMM Do, YYYY');

            let riskFlags = [];

            if (dataRow.full_found_mscads !== '' || dataRow.partial_mscads_only !== '') {
                try {
                    let j1 = [];
                    let j2 = [];

                    if (dataRow.full_found_mscads !== '') {
                        j1 = JSON.parse(dataRow.full_found_mscads);
                    }

                    if (dataRow.partial_mscads_only !== '') {
                        j2 = JSON.parse(dataRow.partial_mscads_only);
                    }

                    riskFlags = riskFlags.concat(j1).concat(j2).filter(n => n);
                } catch (e) {
                    console.log('error', e);
                }
            }

            table.data.push({
                personId: dataRow.personid,
                name: dataRow.name,
                title: dataRow.title,
                riskFlag: riskFlags.filter((item, pos, self) => {
                    return self.indexOf(item) == pos;
                }),
                since: date != 'Invalid date' ? date : generatePartialDate(dataRow.startyear, dataRow.startmonth),
                compensation: `$${Number(dataRow.compensation).toLocaleString()}`,
                compensationfiscalyear: dataRow.compensationfiscalyear,
                shares: Number(dataRow.shares).toLocaleString(),
                percentages: Number(dataRow.perc).toFixed(2),
                msci_flagged_director_profile: dataRow.msci_flagged_director_profile,
                date_reported: moment(dataRow.date_reported.toISOString().substr(0, 10)).format('MMM Do, YYYY')
            });
        });
    });

    return table;
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};