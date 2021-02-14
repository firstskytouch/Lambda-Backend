const lambda = require('./shared/lambda.js');
const dynamoMethods = require('./shared/dynamo.js');

const dynamoTable = process.env.scoresTableName;

const handler = async (event, context) => {
    console.log(event);

    // Only one weird case 
    if (event.modelInputs.inputsData[''] !== undefined) {
        delete event.modelInputs.inputsData[''];
    }
    try {
        let res = await dynamoMethods.putItem(event, dynamoTable);
        return res;
    } catch (err) {
        console.error(err);
        throw new Error(`Couldn't save the event.`);
    }
};

exports.handler = async (event, context) => {
    return await lambda.handler(event, context, handler);
};
