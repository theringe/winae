// Libraries
const { app } = require('@azure/functions');
const { ShareFileClient, StorageSharedKeyCredential } = require("@azure/storage-file-share");
const ioredis = require('ioredis');
const req = require('request');
const fs = require('fs');

// Settings
const APPID = process.env["MICROSOFT_PROVIDER_AUTHENTICATION_APPID"];
const TENANTID = process.env["MICROSOFT_PROVIDER_AUTHENTICATION_TENANTID"];
const SECRET = process.env["MICROSOFT_PROVIDER_AUTHENTICATION_SECRET"];
// must be available after installation
const WINAE_REDIS_NAME = process.env["WINAE_REDIS_NAME"];
const WINAE_REDIS_PORT = process.env["WINAE_REDIS_PORT"];
const WINAE_REDIS_KEY = process.env["WINAE_REDIS_KEY"];
const WINAE_IMAGE = process.env["WINAE_IMAGE"];

app.http('winae', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Debug App
        const name = request.query.get('name') || await request.text() || 'default value';
        let connectionString = "";
        let resCookie = [];
        if (request.method === 'POST') {
            connectionString = request.query.get('connection_string') || await request.text() || 'default value';
            connectionString = decodeURIComponent(connectionString);
            if (connectionString) {
                resCookie.push({
                    name: 'connection_string',
                    value: connectionString,
                    path: '/',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None'
                });
            }
        }
        // Get image info
        const subdomain = request.url.split('/')[2].split('.')[0];
        let resourcePrefix = (subdomain == 127) ? name : subdomain;
        resourcePrefix = resourcePrefix.substring(0, resourcePrefix.length - 5);
        const appName = resourcePrefix + '-app';
        const accessToken = await getAccessToken();
        const subscriptionId = await getSubscriptionId(accessToken);
        const resourceGroupName = await getResourceGroupName(accessToken, subscriptionId);
        // Get App Service Info
        const isAppOffline = await getAppSettings(accessToken, subscriptionId, resourceGroupName, appName);
        let resBody = "";
        if (request.method === 'GET') {
            if (JSON.stringify(isAppOffline) === '{}') {
                resBody = '{"succ": true, "msg": "OFFLINE"}';
            } else {
                const redis = new ioredis({
                    host: WINAE_REDIS_NAME + '.redis.cache.windows.net',
                    port: WINAE_REDIS_PORT,
                    password: WINAE_REDIS_KEY,
                });
                let projects = await redis.keys('*:project:*');
                for (let i = 0; i < projects.length; i++) projects[i] = projects[i].split(":")[2];
                if (projects.length == 0) {
                    resBody = '{"succ": true, "msg": "ONLINE"}';
                } else {
                    resBody = '{"succ": true, "msg": "Rendering project(s): ' + projects.join(", ") + '"}';
                }
            }
            return {
                statusCode: 200,
                isBase64Encoded: false,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: resBody,
                cookies: resCookie
            };
        } else {
            if (JSON.stringify(isAppOffline) !== '{}') {
                resBody = '{"succ": false, "msg": "Render Nodes are running"}';
            } else {
                resBody = '{"succ": true, "msg": ""}';
                // Launch ASP and APP
                const functionAppName = resourcePrefix + '-func';
                const location = await getLocation(accessToken, subscriptionId, resourceGroupName, functionAppName);
                const planName = resourcePrefix + '-env';
                const appName = resourcePrefix + '-app';
                const registryName = resourcePrefix.replace('-', '') + 'cr';
                const registryKey = await getRegistryKey(accessToken, subscriptionId, resourceGroupName, registryName);
                // node count (and other potential parameters)
                const nodeCount = request.query.get('node_count') || await request.text() || '1';
                fs.writeFileSync('sample/tool/winae-core.ps1', fs.readFileSync('script/winae-core.ps1', 'utf8')
                    .replace(/fixedMachineCount = 1;/g, "fixedMachineCount = " + nodeCount + ";")
                );
                const storageAccountName = resourcePrefix.replace('-', '') + 'sa';
                const storageAccountKey = await getStorageAccountKey(accessToken, subscriptionId, resourceGroupName, storageAccountName);
                fileClient = new ShareFileClient(
                    'https://' + storageAccountName + '.file.core.windows.net/winae-file/' + 'tool/winae-core.ps1',
                    new StorageSharedKeyCredential(storageAccountName, storageAccountKey)
                );
                await fileClient.uploadFile('sample/tool/winae-core.ps1');
                // Exe
                const resPlan = await createPlan(accessToken, subscriptionId, resourceGroupName, planName, location);
                const resApp = await createApp(accessToken, subscriptionId, resourceGroupName, planName, location, appName, registryName, registryKey, WINAE_IMAGE, connectionString);
            }
            return {
                statusCode: 200,
                isBase64Encoded: false,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: resBody,
                cookies: resCookie
            };
        }
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
function getAppSettings(accessToken, subscriptionId, resourceGroupName, functionAppName) {
    var options = {
        'method': 'POST',
        'url': 'https://management.azure.com/subscriptions/' + subscriptionId + '/resourceGroups/' + resourceGroupName + '/providers/Microsoft.Web/sites/' + functionAppName + '/config/appsettings/list?api-version=2022-03-01',
        'headers': {
            'Authorization': 'Bearer ' + accessToken,
            'Content-type': 'application/json'
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).properties || {});
        });
    });
}
function getStorageAccountKey(accessToken, subscriptionId, resourceGroupName, storageAccountName) {
    var options = {
        'method': 'POST',
        'url': 'https://management.azure.com/subscriptions/' + subscriptionId + '/resourceGroups/' + resourceGroupName + '/providers/Microsoft.Storage/storageAccounts/' + storageAccountName + '/listKeys?api-version=2023-01-01',
        'headers': {
            'Authorization': 'Bearer ' + accessToken,
            'Content-type': 'application/json'
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).keys[0].value);
        });
    });
}
function getLocation(accessToken, subscriptionId, resourceGroupName, functionAppName) {
    var options = {
        'method': 'GET',
        'url': 'https://management.azure.com/subscriptions/' + subscriptionId + '/resourceGroups/' + resourceGroupName + '/providers/Microsoft.Web/sites/' + functionAppName + '?api-version=2022-03-01',
        'headers': {
            'Authorization': 'Bearer ' + accessToken
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).location || "");
        });
    });
}
function getRegistryKey(accessToken, subscriptionId, resourceGroupName, registryName) {
    var options = {
        'method': 'POST',
        'url': 'https://management.azure.com/subscriptions/' + subscriptionId + '/resourceGroups/' + resourceGroupName + '/providers/Microsoft.ContainerRegistry/registries/' + registryName + '/listCredentials?api-version=2023-01-01-preview',
        'headers': {
            'Authorization': 'Bearer ' + accessToken,
            'Content-type': 'application/json'
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).passwords[0].value);
        });
    });
}
function createPlan(accessToken, subscriptionId, resourceGroupName, planName, location) {
    var options = {
        'method': 'PUT',
        'url': 'https://management.azure.com/subscriptions/' + subscriptionId + '/resourceGroups/' + resourceGroupName + '/providers/Microsoft.Web/serverfarms/' + planName + '?api-version=2022-03-01',
        'headers': {
            'Authorization': 'Bearer ' + accessToken,
            'Content-type': 'application/json'
        },
        body: JSON.stringify({
            "name": planName,
            "type": "Microsoft.Web/serverfarms",
            "location": location,
            "kind": "windows",
            "tags": {},
            "properties": {
                "name": planName,
                "workerSize": "10",
                "workerSizeId": "10",
                "numberOfWorkers": "1",
                "hyperV": true,
                "zoneRedundant": false
            },
            "sku": {
                "Tier": "PremiumV3",
                "Name": "P2V3"
            }
        })
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body) || {});
        });
    });
}
function createApp(accessToken, subscriptionId, resourceGroupName, planName, location, appName, registryName, registryKey, image, connectionString) {
    var options = {
        'method': 'PUT',
        'url': 'https://management.azure.com/subscriptions/' + subscriptionId + '/resourceGroups/' + resourceGroupName + '/providers/Microsoft.Web/sites/' + appName + '?api-version=2022-03-01',
        'headers': {
            'Authorization': 'Bearer ' + accessToken,
            'Content-type': 'application/json'
        },
        body: JSON.stringify({
            "name": appName,
            "type": "Microsoft.Web/sites",
            "location": location,
            "tags": {},
            "properties": {
                "name": appName,
                "siteConfig": {
                    "appSettings": [
                        {
                            "name": "DOCKER_REGISTRY_SERVER_URL",
                            "value": "https://" + registryName + ".azurecr.io"
                        },
                        {
                            "name": "DOCKER_REGISTRY_SERVER_USERNAME",
                            "value": registryName
                        },
                        {
                            "name": "DOCKER_REGISTRY_SERVER_PASSWORD",
                            "value": registryKey
                        },
                        {
                            "name": "WEBSITES_ENABLE_APP_SERVICE_STORAGE",
                            "value": "false"
                        }
                    ],
                    "windowsFxVersion": "DOCKER|" + image,
                    "appCommandLine": connectionString,
                    "alwaysOn": true,
                    "ftpsState": "FtpsOnly"
                },
                "serverFarmId": "/subscriptions/" + subscriptionId + "/resourcegroups/" + resourceGroupName + "/providers/Microsoft.Web/serverfarms/" + planName,
                "clientAffinityEnabled": false,
                "virtualNetworkSubnetId": null,
                "httpsOnly": true,
                "publicNetworkAccess": "Enabled"
            }
        })
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body) || {});
        });
    });
}
