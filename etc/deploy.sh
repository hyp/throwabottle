#!/bin/sh
#Bottle server deployment script for debian linux

apt-get update
apt-get upgrade --show-upgraded

#install dependencies
apt-get install libpcre3-dev build-essential
apt-get install g++
apt-get install python
apt-get install python-software-properties
apt-get install libssl-dev libreadline-dev
apt-get install git-core
apt-get install curl
apt-get install vim

#install monit
apt-get install monit

cp -r monit/* /etc/monit/

#install nginx
sh ./install-nginx.sh

cp init.d/nginx.sh /etc/init.d/nginx
chmod +x /etc/init.d/nginx
/usr/sbin/update-rc.d -f nginx defaults

#install nodejs
sh ./install-nodejs.sh
curl http://npmjs.org/install.sh | sh

cp init.d/nodeapp.sh /etc/init.d/nodeapp
chmod +x /etc/init.d/nodeapp

#installing redis and use default redis configuration
sh ./install-redis.sh
cp /opt/redis/redis.conf.default /opt/redis/redis.conf

cp init.d/redis.sh /etc/init.d/redis
chmod +x /etc/init.d/redis
/usr/sbin/update-rc.d -f redis defaults

chown -R redis:redis /opt/redis
