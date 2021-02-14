'use strict';

// sdk
const dynamo = require('./shared/dynamo.js');
const tableName = process.env.worksheetsTable;
const keyName = 'worksheet_id';


exports.handler = async (event) => {
	console.log(JSON.stringify(event));

	if (!event.worksheet_id || !event.document_type || !event.hasOwnProperty('review')) {
		return new Error('worksheet_id or document_type or review is missing.');
	}

	try {
		let item = {
			worksheet_id: event.worksheet_id,
			state: 'archived',
			review: event.review,
			[`archived_${event.document_type.toLowerCase()}`]: true,
			[`archived_${event.document_type.toLowerCase()}_date`]: new Date().toISOString()
		};
		let res = await dynamo.updateItem(item, tableName, keyName);

		console.log(res);
	} catch (e) {
		console.log(e, e.stack);
		return e;
	}
};