'use strict';

const elasticsearch = require('elasticsearch');
const esClient = new elasticsearch.Client({
  host: `https://${process.env.elasticSearchEndpoint}`,
  log: 'trace'
});

const stage = process.env.stage;
const esIndex = `${stage}.programs`;
const esType = 'Program';
const id = 'program_id';

const isObject = function(value) {
  return typeof value === 'object' && value !== null;
};

const convertDynamoJsonToRegularJson = function(data) {
  console.log('converting dynamo json to regular json');

  let S = 'S';
  let N = 'N';
  let B = 'B';
  let BOOL = 'BOOL';
  let NULL = 'NULL';
  let M = 'M';
  let L = 'L';
  let keys = Object.keys(data);

  while (keys.length) {
    let key = keys.shift();
    let types = data[key];

    if (isObject(types) && types.hasOwnProperty(S)) {
      data[key] = types[S];
    } else if (isObject(types) && types.hasOwnProperty(B)) {
      data[key] = types[B];
    } else if (isObject(types) && types.hasOwnProperty(N)) {
      data[key] = parseFloat(types[N]);
    } else if (isObject(types) && types.hasOwnProperty(BOOL)) {
      data[key] = types[BOOL];
    } else if (isObject(types) && types.hasOwnProperty(NULL)) {
      data[key] = null;
    } else if (isObject(types) && types.hasOwnProperty(M)) {
      data[key] = convertDynamoJsonToRegularJson(types[M]);
    } else if (isObject(types) && types.hasOwnProperty(L)) {
      data[key] = convertDynamoJsonToRegularJson(types[L]);
    }
  }

  return data;
};

const updateElasticSearch = function(operations) {
  return new Promise((resolve, reject) => {
    esClient.bulk({
      body: operations
    }).then((resp) => {
      console.log('elasticsearch operation returned');
      resolve();
    }).catch((err) => {
      reject(err);
    });
  });
};

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
exports.handler = (event, context, callback) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (event.stayWarm) {
    console.log('Warmup Event');
    return callback(null, {});
  }

  let operations = [];

  event.Records.forEach((record) => {
    console.log(record.eventID);
    console.log(record.eventName);
    console.log('DynamoDB Record: %j', record.dynamodb);

    let image = record.dynamodb.NewImage ? record.dynamodb.NewImage : record.dynamodb.OldImage;
    let convertedRecord = convertDynamoJsonToRegularJson(image);

    if (record.eventName === 'REMOVE') {
      operations.push({
        delete: {
          _index: esIndex,
          _type: esType,
          _id: convertedRecord[id]
        }
      });
    } else {
      operations.push({
        index: {
          _index: esIndex,
          _type: esType,
          _id: convertedRecord[id]
        }
      });
      operations.push(convertedRecord);
    }
  });
 
  updateElasticSearch(operations)
  .then((response) => {
    console.log('successfully put records to es');
    callback(null, `Successfully processed ${event.Records.length} records.`);
  })
  .catch((error) => {
    callback(error);
  });
};