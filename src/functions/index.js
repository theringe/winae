// Libraries
const { app } = require('@azure/functions');
const { ShareServiceClient, ShareFileClient, StorageSharedKeyCredential } = require("@azure/storage-file-share");
const req = require('request');
const fs = require('fs');

// Settings
const APPID = process.env["MICROSOFT_PROVIDER_AUTHENTICATION_APPID"];
const TENANTID = process.env["MICROSOFT_PROVIDER_AUTHENTICATION_TENANTID"];
const SECRET = process.env["MICROSOFT_PROVIDER_AUTHENTICATION_SECRET"];

app.http('index', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Debug App
        const name = request.query.get('name') || await request.text() || 'default value';
        // Get resourcePrefix
        const subdomain = request.url.split('/')[2].split('.')[0];
        let resourcePrefix = (subdomain == 127) ? name : subdomain;
        resourcePrefix = resourcePrefix.substring(0, resourcePrefix.length - 5);
        // Internal Variables
        let accessToken = "";
        let subscriptionId = "";
        let resourceGroupName = "";
        let appSettings = {};
        // Redis And FileShares
        if (!process.env["WINAE_REDIS_NAME"]) {
            // Ger Azure Resources
            accessToken = await getAccessToken();
            subscriptionId = await getSubscriptionId(accessToken);
            resourceGroupName = await getResourceGroupName(accessToken, subscriptionId);
            // Get Redis information
            redisName = resourcePrefix + '-ctrl';
            redisPort = 6379;
            redisKey = await getRedisKey(accessToken, subscriptionId, resourceGroupName, redisName);
            // Set App Settings to environment variables
            process.env["WINAE_REDIS_NAME"] = redisName;
            process.env["WINAE_REDIS_PORT"] = redisPort;
            process.env["WINAE_REDIS_KEY"] = redisKey;
            // Set App Settings to App Service
            const functionAppName = resourcePrefix + '-func';
            appSettings = await getAppSettings(accessToken, subscriptionId, resourceGroupName, functionAppName);
            appSettings.WINAE_REDIS_NAME = redisName;
            appSettings.WINAE_REDIS_PORT = redisPort;
            appSettings.WINAE_REDIS_KEY = redisKey;
            await setAppSettings(accessToken, subscriptionId, resourceGroupName, functionAppName, appSettings);
            // Setup Files
            const storageAccountName = resourcePrefix.replace('-', '') + 'sa';
            const storageAccountKey = await getStorageAccountKey(accessToken, subscriptionId, resourceGroupName, storageAccountName);
            var fileClient = null;
            fs.writeFileSync('sample/tool/winae.ps1', fs.readFileSync('script/winae.ps1', 'utf8')
                .replace(/\[aadClientId\]/g, process.env["MICROSOFT_PROVIDER_AUTHENTICATION_APPID"])
                .replace(/\[aadTenantId\]/g, process.env["MICROSOFT_PROVIDER_AUTHENTICATION_TENANTID"])
                .replace(/\[aadSecretId\]/g, process.env["MICROSOFT_PROVIDER_AUTHENTICATION_SECRET"])
                .replace(/\[subscriptionId\]/g, subscriptionId)
                .replace(/\[resourceGroup\]/g, resourceGroupName)
                .replace(/\[appName\]/g, resourcePrefix + '-app')
                .replace(/\[aspName\]/g, resourcePrefix + '-env')
                .replace(/\[redisHost\]/g, redisName + '.redis.cache.windows.net')
                .replace(/\[redisPass\]/g, redisKey)
            );
            fs.writeFileSync('sample/tool/winae-core.ps1', fs.readFileSync('script/winae-core.ps1', 'utf8'));
            // Prepare Folders
            const serviceClient = new ShareServiceClient(
                'https://' + storageAccountName + '.file.core.windows.net',
                new StorageSharedKeyCredential(storageAccountName, storageAccountKey)
            );
            const shareClient = serviceClient.getShareClient('winae-file');
            var directoryClient = null;
            directoryClient = shareClient.getDirectoryClient('media');
            await directoryClient.create();
            directoryClient = shareClient.getDirectoryClient('media/sample-3m-azapp');
            await directoryClient.create();
            directoryClient = shareClient.getDirectoryClient('output');
            await directoryClient.create();
            directoryClient = shareClient.getDirectoryClient('project');
            await directoryClient.create();
            directoryClient = shareClient.getDirectoryClient('temp');
            await directoryClient.create();
            directoryClient = shareClient.getDirectoryClient('tool');
            await directoryClient.create();
            // Upload Files
            fileClient = new ShareFileClient(
                'https://' + storageAccountName + '.file.core.windows.net/winae-file/' + 'media/sample-3m-azapp/55e6df79-d0cd-4b5f-8aad-2c66a57ce281.jpeg',
                new StorageSharedKeyCredential(storageAccountName, storageAccountKey)
            );
            await fileClient.uploadFile('sample/media/sample-3m-azapp/55e6df79-d0cd-4b5f-8aad-2c66a57ce281.jpeg');
            fileClient = new ShareFileClient(
                'https://' + storageAccountName + '.file.core.windows.net/winae-file/' + 'media/sample-3m-azapp/55e6df79-d0cd-4b5f-8aad-2c66a57ce281.mp3',
                new StorageSharedKeyCredential(storageAccountName, storageAccountKey)
            );
            await fileClient.uploadFile('sample/media/sample-3m-azapp/55e6df79-d0cd-4b5f-8aad-2c66a57ce281.mp3');
            fileClient = new ShareFileClient(
                'https://' + storageAccountName + '.file.core.windows.net/winae-file/' + 'temp/sample-3m-azapp___EP___4536.aepx',
                new StorageSharedKeyCredential(storageAccountName, storageAccountKey)
            );
            await fileClient.uploadFile('sample/temp/sample-3m-azapp___EP___4536.aepx');
            fileClient = new ShareFileClient(
                'https://' + storageAccountName + '.file.core.windows.net/winae-file/' + 'tool/winae-core.ps1',
                new StorageSharedKeyCredential(storageAccountName, storageAccountKey)
            );
            await fileClient.uploadFile('sample/tool/winae-core.ps1');
            fileClient = new ShareFileClient(
                'https://' + storageAccountName + '.file.core.windows.net/winae-file/' + 'tool/winae.ps1',
                new StorageSharedKeyCredential(storageAccountName, storageAccountKey)
            );
            await fileClient.uploadFile('sample/tool/winae.ps1');
        }
        // Image
        var finalRepoName = "";
        var finalTagName = "";
        // Ger Azure Resources
        accessToken = await getAccessToken();
        subscriptionId = await getSubscriptionId(accessToken);
        resourceGroupName = await getResourceGroupName(accessToken, subscriptionId);
        // Get latest image from ACR
        let registryToken = "";
        const registryName = resourcePrefix.replace('-', '') + 'cr';
        const registryKey = await getRegistryKey(accessToken, subscriptionId, resourceGroupName, registryName);
        registryToken = await getRegistryToken(registryName, registryKey, registryName, 'registry:catalog:*');
        const repoName = await getRepoFromRegistry(registryToken, registryName);
        if (repoName.length > 0) {
            finalRepoName = repoName[0];
            registryToken = await getRegistryToken(registryName, registryKey, registryName, 'repository:' + finalRepoName + ':pull');
            const tagName = await getTagFromRepo(registryToken, registryName, finalRepoName);
            if (tagName.length > 0) {
                finalTagName = tagName[0].name;
            }
        }
        let render = false;
        let imageupd = false;
        if (process.env["WINAE_IMAGE"]) {
            render = true;
            // finalRepoName and finalTagName must not empty
            if (process.env["WINAE_IMAGE"] != registryName + '.azurecr.io/' + finalRepoName + ':' + finalTagName) imageupd = true;
        } else {
            if (finalRepoName != "" && finalTagName != "") {
                render = true;
                imageupd = true;
            }
        }
        if (imageupd) {
            process.env["WINAE_IMAGE"] = registryName + '.azurecr.io/' + finalRepoName + ':' + finalTagName;
            functionAppName = resourcePrefix + '-func';
            appSettings = await getAppSettings(accessToken, subscriptionId, resourceGroupName, functionAppName);
            appSettings.WINAE_IMAGE = registryName + '.azurecr.io/' + finalRepoName + ':' + finalTagName;
            await setAppSettings(accessToken, subscriptionId, resourceGroupName, functionAppName, appSettings);
        }
        let resBody = "";
        let resCookie = [];
        if (render) {
            const cookie = cookieParser(request.headers.get('cookie'));
            let connectionString = "Put the Startup script here (copied from step 2-07)";
            if (cookie['connection_string']) {
                connectionString = cookie['connection_string'];
            }
            resBody = fs.readFileSync('src/templates/render.html', 'utf8')
                .replace(/\[CONNSTR\]/g, connectionString)
                ;
        } else {
            resBody = fs.readFileSync('src/templates/readme.html', 'utf8')
                .replace(/\[ACR_NAME\]/g, registryName)
                .replace(/\[ACR_KEY\]/g, registryKey)
                .replace(/\[TAG_NAME\]/g, getTodayTag())
                ;
        }
        return {
            statusCode: 200,
            isBase64Encoded: false,
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            },
            body: resBody,
            cookies: resCookie
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
function setAppSettings(accessToken, subscriptionId, resourceGroupName, functionAppName, appSettings) {
    var options = {
        'method': 'PUT',
        'url': 'https://management.azure.com/subscriptions/' + subscriptionId + '/resourceGroups/' + resourceGroupName + '/providers/Microsoft.Web/sites/' + functionAppName + '/config/appsettings?api-version=2022-03-01',
        'headers': {
            'Authorization': 'Bearer ' + accessToken,
            'Content-type': 'application/json'
        },
        body: '{"properties": ' + JSON.stringify(appSettings) + '}'
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).properties);
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
function getRegistryToken(registryUser, registryPass, registryName, registryScope) {
    const auth = Buffer.from(registryUser + ':' + registryPass).toString('base64');
    var options = {
        'method': 'GET',
        'url': 'https://' + registryName + '.azurecr.io/oauth2/token?service=' + registryName + '.azurecr.io&scope=' + encodeURIComponent(registryScope),
        'headers': {
            'Authorization': 'Basic ' + auth
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).access_token);
        });
    });
}
function getRepoFromRegistry(registryToken, registryName) {
    var options = {
        'method': 'GET',
        'url': 'https://' + registryName + '.azurecr.io/acr/v1/_catalog',
        'headers': {
            'Authorization': 'Bearer ' + registryToken
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).repositories || []);
        });
    });
}
function getTagFromRepo(registryToken, registryName, repoName) {
    var options = {
        'method': 'GET',
        'url': 'https://' + registryName + '.azurecr.io/acr/v1/' + repoName + '/_tags?orderby=timedesc&n=1',
        'headers': {
            'Authorization': 'Bearer ' + registryToken
        }
    };
    return new Promise(function (resolve, reject) {
        req(options, function (error, response) {
            if (error) reject(new Error(error));
            resolve(JSON.parse(response.body).tags || []);
        });
    });
}
function getTodayTag() {
    const date = new Date();
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).substr(-2);
    const day = ('0' + date.getDate()).substr(-2);
    const dateStr = [year, month, day].join('');
    return dateStr;
}
function cookieParser(cookieString) {
    if (cookieString === "") return {};
    let pairs = cookieString.split(";");
    let splittedPairs = pairs.map(cookie => cookie.split("="));
    const cookieObj = splittedPairs.reduce(function (obj, cookie) {
        obj[decodeURIComponent(cookie[0].trim())] = decodeURIComponent(cookie[1].trim());
        return obj;
    }, {})
    return cookieObj;
}