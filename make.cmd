@echo off
net use X: \\VBOXSVR\michael
X:
cd \
cd Projets
cd e-id
cd app
cd src
copy /y package.json "./win/resources/app/package.json"
copy /y open-eid.js "./win/resources/app/open-eid.js"
copy /y open-eid.html "./win/resources/app/open-eid.html"
copy /y open-eid-read.html "./win/resources/app/open-eid-read.html"
copy /y loading.gif "./win/resources/app/loading.gif"
echo Y | net use X: /delete
pause