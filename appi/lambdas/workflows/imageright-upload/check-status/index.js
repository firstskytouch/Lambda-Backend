'use strict';

// sdk
const ir = require('./shared/imageright.js');

let config = {
	endpoint_url: process.env.IR_ENDPOINT,
  	authorization_key: process.env.IR_AUTH_KEY
};

const formatError = (status, error, message) => {
	if (message) {
		return { success: status, error: message };
	} else {
		return { success: status, error: error, stacktrace: error.stack };
	}
};

exports.handler = async (event) => {
	console.log(JSON.stringify(event));

	if (!event.token || !event.worksheet_id || !event.document_type || !event.hasOwnProperty('review')) {
		return formatError(false, null, "token, worksheet_id or document_type or review is missing.");
	}

	// send status check request
	try {
		let res = await ir.checkDocumentStatus(config, event.token);
		res.data = { 
			token: event.token,
			worksheet_id: event.worksheet_id,
			document_type: event.document_type,
			s3Key: event.s3Key,
			review: event.review
		};

		return res;
	} catch (e) {
		console.log(e);
		return formatError(false, e);
	}
};