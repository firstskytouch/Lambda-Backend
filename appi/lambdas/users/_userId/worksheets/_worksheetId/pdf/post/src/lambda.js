'use strict';

module.exports.handler = async (event, context, handler) => {
    try {
        let filteredEvent = {};

        if (event.queryStringParameters) {
            Object.assign(filteredEvent, event.queryStringParameters);
        }

        if (event.pathParameters) {
            Object.assign(filteredEvent, event.pathParameters);
        }

        if (event.body) {
            Object.assign(filteredEvent, JSON.parse(event.body));
        }

        if (event.requestContext && event.requestContext.authorizer) {
            filteredEvent.user_id = event.requestContext.authorizer.userId;
            filteredEvent.email = event.requestContext.authorizer.email;
            filteredEvent.accessToken = event.requestContext.authorizer.accessToken;
            filteredEvent.user = {
                userId: filteredEvent.user_id,
                email: filteredEvent.email,
            };
        }

        const res = await handler(filteredEvent, context);
        return {
            statusCode: 200,
            body: JSON.stringify(res),
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        };
    } catch (err) {
        console.error('error', err);

        return {
            statusCode: err.statusCode || 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'x-request-id': context.awsRequestId,
            },
            body: JSON.stringify({
                errorMessage: JSON.stringify(err.errorMessage),
                err: JSON.stringify(err),
            }),
        };
    }
};
