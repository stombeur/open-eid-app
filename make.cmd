@echo off
copy /y package.json "./win/resources/app/package.json"
copy /y open-eid.js "./win/resources/app/open-eid.js"
copy /y open-eid.css "./win/resources/app/open-eid.css"
copy /y open-eid.html "./win/resources/app/open-eid.html"
copy /y open-eid-read.html "./win/resources/app/open-eid-read.html"
copy /y loading.gif "./win/resources/app/loading.gif"
copy /y win\active-win.exe "./win/resources/app/active-win.exe"
copy /y node_modules\pkcs11js\index.js "./win/resources/node_modules/pkcs11js/index.js"
copy /y node_modules\pkcs11.win "./win/resources/node_modules/pkcs11js/build/Release/pkcs11.node"
cd win
7za u open-eid.7z open-eid.exe resources
copy /b 7zSD.sfx + config.txt + open-eid.7z "Open e-ID.exe"
copy /y "Open e-ID.exe" "%USERPROFILE%\Desktop\"
cd ..
pause