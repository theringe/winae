# WINAE: a Windows based containerized Adobe After Effects renderer
FROM mcr.microsoft.com/windows/server:10.0.20348.1726
LABEL maintainer="ringe.chen@microsoft.com"

# Default PS1
SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

# Install Choco
COPY install-choco.ps1 install-choco.ps1
RUN Set-ExecutionPolicy Bypass -Scope Process -Force; \
    ./install-choco.ps1 ; \
    del ./install-choco.ps1

# Install Common Tools through Choco
RUN choco install -y unzip vim ntop.portable azcopy10

# Install Adobe After Effects
COPY AE_en_US_WIN_64.zip AE_en_US_WIN_64.zip
RUN Set-ExecutionPolicy Bypass -Scope Process -Force; \
    move "AE_en_US_WIN_64.zip" "C:\Users\ContainerAdministrator" ; \
    cd "C:\Users\ContainerAdministrator" ; \
    unzip AE_en_US_WIN_64.zip ; \
    cd AE ; \
    cd Build ; \
    cmd.exe /C "setup.exe --silent --INSTALLLANGUAGE=en_US" ; \
    cd "C:\Users\ContainerAdministrator" ; \
    del AE_en_US_WIN_64.zip

# Install Plugin: Rowbyte Plexus
COPY Rowbyte.zip Rowbyte.zip
RUN Set-ExecutionPolicy Bypass -Scope Process -Force; \
    move "Rowbyte.zip" "C:\Program` Files\Adobe\Adobe` After` Effects` 2022\Support` Files\Plug-ins" ; \
    cd "C:\Program` Files\Adobe\Adobe` After` Effects` 2022\Support` Files\Plug-ins" ; \
    unzip "Rowbyte.zip" ; \
    del "Rowbyte.zip"

# Register Plugin: Rowbyte Plexus
COPY RWBYTE.zip RWBYTE.zip
RUN Set-ExecutionPolicy Bypass -Scope Process -Force; \
    move "RWBYTE.zip" "C:\Users\All` Users" ; \
    cd "C:\Users\All` Users" ; \
    unzip "RWBYTE.zip" ; \
    del "RWBYTE.zip"

# Mount File Share from Storage Account and Launch
COPY winae-wrapper.ps1 C:/Users/ContainerAdministrator/winae-wrapper.ps1
CMD C:/Users/ContainerAdministrator/winae-wrapper.ps1
