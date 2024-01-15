// Libraries
const { app } = require('@azure/functions');
const req = require('request');
const redis = require('redis');

// Settings
const DEBUG = false;
const APPID = process.env["MICROSOFT_PROVIDER_AUTHENTICATION_APPID"];
const TENANTID = process.env["MICROSOFT_PROVIDER_AUTHENTICATION_TENANTID"];
const SECRET = process.env["MICROSOFT_PROVIDER_AUTHENTICATION_SECRET"];
//const name = request.query.get('name') || await request.text() || 'default value';

app.http('index', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request, context) => {
        // Get resourcePrefix
        const subdomain = request.url.split('/')[2].split('.')[0];
        let resourcePrefix = DEBUG ? 'winae-nkisd77vswzji-func' : subdomain;
        resourcePrefix = resourcePrefix.substring(0, resourcePrefix.length - 5);
        // Get information
        const accessToken = await getAccessToken();
        const subscriptionId = await getSubscriptionId(accessToken);
        const resourceGroupName = await getResourceGroupName(accessToken, subscriptionId);

        // Detect app setting WINAE_REDIS_NAME exist or not
        let redisHost = process.env["WINAE_REDIS_NAME"];
        if (!redisHost) {
            redisName = resourcePrefix + '-ctrl';
            redisPort = 6379;
            redisKey = await getRedisKey(accessToken, subscriptionId, resourceGroupName, redisName);
            context.log("redisKey: " + redisKey);
            const client = redis.createClient({
                url: 'redis://default:' + redisKey + '@' + redisName + '.redis.cache.windows.net:' + redisPort
            });
            client.on('error', err => console.log('Redis Client Error', err));
            await client.connect();
            await client.set('kk', 'vv');
            const kk = await client.get('kk');
            context.log("kk: " + kk);
            await client.disconnect();
            //process.env["WINAE_REDIS_NAME"] = redisName; // not actually change local.setting.json
        }


        // context.log("resourcePrefix: " + resourcePrefix);
        // context.log("accessToken: " + accessToken);
        // context.log("subscriptionId: " + subscriptionId);
        // context.log("resourceGroupName: " + resourceGroupName);



        return { body: subscriptionId };
    }
});

function getAccessToken() {
    var options = {
        'method': 'POST',
        'url': 'https://login.microsoftonline.com/' + TENANTID + '/oauth2/v2.0/token',
        'headers': {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
            'client_id': APPID,
            'client_secret': SECRET,
            'grant_type': 'client_credentials',
            'scope': 'https://management.azure.com/.default'
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).access_token);
        });
    });
}
function getSubscriptionId(accessToken) {
    var options = {
        'method': 'GET',
        'url': 'https://management.azure.com/subscriptions?api-version=2016-06-01',
        'headers': {
            'Authorization': 'Bearer ' + accessToken
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).value[0].id.replace('/subscriptions/', ''));
        });
    });
}
function getResourceGroupName(accessToken, subscriptionId) {
    var options = {
        'method': 'GET',
        'url': 'https://management.azure.com/subscriptions/' + subscriptionId + '/resourcegroups?api-version=2021-04-01',
        'headers': {
            'Authorization': 'Bearer ' + accessToken
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).value[0].id.replace('/subscriptions/' + subscriptionId + '/resourceGroups/', ''));
        });
    });
}
function getRedisKey(accessToken, subscriptionId, resourceGroupName, redisName) {
    var options = {
        'method': 'POST',
        'url': 'https://management.azure.com/subscriptions/' + subscriptionId + '/resourceGroups/' + resourceGroupName + '/providers/Microsoft.Cache/redis/' + redisName + '/listKeys?api-version=2023-08-01',
        'headers': {
            'Authorization': 'Bearer ' + accessToken,
            'Content-type': 'application/json'
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).primaryKey);
        });
    });
}
