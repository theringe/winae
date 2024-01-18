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
$deleteLock = 1; # 1: lock (and ignore $deleteRound), 0: unlock (all resources will be deleted)
$deleteRound = 50;
:base while (1) {
    . ($PSScriptRoot + "\winae-core.ps1");
    winae $aadClientId $aadTenantId $aadSecretId $subscriptionId $resourceGroup $appName $aspName $redisHost $redisPort $redisPass $redisPrefix;
    # Delete logic
    if ($deleteLock -eq 0) {
        continue base;
    }
    if ($deleteRound -gt 0) {
        $deleteRound--;
    } else {
        # Get access token
        $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]";
        $headers.Add("Content-Type", "application/x-www-form-urlencoded");
        $body = "client_id=$aadClientId&client_secret=$aadSecretId&grant_type=client_credentials&scope=https%3A%2F%2Fmanagement.azure.com%2F.default";
        $response = Invoke-RestMethod "https://login.microsoftonline.com/$aadTenantId/oauth2/v2.0/token" -Method 'POST' -Headers $headers -Body $body;
        $access_token = $response.access_token;
        Write-Output "=============================";
        # Delete APP
        Write-Output "Delete APP";
        $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
        $headers.Add("Authorization", "Bearer $access_token");
        $response = Invoke-RestMethod "https://management.azure.com/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Web/sites/${appName}?api-version=2022-03-01" -Method 'DELETE' -Headers $headers
        # Delete ASP (Logic issue, ASP could not be deleted after APP has been deleted, but it is ok here)
        Write-Output "Delete ASP";
        $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
        $headers.Add("Authorization", "Bearer $access_token");
        $response = Invoke-RestMethod "https://management.azure.com/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Web/serverfarms/${aspName}?api-version=2022-03-01" -Method 'DELETE' -Headers $headers
        break base;
    }
}
