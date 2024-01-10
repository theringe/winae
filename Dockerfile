# WINAE: a Windows based containerized Adobe After Effects renderer
FROM mcr.microsoft.com/windows/server:10.0.20348.1726
LABEL maintainer="ringe.chen@microsoft.com"

# Default PS1
SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

# Install Choco
COPY aepack/install-choco.ps1 install-choco.ps1
RUN Set-ExecutionPolicy Bypass -Scope Process -Force; \
    ./install-choco.ps1 ; \
    del ./install-choco.ps1

# Install Common Tools through Choco (ffmpeg redis are must)
RUN choco install -y unzip vim ntop.portable azcopy10 ffmpeg redis

# Install Adobe After Effects
COPY aepack/AE_en_US_WIN_64.zip AE_en_US_WIN_64.zip
RUN Set-ExecutionPolicy Bypass -Scope Process -Force; \
    move "AE_en_US_WIN_64.zip" "C:\Users\ContainerAdministrator" ; \
    cd "C:\Users\ContainerAdministrator" ; \
    unzip AE_en_US_WIN_64.zip ; \
    cd AE ; \
    cd Build ; \
    cmd.exe /C "setup.exe --silent --INSTALLLANGUAGE=en_US" ; \
    cd "C:\Users\ContainerAdministrator" ; \
    del AE_en_US_WIN_64.zip ; \
    rm -r AE

# Create symbolic link for aerender.exe and start render node
RUN Set-ExecutionPolicy Bypass -Scope Process -Force; \
    New-Item -ItemType SymbolicLink -Path "C:\Users\ContainerAdministrator\AE" -Target "C:\Program` Files\Adobe\Adobe` After` Effects` 2022\Support` Files"; \
    New-Item -Path "C:\Users\All` Users\Documents" -Name "ae_render_only_node.txt" -ItemType File

# Install Plugin: Rowbyte Plexus
COPY aepack/Rowbyte.zip Rowbyte.zip
RUN Set-ExecutionPolicy Bypass -Scope Process -Force; \
    move "Rowbyte.zip" "C:\Program` Files\Adobe\Adobe` After` Effects` 2022\Support` Files\Plug-ins" ; \
    cd "C:\Program` Files\Adobe\Adobe` After` Effects` 2022\Support` Files\Plug-ins" ; \
    unzip "Rowbyte.zip" ; \
    del "Rowbyte.zip"

# Register Plugin: Rowbyte Plexus
COPY aepack/RWBYTE.zip RWBYTE.zip
RUN Set-ExecutionPolicy Bypass -Scope Process -Force; \
    move "RWBYTE.zip" "C:\Users\All` Users" ; \
    cd "C:\Users\All` Users" ; \
    unzip "RWBYTE.zip" ; \
    del "RWBYTE.zip"

# Mount File Share from Storage Account and Launch
COPY script/winae-wrapper.ps1 C:/Users/ContainerAdministrator/winae-wrapper.ps1
CMD C:/Users/ContainerAdministrator/winae-wrapper.ps1
