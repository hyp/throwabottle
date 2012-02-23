#!/bin/sh
echo 'Inital server user setup...'

adduser --system --no-create-home --disabled-login --disabled-password --group nginx

mkdir /var/log/nginx

addgroup --system --gid 1000 nodeapp
adduser --system --disabled-login --disabled-password --uid 1000 --gid 1000 nodeapp

touch /var/log/nodeapp.log
chown nodeapp:nodeapp /var/log/nodeapp.log
touch /var/run/nodeapp.pid
chown nodeapp:nodeapp /var/run/nodeapp.pid

adduser --system --no-create-home --disabled-login --disabled-password --group redis

touch /var/log/redis.log
chown redis:redis /var/log/redis.log
touch /var/run/redis.pid
chown redis:redis /var/run/redis.pid

echo ' success!'
echo ' '