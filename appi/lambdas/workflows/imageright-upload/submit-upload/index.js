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

	if (!event.data.s3Key || !event.data.hasOwnProperty('review')) {
		return formatError(false, null, "s3Key or review flag is missing.");
	}

    const srcBucket = process.env.S3_BUCKET;
    const srcKey = decodeURIComponent(event.data.s3Key.replace(/\+/g, " "));
    const reviewStr = event.data.review ? '_90d_review' : '';

    let metadata, contents, versionNumber = null;
	
	// get PDF in base64 encoding
	try {
		contents = await s3.getObject(srcBucket, srcKey);
		contents = contents.toString('base64');
	} catch (e) {
		console.log(e);
		return formatError(false, e);
	}

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

	// get version number of PDF
	try {
		let versions = await s3.getObjectVersions(srcBucket, srcKey);
		versionNumber = versions.length;
	} catch (e) {
		console.log(e);
		return formatError(false, e);
	}

	params.file = metadata.submission_id;
	params.document_type = metadata.document_type;
	params.filename = `${metadata.document_type}${reviewStr}_v${versionNumber}.pdf`;
	console.log(params);

	params['body'] = contents;

	// send upload request
	try {
		let token = await ir.uploadDocument(config, params);

		return {
			success: true,
			status: 'SUCCEEDED',
			error: null,
			data: {
				token: token,
				worksheet_id: metadata.worksheet_id,
				document_type: metadata.document_type,
				s3Key: event.data.s3Key,
				review: event.data.review
			}
		};
	} catch (e) {
		console.log(e);
		return formatError(false, e);
	}
};