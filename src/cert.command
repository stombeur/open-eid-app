#!/bin/sh

cd "`dirname "$0"`"

echo "generating the private key ..."
openssl genrsa -des3 -passout pass:openeid -out openeid.key 2048

echo ""
echo "generating the CSR (certificate signing request) ..."
openssl req -new -passin pass:openeid -passout pass:openeid -key openeid.key -out openeid.csr -config openeid.cnf -extensions 'my server exts'

echo ""
echo "generating the self-signed certificate ..."
openssl x509 -req -passin pass:openeid -days 6666 -in openeid.csr -signkey openeid.key -out openeid.crt -extfile openeid.cnf -extensions 'my server exts'

echo ""
echo "convert crt + RSA private key into a PKCS12 (PFX) file ..."
openssl pkcs12 -export -passin pass:openeid -passout pass:openeid -in openeid.crt -inkey openeid.key -out openeid.pfx

echo ""
echo "importing the certificate ..."
sudo security import openeid.pfx -k /Library/Keychains/System.keychain -P openeid -T /usr/bin/codesign