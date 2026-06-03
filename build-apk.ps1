# Builds the Fitty debug APK for a physical Android phone.
# Usage (from repo root):  powershell -ExecutionPolicy Bypass -File build-apk.ps1
#
# Requires the local toolchain set up under D:\dev-tools:
#   - D:\dev-tools\jdk21          (Temurin JDK 21)
#   - D:\dev-tools\android-sdk    (platform-tools, platforms;android-36, build-tools;36.0.0)
# These are kept outside the repo and separate from the system JDK.

$ErrorActionPreference = 'Stop'

$env:JAVA_HOME        = 'D:\dev-tools\jdk21'
$env:ANDROID_HOME     = 'D:\dev-tools\android-sdk'
$env:ANDROID_SDK_ROOT = 'D:\dev-tools\android-sdk'

Write-Host '[1/3] Building web app (vite)...' -ForegroundColor Cyan
npm run build

Write-Host '[2/3] Syncing web assets into the Android project...' -ForegroundColor Cyan
npx cap sync android

Write-Host '[3/3] Assembling debug APK (gradle)...' -ForegroundColor Cyan
& "$PSScriptRoot\android\gradlew.bat" -p "$PSScriptRoot\android" assembleDebug --no-daemon

$apk = "$PSScriptRoot\android\app\build\outputs\apk\debug\app-debug.apk"
$dest = "$PSScriptRoot\Fitty-debug.apk"
Copy-Item $apk $dest -Force
$size = [math]::Round((Get-Item $dest).Length / 1MB, 1)
Write-Host ""
Write-Host "Done. APK ready: $dest ($size MB)" -ForegroundColor Green
Write-Host "Copy it to your phone and tap to install (enable 'Install unknown apps')." -ForegroundColor Green
