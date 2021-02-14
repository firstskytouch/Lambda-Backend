'use strict';

// sdk
const ir = require('./shared/imageright.js');
const s3 = require('./shared/s3.js');
const validator = require('./shared/validator.js');

// other
const util = require('util');

let params = {
	drawer: process.env.DRAWER,
  	folder: process.env.FOLDER
};

let config = {
	endpoint_url: process.env.IR_ENDPOINT,
  	authorization_key: process.env.IR_AUTH_KEY
};

const formatError = (status, error, message) => {
	if (message) {
		return { success: status, status: 'FAILED', error: message };
	} else {
		return { success: status, status: 'FAILED', error: error, stacktrace: error.stack };
	}
};

exports.handler = async (event) => {
	console.log("Reading input from event:\n", util.inspect(event, {depth: 5}));

	if (!event.s3Key || !event.hasOwnProperty('review')) {
		return formatError(false, null, "s3Key or review flag is missing.");
	}

    const srcBucket = process.env.S3_BUCKET;
    const srcKey = decodeURIComponent(event.s3Key.replace(/\+/g, " "));

    let metadata = null;

	// get PDF metadata
	try {
		metadata = await s3.getObjectMetadata(srcBucket, srcKey);
		validator.loadModel('WorksheetMetadata');
		const isValidObject = validator.validate(metadata, 'WorksheetMetadata');

		if(!isValidObject) {
			return formatError(false, null, "Incomplete metadata.");
		}
	} catch (e) {
		console.log(e);
		return formatError(false, e);
	}

	params.file = metadata.submission_id;

	// send query request
	try {
		let token = await ir.checkDocumentExists(config, params);

		return {
			success: true,
			status: 'SUCCEEDED',
			error: null,
			data: {
				token: token,
				worksheet_id: metadata.worksheet_id,
				document_type: metadata.document_type,
				s3Key: event.s3Key,
				review: event.review
			}
		};
	} catch (e) {
		console.log(e);
		return formatError(false, e);
	}
};