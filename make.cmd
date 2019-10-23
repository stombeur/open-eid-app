@echo off
net use X: \\VBOXSVR\michael
X:
cd \
cd Projets
cd e-id
cd open-eid-app
copy /y package.json "./win/resources/app/package.json"
copy /y open-eid.js "./win/resources/app/open-eid.js"
copy /y open-eid.html "./win/resources/app/open-eid.html"
copy /y open-eid-read.html "./win/resources/app/open-eid-read.html"
copy /y loading.gif "./win/resources/app/loading.gif"
copy /y node_modules\pkcs11js\index.js "./win/resources/node_modules/pkcs11js/index.js"
copy /y node_modules\pkcs11js\build\Release\pkcs11.node "./win/resources/node_modules/pkcs11js/build/Release/pkcs11.node"
echo Y | net use X: /delete
pause