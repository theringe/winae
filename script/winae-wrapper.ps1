# Specify your encryption key (or use this default one)
$key = "R2W8WuO2iJvtxecwAjED1ItRUtr54jzQw8YRN+pzL9A=";

# Parse ConnString
function Create-AesManagedObject($key, $IV, $mode) {
    $aesManaged = New-Object "System.Security.Cryptography.AesManaged";
    if ($mode="CBC") { $aesManaged.Mode = [System.Security.Cryptography.CipherMode]::CBC }
    elseif ($mode="CFB") {$aesManaged.Mode = [System.Security.Cryptography.CipherMode]::CFB}
    elseif ($mode="CTS") {$aesManaged.Mode = [System.Security.Cryptography.CipherMode]::CTS}
    elseif ($mode="ECB") {$aesManaged.Mode = [System.Security.Cryptography.CipherMode]::ECB}
    elseif ($mode="OFB"){$aesManaged.Mode = [System.Security.Cryptography.CipherMode]::OFB}
    $aesManaged.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7;
    $aesManaged.BlockSize = 128;
    $aesManaged.KeySize = 256;
    if ($IV) {
        if ($IV.getType().Name -eq "String") {
            $aesManaged.IV = [System.Convert]::FromBase64String($IV);
        } else {
            $aesManaged.IV = $IV;
        }
    }
    if ($key) {
        if ($key.getType().Name -eq "String") {
            $aesManaged.Key = [System.Convert]::FromBase64String($key);
        } else {
            $aesManaged.Key = $key;
        }
    }
    $aesManaged;
}
function Decrypt-String($key, $encryptedStringWithIV) {
    $bytes = [System.Convert]::FromBase64String($encryptedStringWithIV);
    $IV = $bytes[0..15];
    $aesManaged = Create-AesManagedObject $key $IV;
    $decryptor = $aesManaged.CreateDecryptor();
    $unencryptedData = $decryptor.TransformFinalBlock($bytes, 16, $bytes.Length - 16);
    $aesManaged.Dispose();
    [System.Text.Encoding]::UTF8.GetString($unencryptedData).Trim([char]0);
}
$mydec = Decrypt-String $key $Args[0];
$mydec = $mydec.Split("|");
$username = $mydec[0];
$password = $mydec[1];

# Mount Storage Account
# AppService only enable A/B Drives to mount
$secpasswd = ConvertTo-SecureString $password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential("localhost\${username}", $secpasswd)
New-PSDrive -Name A -PSProvider FileSystem -Root "\\${username}.file.core.windows.net\winae-file" -Persist -Credential $cred -Scope Global
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Business Logic Wrapper
# AppService use Hyper-V such that stdout could not be catch for app log, and startup command in Dockerfile will be override, please use startup command instead.
#     powershell.exe C:/Users/ContainerAdministrator/winae-wrapper.ps1 [encryption]
# PSDrive mount is session oriented, so we cannot go to A drive from our login (either SSH or console).
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
A:/tool/winae.ps1

