@echo off
setlocal

for /d %%D in ("%~dp0jdk-17\*") do (
  if exist "%%~fD\bin\java.exe" (
    set "JAVA_HOME=%%~fD"
    goto :java_found
  )
)

:java_found
if exist "%~dp0android-sdk" (
  set "ANDROID_HOME=%~dp0android-sdk"
  set "ANDROID_SDK_ROOT=%~dp0android-sdk"
)
set "GRADLE_USER_HOME=%~dp0twa\.gradle-cache"
if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"
node "%~dp0health-check.mjs" %*
endlocal
