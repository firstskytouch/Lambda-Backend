'use strict';

//aws
const AWS = require('aws-sdk');
const stepfunctions = new AWS.StepFunctions();
const stateMachineArn = process.env.stateMachineArn;

/** 
 * Start a state machine execution with a provided input.
 *
 * @method start
 * @param {Object} input - input object to the execution start node
 * @returns {Promise} A promise that returns a response object if resolved
 * and an error if rejected.
 */
const start = (input) => {
    return new Promise((resolve, reject) => {
        const params = {
            stateMachineArn: stateMachineArn,
            input: input
        };

        stepfunctions.startExecution(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

const getHistory = (executionArn, nextToken=undefined) => {
    return new Promise((resolve, reject) => {
        const params = {
            executionArn: executionArn,
            nextToken: nextToken,
            reverseOrder: true
        };
        stepfunctions.getExecutionHistory(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

exports = module.exports = {
   start,
   getHistory
};