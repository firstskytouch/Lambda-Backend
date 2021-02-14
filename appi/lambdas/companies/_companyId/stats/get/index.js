'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object
const lambda = require('./shared/lambda');

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context, callback) => {

    let peerGroup = event.peerGroup || 'sector';
    let categoricalPeers = peerGroup.indexOf('_size') > -1 ?
                           peerGroup.substr(0, peerGroup.indexOf('_size')) + '_peers' :
                           peerGroup + '_peers';
    let peerGroupSelection = q.metadata['numerical_column_suffixes'].map(i => peerGroup + i).join(', ') + ',' +
                             q.metadata['categorical_column_suffixes'].map(i => categoricalPeers + i).join(', ');

    let query = JSON.parse(JSON.stringify( q ));
    query.queries[0] = query.queries[0].replace(/SELECTION_PLACEHOLDER/g, peerGroupSelection);

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
                title: "Metric",
                field: "metric",
            },
            {
                title: "Value",
                field: "value"
            },
            {
                title: "Peer Group Comparison",
                field: "peers"
            }
        ],
        data: []
    };

    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            let dataRow = data[queryResult][row];

            if (isNaN(Number(dataRow.value))) {
                table.data.push({
                    metric: `${dataRow.item}`,
                    value: dataRow.value,
                    peers: {
                        type: 'barchart',
                        rated: Number(dataRow[`${categoricalPeers}_sp_rated`]),
                        not_rated: Number(dataRow[`${categoricalPeers}_sp_notrated`]),
                        data: {
                            aaa_to_aa: Number(dataRow[`${categoricalPeers}_aaa_to_aa`]), 
                            a: Number(dataRow[`${categoricalPeers}_a`]),
                            bbb: Number(dataRow[`${categoricalPeers}_bbb`]),
                            bb: Number(dataRow[`${categoricalPeers}_bb`]),
                            b: Number(dataRow[`${categoricalPeers}_b`]), 
                            ccc_to_d: Number(dataRow[`${categoricalPeers}_ccc_to_d`])
                        }
                    }
                });
            } else {
                table.data.push({
                    metric: `${dataRow.item}`,
                    value: Number(dataRow.value),
                    peers: {
                        type: 'boxplot',
                        count: Number(dataRow[`${peerGroup}_peers`]),
                         rank: dataRow[`${peerGroup}_percent_rank`] ? Number(dataRow[`${peerGroup}_percent_rank`]) : undefined,
                        data: {
                            p10: Number(dataRow[`${peerGroup}_p10`]),
                            p25: Number(dataRow[`${peerGroup}_p25`]),
                            p50: Number(dataRow[`${peerGroup}_p50`]),
                            p75: Number(dataRow[`${peerGroup}_p75`]),
                            p90: Number(dataRow[`${peerGroup}_p90`])
                        }
                    }
                });
            }
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