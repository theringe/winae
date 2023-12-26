# WINAE: a Windows based containerized Adobe After Effects renderer

---------------


### Related Blog

Cloud Rendering Adobe After Effects Video with Windows Docker Container

https://mohohan.com/393

---------------

### Prerequisite

| Item | Detail |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| Host Machine / OS | Hardware configuration requires at least a 4-core processor and 8GB of memory. The operating system must be Windows 10/11 and a 64-bit operating system. |
| Software | Installed Docker Desktop Windows |
| Software (Optional) | Installed Adobe After Effects 2022 Must have a genuine license |
| Software | Adobe After Effects Installer Package Must have a genuine license |
| Software (Optional) | Rowbyte Plexus Plugin Must have a genuine license |
| Cloud Platform | Azure account with a subscription |

---------------

### How to use

1. In your Azure subscription: Create a Storage Account and a File Share. Then copy the Account Name, Account Key, and File Share.
2. In your developing environment: Clone this repo. Then copy the file named winae.ps1 (from project root).
3. In your Azure subscription: Paste winae.ps1 into File Share (to root folder).
4. In your Adobe Admin Console https://adminconsole.adobe.com/ : Prepare the installation package (e.g., AE_en_US_WIN_64.zip). Then put it into the project root.
5. In your developing environment: Open Dockerfile (from project root) with text editor, modify the plugin section to fulfill your scenario, and modify the final section specifying Account Name, Account Key, and File Share.
6. <TBA> ACR