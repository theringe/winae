# Credentials
$aadClientId = "[aadClientId]";
$aadTenantId = "[aadTenantId]";
$aadSecretId = "[aadSecretId]";
# Information from this Application
$subscriptionId = "[subscriptionId]";
$resourceGroup = "[resourceGroup]";
$appName = "[appName]";
$aspName = "[aspName]";
$redisHost = "[redisHost]";
$redisPort = 6379;
$redisPass = "[redisPass]";
$redisPrefix = "azapp:";
:base while (1) {
    . ($PSScriptRoot + "\winae-core.ps1");
    winae $aadClientId $aadTenantId $aadSecretId $subscriptionId $resourceGroup $appName $aspName $redisHost $redisPort $redisPass $redisPrefix;
}
