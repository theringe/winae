# Business Logic

$interval = 1; # Specify the polling interval in seconds
$maxMachineCount = 10; # Specify with AppService Plan
$taskFrame = 54000; # Specify the frame count of the task (e.g., 30minutes * 60seconds * 30frames = 54000)
$redisHost = "";
$redisPort = 6379;
$redisPass = "";
$storageBase = "A:"; # Specify the storage base path (e.g., A:)
$redisExec = "$storageBase\redis-cli.exe";
$redisPrefix = "azapp:";
$aadClientId = "";
$aadTenantId = "";
$aadSecretId = "";
$subscriptionId = "";
$resourceGroup = "";
$appName = "";
$aspName = "";
$aeExec = "C:\Program` Files\Adobe\Adobe` After` Effects` 2022\Support` Files\aerender.exe";
$ffmpegExec = "$storageBase\ffmpeg.exe";
$debug = 0;
:base while(1) {
    # 1. Polling interval
    Start-Sleep -Seconds $interval;
    Write-Output "=============================";
    Write-Output "STEP 1: Polling interval";
    # 2. Project to task
    Write-Output "=============================";
    Write-Output "STEP 2: Project to task";
    $projectFiles = Get-ChildItem -Path "$storageBase\project" -Filter "*.aep*";
    :step2 foreach ($projectFile in $projectFiles) {
        Write-Output "-----------------------------";
        $projectFileName = $projectFile.Name;
        $projectFileName = $projectFileName.Split("___");
        # remove empty element from projectFileName (ps1)
        $projectFileName = $projectFileName | Where-Object { $_ -ne "" }
        $projectName = $projectFileName[0];
        $canvasName = $projectFileName[1];
        $frameCount = $projectFileName[2].Split(".")[0];
        $fileExt = $projectFileName[2].Split(".")[1];
        Write-Output "Verify project file naming: $projectFileName : is [${frameCount}] a number?";
        if ($frameCount -as [int]) {
            Write-Output "- Pass";
        } else {
            Write-Output "- Fail, skip this one (maybe it is a DONE file))";
            continue step2;
        }
        Write-Output "Checking if project is already in the redis: $projectName";
        $projectKey = "${redisPrefix}project:" + $projectName;
        $res = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass exists $projectKey;
        if ($res -eq 1) {
            Write-Output "- Exist, skip";
        } else {
            Write-Output "- No exist, add to redis";
            Write-Output "STEP 2.1: Add key to redis and prevent other machine to add the same key";
            $res = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass setnx $projectKey $frameCount;
            if ($res -eq 1) {
                Write-Output "- Done";
            } else {
                Write-Output "- Fail, skip";
                continue step2;
            }
            Write-Output "STEP 2.2: Calculate and dispatch tasks";
            $taskCount = [math]::Ceiling($frameCount / $taskFrame);
            $res = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass set $projectKey "${taskCount}:${canvasName}:${frameCount}:${fileExt}";
            for ($i = 0; $i -lt $taskCount; $i++) {
                $taskKey = "${redisPrefix}task:p:" + ($i + 1).ToString() + ":" + $projectName;
                $taskStart = $i * $taskFrame;
                $taskEnd = ($i + 1) * $taskFrame - 1;
                if ($taskEnd -gt $frameCount) {
                    $taskEnd = $frameCount - 1;
                }
                $taskIndex = ($i + 1).ToString().PadLeft(3, '0');
                $taskValue = $canvasName + ":" + $taskStart.ToString() + ":" + $taskEnd.ToString() + ":" + $taskIndex + ":" + $frameCount + ":" + $fileExt;
                $res = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass set $taskKey $taskValue;
            }
        }
    }
    # 3. Task to machine
    Write-Output "=============================";
    Write-Output "STEP 3: Task to machine";
    # Get access token
    $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]";
    $headers.Add("Content-Type", "application/x-www-form-urlencoded");
    $body = "client_id=$aadClientId&client_secret=$aadSecretId&grant_type=client_credentials&scope=https%3A%2F%2Fmanagement.azure.com%2F.default";
    $response = Invoke-RestMethod "https://login.microsoftonline.com/$aadTenantId/oauth2/v2.0/token" -Method 'POST' -Headers $headers -Body $body;
    $access_token = $response.access_token;
    # Retrieve ASP current worker count
    Write-Output "Retrieve ASP current worker count";
    $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
    $headers.Add("Authorization", "Bearer $access_token");
    $response = Invoke-RestMethod "https://management.azure.com/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Web/serverfarms/${aspName}?api-version=2022-03-01" -Method 'GET' -Headers $headers
    $currentWorkerCount = $response.sku.capacity;
    if ($currentWorkerCount -as [int]) {
        Write-Output "- Pass";
    } else {
        Write-Output "- Glitch, set to 1";
        $currentWorkerCount = 1;
    }
    Write-Output "current worker count: $currentWorkerCount";
    # Retrieve running task count
    Write-Output "Retrieve running task count";
    $runningTaskCount = (& $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass keys ${redisPrefix}task:r:*).Length;
    Write-Output "running task count: $runningTaskCount";
    # Retrieve pending task count
    Write-Output "Retrieve pending task count";
    $pendingTaskCount = (& $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass keys ${redisPrefix}task:p:*).Length;
    Write-Output "pending task count: $pendingTaskCount";
    # Scale Comparing Logic
    Write-Output "Scale Comparing logic:";
    if ($runningTaskCount + $pendingTaskCount -lt $currentWorkerCount) {
        # Scale in
        $scaleCount = $runningTaskCount + $pendingTaskCount;
        if ($scaleCount -eq 0) {
            $scaleCount = 1;
        }
        if ($debug -eq 1) {
            $scaleCount = 1; # For testing
        }
        Write-Output "scale in: $currentWorkerCount to $scaleCount";
        # ASP
        $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]";
        $headers.Add("Authorization", "Bearer $access_token");
        $headers.Add("Content-type", "application/json");
        $body = "{`"sku`": {`"name`": `"P2v3`"}, `"properties`": {`"numberOfWorkers`": $scaleCount}}";
        $response = Invoke-RestMethod "https://management.azure.com/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Web/serverfarms/${aspName}?api-version=2022-03-01" -Method 'PATCH' -Headers $headers -Body $body;
        # APP
        $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]";
        $headers.Add("Authorization", "Bearer $access_token");
        $headers.Add("Content-type", "application/json");
        $body = "{`"properties`": {`"siteConfig`": {`"numberOfWorkers`": $scaleCount}}}";
        $response = Invoke-RestMethod "https://management.azure.com/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Web/sites/${appName}?api-version=2022-03-01" -Method 'PATCH' -Headers $headers -Body $body;
    } elseif ($runningTaskCount + $pendingTaskCount -eq $currentWorkerCount) {
        # Do nothing
        Write-Output "do nothing";
    } else {
        # Scale out in condition
        if ([math]::Ceiling($runningTaskCount / 2) + $pendingTaskCount -le $currentWorkerCount) {
            Write-Output "do nothing under scale out in condition";
        } else {
            $scaleCount = [math]::Ceiling($runningTaskCount / 2) + $pendingTaskCount;
            if ($scaleCount -gt $maxMachineCount) {
                $scaleCount = $maxMachineCount;
            }
            if ($debug -eq 1) {
                $scaleCount = 1; # For testing
            }
            Write-Output "scale out: $currentWorkerCount to $scaleCount";
            # ASP
            $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]";
            $headers.Add("Authorization", "Bearer $access_token");
            $headers.Add("Content-type", "application/json");
            $body = "{`"sku`": {`"name`": `"P2v3`"}, `"properties`": {`"numberOfWorkers`": $scaleCount}}";
            $response = Invoke-RestMethod "https://management.azure.com/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Web/serverfarms/${aspName}?api-version=2022-03-01" -Method 'PATCH' -Headers $headers -Body $body;
            # APP
            $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]";
            $headers.Add("Authorization", "Bearer $access_token");
            $headers.Add("Content-type", "application/json");
            $body = "{`"properties`": {`"siteConfig`": {`"numberOfWorkers`": $scaleCount}}}";
            $response = Invoke-RestMethod "https://management.azure.com/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Web/sites/${appName}?api-version=2022-03-01" -Method 'PATCH' -Headers $headers -Body $body;  
        }
    }
    # 4. Handling tasks
    Write-Output "=============================";
    Write-Output "STEP 4: Handling tasks";
    $pendingTasks = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass keys ${redisPrefix}task:p:*;
    if ($pendingTasks.Length -eq 0) {
        Write-Output "- No pending task, skip";
        continue base;
    } else {
        foreach ($pendingTaskKey in $pendingTasks) {
            Write-Output "-----------------------------";
            Write-Output "STEP 4.1: Add key to redis and prevent other machine to add the same key";
            $pendingTaskValue = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass get $pendingTaskKey;
            $epoch = Get-Date -UFormat %s;
            $projectName = $pendingTaskKey.Split(":")[4];
            $runningTaskKey = "${redisPrefix}task:r:" + $epoch.ToString() + ":" + $projectName;
            $res = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass setnx $runningTaskKey $pendingTaskValue;
            if ($res -eq 1) {
                Write-Output "- Done";
            } else {
                Write-Output "- Fail, skip";
                continue base;
            }
            Write-Output "STEP 4.2: Delete pending task key";
            $res = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass del $pendingTaskKey;
            Write-Output "STEP 4.3: Start task";
            $taskValue = $pendingTaskValue.Split(":");
            $canvasName = $taskValue[0];
            $taskStart = $taskValue[1];
            $taskEnd = $taskValue[2];
            $taskIndex = $taskValue[3];
            $frameCount = $taskValue[4];
            $fileExt = $taskValue[5];
            $projectFileName = "${projectName}___${canvasName}___${frameCount}.${fileExt}";
            # Launch AE (-mfr ON 90 -mem_usage 90 90)
            & $aeExec -project "${storageBase}\project\${projectFileName}" -comp "$canvasName" -output "${storageBase}\temp\${projectName}_${taskIndex}.mov" -s $taskStart -e $taskEnd;
            # delte running task key
            $res = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass del $runningTaskKey;
        }    
    }
    # 5. Remove project file and key, combine video
    Write-Output "=============================";
    Write-Output "STEP 5: Remove project file and key, combine video";
    $projects = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass keys ${redisPrefix}project:*;
    :step5 foreach ($projectKey in $projects) {
        # Check if all tasks are done
        Write-Output "-----------------------------";
        Write-Output "Check if all tasks are done";
        $projectName = $projectKey.Split(":")[2];
        $tasks = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass keys ${redisPrefix}task:*:*:$projectName;
        $taskCount = $tasks.Length;
        if ($taskCount -eq 0) {
            Write-Output "- No task, done";
            Write-Output "STEP 5.1: Delete project key";
            $projectValue = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass get $projectKey;
            $projectValue = $projectValue.Split(":");
            $taskCount = $projectValue[0];
            $canvasName = $projectValue[1];
            $frameCount = $projectValue[2];
            $fileExt = $projectValue[3];
            $res = & $redisExec --no-auth-warning -h $redisHost -p $redisPort -a $redisPass del $projectKey;
            if ($res -eq 1) {
                Write-Output "- Done";
            } else {
                Write-Output "- Fail, skip";
                continue step5;
            }
            $projectFileName = "${projectName}___${canvasName}___${frameCount}.${fileExt}";
            $projectFile = "${storageBase}\project\${projectFileName}";
            $projectDoneFileName = "${projectName}___${canvasName}___DONE.${fileExt}";
            $projectDoneFile = "${storageBase}\project\${projectDoneFileName}";
            Rename-Item -Path $projectFile -NewName $projectDoneFile;
            Write-Output "STEP 5.2: Combine video";
            $videoFiles = Get-ChildItem -Path "${storageBase}\temp" -Filter "${projectName}_*.mov";
            $videoFiles = $videoFiles | Sort-Object -Property Name;
            $videoFileNames = $videoFiles.Name;
            $videoFileNames = $videoFileNames | ForEach-Object { "file ${storageBase}\temp\${_}" };
            $videoFileNames = $videoFileNames -replace '\\', '/';
            $videoFileNames | Out-File -FilePath "${storageBase}\temp\${projectName}.txt";
            $res = & $ffmpegExec -y -safe 0 -f concat -i ${storageBase}\temp\${projectName}.txt -vcodec copy -acodec copy ${storageBase}\output\${projectName}.mov;
            $videoFiles = Get-ChildItem -Path "${storageBase}\temp" -Filter "${projectName}_*.mov";
            foreach ($videoFile in $videoFiles) {
                Remove-Item -Path $videoFile.FullName;
            }
            Remove-Item -Path "${storageBase}\temp\${projectName}.txt";
            $logFolder = "${storageBase}\project\${projectFileName} Logs";
            if (Test-Path $logFolder) {
                Remove-Item -Path $logFolder -Recurse;
            }
        } else {
            Write-Output "- Task exist, skip";
            continue step5;
        }
    }
}
