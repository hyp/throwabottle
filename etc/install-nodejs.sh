#!/bin/sh
echo 'Installing Nodejs...'

cd /opt/
wget http://nodejs.org/dist/v0.6.11/node-v0.6.11.tar.gz
tar -zxvf node-v0.6.11
cd /opt/node-v0.6.11/

./configure
make
make install

echo 'Node installed. version:'
node -v