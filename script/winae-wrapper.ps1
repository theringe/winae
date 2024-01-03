# Mount Storage Account
# AppService only enable A/B Drives to mount
$secpasswd = ConvertTo-SecureString '<YOUR_ACCOUNT_KEY_HERE>' -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential('localhost\<YOUR_ACCOUNT_NAME_HERE>', $secpasswd)
New-PSDrive -Name A -PSProvider FileSystem -Root "\\<YOUR_ACCOUNT_NAME_HERE>.file.core.windows.net\<YOUR_FILE_SHARE_HERE>" -Persist -Credential $cred -Scope Global
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Business Logic Wrapper
# AppService use Hyper-V such that stdout could not be catch for app log, and startup command in Dockerfile will be override, please use startup command instead.
#     powershell.exe C:/Users/ContainerAdministrator/winae-wrapper.ps1
# PSDrive mount is session oriented, so we cannot go to A drive from our login (either SSH or console).
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
A:/tool/winae.ps1

