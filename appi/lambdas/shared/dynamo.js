'use strict';

exports = module.exports = {};

const AWS = require('aws-sdk');
const uuidv4 = require('uuid/v4');
const docClient = new AWS.DynamoDB.DocumentClient({
	convertEmptyValues: true
});

/** 
 * Generates a new UUID for DynamoDB hash keys
 *
 * @method generateDynamoUUID
 * @returns {String} v4 UUID
 */
exports.generateDynamoUUID = () => {
	return uuidv4();
};

/** 
 * Creates a list containing the attribute expressions from a given item
 * AWS Docs on formatting: 
 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html#DDB-UpdateItem-request-UpdateExpression
 *
 * @method getUpdateExpression
 * @param {Object} item - object from which expressions are created
 * @param {String} keyName - name of the hash key to avoid
 * @returns {Promise} A promise that returns a list of attribute expressions if resolved
 * and an error if rejected.
 */
const getUpdateExpression = function (item, hashKey, rangeKey) {
	var attr = [];

	Object.keys(item).forEach((key) => {
		if (key === hashKey || key === rangeKey) { return; }

		if (Array.isArray(item[key])) {
			attr.push(`#${key} = list_append(#${key}, :${key})`);
		} else {
			attr.push(`#${key} = :${key}`);
		}
	});

	return `set ${attr.join(',')}`;
};

/** 
 * Creates an object containing the attribute values of a given item
 * AWS Docs on formatting: 
 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html#DDB-Query-request-ExpressionAttributeValues
 *
 * @method getAttributeValues
 * @param {Object} item - object from which values are extracted
 * @param {String} keyName - name of the hash key to avoid
 * @returns {Promise} A promise that returns the attribute values as an object if resolved
 * and an error if rejected.
 */
const getAttributeValues = function (item, hashKey, rangeKey) {
	var attr = {};

	Object.keys(item).forEach((key) => {
		if (key === hashKey || key === rangeKey) { return; }
		attr[`:${key}`] = item[key];
	});

	return attr;
};

/** 
 * Creates an object containing the attribute names of a given item
 * AWS Docs on formatting: 
 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html#DDB-Query-request-ExpressionAttributeNames
 *
 * @method getAttributeNames
 * @param {Object} item - object from which parameter names are extracted
 * @param {String} keyName - name of the hash key to avoid
 * @returns {Promise} A promise that returns the attribute names as an object if resolved
 * and an error if rejected.
 */
const getAttributeNames = function (item, hashKey, rangeKey) {
	var attr = {};

	Object.keys(item).forEach((key) => {
		if (key === hashKey || key === rangeKey) { return; }
		attr[`#${key}`] = key;
	});

	return attr;
};

/** 
 * Gets an item from a specified DynamoDB table
 *
 * @method exports.getItem
 * @param {Object} item - object to be retrieved
 * @param {String} tableName - name of the DynamoDB table
 * @param {String} keyName - name of the hash key
 * @returns {Promise} A promise that returns the item if resolved
 * and an error if rejected.
 */
exports.getItem = (itemId, tableName, hashKeyName, rangeKeyName) => {
	return new Promise((resolve, reject) => {
		let params = {
			TableName: tableName,
			Key: {
				[hashKeyName]: itemId
			}
		};

		docClient.get(params, function (err, data) {
			if (err) {
				reject(err);
			} else {
				resolve(data.Item);
			}
		});
	});
};

/** 
 * Adds an item to a specified DynamoDB table
 *
 * @method exports.putItem
 * @param {Object} item - object to be added
 * @param {String} tableName - name of the DynamoDB table
 * @param {String} keyName - name of the hash key
 * @returns {Promise} A promise that returns the newly created item if resolved
 * and an error if rejected.
 */
exports.putItem = (item, tableName, keyName) => {
	return new Promise((resolve, reject) => {
		item.created_timestamp = new Date().toISOString();

		let params = {
			TableName: tableName,
			Item: item
		};

		docClient.put(params, function (err, data) {
			if (err) {
				reject(err);
			} else {
				resolve(item);
			}
		});
	});
};

/** 
 * Updates an item from a specified DynamoDB table
 *
 * @method exports.updateItem
 * @param {Object} item - object to be updated
 * @param {String} tableName - name of the DynamoDB table
 * @param {String} keyName - name of the hash key
 * @returns {Promise} A promise that returns the updated item if resolved
 * and an error if rejected.
 */
exports.updateItem = (item, tableName, hashKeyName, rangeKeyName) => {
	return new Promise((resolve, reject) => {
		item.updated_at = new Date().toISOString();

		let params = {
			TableName: tableName,
			Key: {
				[hashKeyName]: hashKeyName ? item[hashKeyName] : undefined,
				[rangeKeyName]: rangeKeyName ? item[rangeKeyName] : undefined
			},
			UpdateExpression: getUpdateExpression(item, hashKeyName, rangeKeyName),
			ExpressionAttributeValues: getAttributeValues(item, hashKeyName, rangeKeyName),
			ExpressionAttributeNames: getAttributeNames(item, hashKeyName, rangeKeyName),
			ReturnValues: "ALL_NEW"
		};

		console.log(params);

		docClient.update(params, function (err, data) {
			if (err) {
				reject(err);
			} else {
				resolve(data.Attributes);
			}
		});
	});
};

/** 
 * Deletes an item from a specified DynamoDB table
 *
 * @method exports.deleteItem
 * @param {Object} itemId - object to be deleted
 * @param {String} tableName - name of the DynamoDB table
 * @param {String} keyName - name of the hash key
 * @returns {Promise} A promise that returns nothing if resolved
 * and an error if rejected.
 */
exports.deleteItem = (item, tableName, hashKeyName, rangeKeyName) => {
	return new Promise((resolve, reject) => {
		let params = {
			TableName: tableName,
			Key: {}
		};

		if ([undefined, null].indexOf(item[hashKeyName] !== -1)) {
			params.Key[hashKeyName] = item[hashKeyName];
		}

		if ([undefined, null].indexOf(item[rangeKeyName] !== -1)) {
			params.Key[rangeKeyName] = item[rangeKeyName];
		}

		console.log(params);

		docClient.delete(params, function (err, data) {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
};


exports.scan = (tableName) => {
	return new Promise((resolve, reject) => {
		const params = {
			TableName: tableName
		};
		docClient.scan(params, function (err, data) {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
};