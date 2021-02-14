'use strict';

module.exports.handler = async (event, context, handler) => {
    if (event.stayWarm) {
        console.log('Warmup Event');
        return {};
    }
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
            }
        };
    } catch (err) {
        console.error('error', err);

        const errStatusCode = err.statusCode || 500;

        let errorMessage = 'Server Error';
        
        if (errStatusCode === 400) {
            errorMessage = err.errorMessage ? err.errorMessage : 'Bad Request';
        } else if (errStatusCode === 404) {
            errorMessage = err.errorMessage ? err.errorMessage : 'Not Found';
        }
        return {
            statusCode: errStatusCode,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'x-request-id': context.awsRequestId,
            },
            body: JSON.stringify({
                message: errorMessage
            }),
        };
    }
};
