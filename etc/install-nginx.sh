#!/bin/sh
echo 'Installing nginx...'

cd /opt/
wget http://nginx.org/download/nginx-1.0.12.tar.gz
tar -zxvf nginx-1.0.12.tar.gz
cd /opt/nginx-1.0.12/

echo ' '
echo 'Configuring nginx..'

./configure --prefix=/opt/nginx --user=nginx --group=nginx --with-http_ssl_module --with-ipv6

echo ' '

make
make install
