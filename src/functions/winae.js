const { app } = require('@azure/functions');
const redis = require('redis');

app.http('winae', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymmous',
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
        // const client = redis.createClient({
        //     url: 'redis://default:' + redisKey + '@' + redisName + '.redis.cache.windows.net:' + redisPort
        // });
        // client.on('error', err => console.log('Redis Client Error', err));
        // await client.connect();
        // await client.set('kk', 'vv');
        // const kk = await client.get('kk');
        // context.log("kk: " + kk);
        // await client.disconnect();
    }
});
