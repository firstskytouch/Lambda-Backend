'use strict';

const dynamo = require('./shared/dynamo.js');
const dynamoTable = process.env.worksheetsTable;
const keyName = 'worksheet_id';

const sf = require('./shared/stepfunctions.js');

const sleep = m => new Promise(r => setTimeout(r, m));

const lambda = require('./shared/lambda');

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 */
const handler = async (event) => {
  	if (!event[keyName] || !event.documentType || !event.hasOwnProperty('review')) {
  		console.log(`${keyName} or documentType or review flag is missing`);
  		throw new Error('Bad Request');
  	}

  	let s3Key, executionArn = null;

  	// check archive key in dynamodb
  	try {
  		let worksheet = await dynamo.getItem(event[keyName], dynamoTable, keyName);
  		s3Key = worksheet[`archived_${event.documentType.toLowerCase()}_s3loc`] || 
  				new Error(`${event.documentType} PDF does not exist`);
  	} catch (error) {
  		console.log(error, error.stack);
  		throw new Error(error);
  	}

  	// trigger state machine
  	try {
  		let res = await sf.start(JSON.stringify({
        s3Key: s3Key,
        review: event.review
      }));
  		console.log(res);
      executionArn = res.executionArn;
  	} catch (error) {
  		console.log(error, error.stack);
  		throw new Error(error);
  	}

    // wait 4s before checking the latest status of the task activity
    await sleep(4000);

    try {
      let hist = await sf.getHistory(executionArn);
      console.log(hist.events);
      let lastEvent = hist.events[0];

      if (lastEvent.type === 'ExecutionFailed') {
        console.log('Failed');
        return { statusCode: 500, statusMessage: 'Failed' };
      } else if (lastEvent.type === 'ExecutionSucceeded') {
        console.log('Succcess');
        return { statusCode: 200, statusMessage: 'Success' };
      } else {
        console.log('Process took more than 4000ms.');
        return { statusCode: 200, statusMessage: 'Waiting' };
      }
    } catch (error) {
      console.log(error, error.stack);
      throw new Error(error);
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