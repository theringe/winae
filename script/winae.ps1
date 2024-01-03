# Credentials
$aadClientId = "";
$aadTenantId = "";
$aadSecretId = "";
# Information from this Application
$subscriptionId = "";
$resourceGroup = "";
$appName = "";
$aspName = "";
$redisHost = "";
$redisPort = 6379;
$redisPass = "";
$redisPrefix = "azapp:";
:base while (1) {
    . ($PSScriptRoot + "\winae-core.ps1");
    winae $aadClientId $aadTenantId $aadSecretId $subscriptionId $resourceGroup $appName $aspName $redisHost $redisPort $redisPass $redisPrefix;
}
