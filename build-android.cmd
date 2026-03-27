@echo off
setlocal

set "EXIT_CODE=0"
set "ROOT=%~dp0"
set "MODE=%~1"
if "%MODE%"=="" set "MODE=release"

if /I "%MODE%"=="debug" set "TASKS=assembleDebug"
if /I "%MODE%"=="release" set "TASKS=assembleRelease bundleRelease"
if /I "%MODE%"=="bundle" set "TASKS=bundleRelease"
if /I "%MODE%"=="all" set "TASKS=assembleDebug assembleRelease bundleRelease"

if not defined TASKS goto :usage

for /d %%D in ("%ROOT%jdk-17\*") do (
  if exist "%%~fD\bin\java.exe" (
    set "JAVA_HOME=%%~fD"
    goto :java_found
  )
)

:java_found
if not defined JAVA_HOME (
  echo Bundled JDK not found in "%ROOT%jdk-17".
  set "EXIT_CODE=1"
  goto :end
)

if not exist "%ROOT%android-sdk\platforms" (
  echo Android SDK not found in "%ROOT%android-sdk".
  set "EXIT_CODE=1"
  goto :end
)

set "ANDROID_HOME=%ROOT%android-sdk"
set "ANDROID_SDK_ROOT=%ROOT%android-sdk"
set "GRADLE_USER_HOME=%ROOT%twa\.gradle-cache"
set "PATH=%JAVA_HOME%\bin;%PATH%"

if not defined BEKNALAH_KEYSTORE_FILE set "BEKNALAH_KEYSTORE_FILE=%ROOT%keystore\beknalah-release.jks"
if not defined BEKNALAH_KEY_ALIAS set "BEKNALAH_KEY_ALIAS=beknalah"
if not defined BEKNALAH_KEYSTORE_PASSWORD if defined BUBBLEWRAP_KEYSTORE_PASSWORD set "BEKNALAH_KEYSTORE_PASSWORD=%BUBBLEWRAP_KEYSTORE_PASSWORD%"
if not defined BEKNALAH_KEY_PASSWORD if defined BUBBLEWRAP_KEY_PASSWORD (
  set "BEKNALAH_KEY_PASSWORD=%BUBBLEWRAP_KEY_PASSWORD%"
) else if defined BEKNALAH_KEYSTORE_PASSWORD (
  set "BEKNALAH_KEY_PASSWORD=%BEKNALAH_KEYSTORE_PASSWORD%"
)

if /I not "%MODE%"=="debug" (
  if not exist "%BEKNALAH_KEYSTORE_FILE%" (
    echo Release keystore not found: "%BEKNALAH_KEYSTORE_FILE%"
    set "EXIT_CODE=1"
    goto :end
  )
  if not defined BEKNALAH_KEYSTORE_PASSWORD (
    echo Set BEKNALAH_KEYSTORE_PASSWORD or BUBBLEWRAP_KEYSTORE_PASSWORD before running a release build.
    set "EXIT_CODE=1"
    goto :end
  )
  if not defined BEKNALAH_KEY_PASSWORD (
    echo Set BEKNALAH_KEY_PASSWORD or BUBBLEWRAP_KEY_PASSWORD before running a release build.
    set "EXIT_CODE=1"
    goto :end
  )
)

echo Building Android app in %MODE% mode...
echo Using JAVA_HOME=%JAVA_HOME%
echo Using ANDROID_HOME=%ANDROID_HOME%

pushd "%ROOT%twa"
call gradlew.bat %TASKS% --console=plain --no-daemon
set "BUILD_EXIT=%ERRORLEVEL%"
popd

if not "%BUILD_EXIT%"=="0" (
  set "EXIT_CODE=%BUILD_EXIT%"
  goto :end
)

echo.
if exist "%ROOT%twa\app\build\outputs\apk\debug\app-debug.apk" (
  echo Debug APK: %ROOT%twa\app\build\outputs\apk\debug\app-debug.apk
)
if exist "%ROOT%twa\app\build\outputs\apk\release\app-release.apk" (
  echo Release APK: %ROOT%twa\app\build\outputs\apk\release\app-release.apk
)
if exist "%ROOT%twa\app\build\outputs\bundle\release\app-release.aab" (
  echo Release AAB: %ROOT%twa\app\build\outputs\bundle\release\app-release.aab
)
goto :end

:usage
echo Usage: build-android.cmd [debug^|release^|bundle^|all]
set "EXIT_CODE=1"

:end
endlocal & exit /b %EXIT_CODE%
