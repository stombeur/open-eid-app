#!/bin/sh

cd "`dirname "$0"`"
find . -name '.DS_Store' -type f -delete
cp -f package.json "./mac/Open e-ID.app/Contents/Resources/app/package.json"
cp -f open-eid.js "./mac/Open e-ID.app/Contents/Resources/app/open-eid.js"
cp -f open-eid.css "./mac/Open e-ID.app/Contents/Resources/app/open-eid.css"
cp -f open-eid.html "./mac/Open e-ID.app/Contents/Resources/app/open-eid.html"
cp -f open-eid-read.html "./mac/Open e-ID.app/Contents/Resources/app/open-eid-read.html"
cp -f loading.gif "./mac/Open e-ID.app/Contents/Resources/app/loading.gif"
cp -f node_modules/pkcs11js/index.js "./mac/Open e-ID.app/Contents/Resources/node_modules/pkcs11js/index.js"
cp -f node_modules/pkcs11.mac "./mac/Open e-ID.app/Contents/Resources/node_modules/pkcs11js/build/Release/pkcs11.node"
osacompile -o open-eid.app open-eid.applescript
cp -f open-eid.app/Contents/MacOS/applet "./mac/Open e-ID.app/Contents/MacOS/applet"
cp -f open-eid.app/Contents/Resources/applet.rsrc "./mac/Open e-ID.app/Contents/Resources/applet.rsrc"
cp -f open-eid.app/Contents/Resources/Scripts/main.scpt "./mac/Open e-ID.app/Contents/Resources/Scripts/main.scpt"
rm -f -R open-eid.app
codesign --force --verbose -s "Open e-ID" "./mac/Open e-ID.app"
rm -f -R ~/Applications/Open\ e-ID.app
cp -f -R "./mac/Open e-ID.app" ~/Applications/Open\ e-ID.app
cd mac
zip -r "../../rel/Open e-ID.app.zip" "Open e-ID.app"

