const { app } = require('@azure/functions');

app.http('winae', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        if (request.method === 'GET') {
            return {
                statusCode: 200,
                isBase64Encoded: false,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: '{"succ": true, "msg": "OFFLINE"}'
            };
        } else {
            return {
                statusCode: 200,
                isBase64Encoded: false,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: '{"succ": true, "msg": "POST"}'
            };
        }
    }
});
