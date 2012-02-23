#!/bin/sh
echo 'Installing redis...'

cd /opt/
mkdir /opt/redis
wget http://redis.googlecode.com/files/redis-2.4.7.tar.gz
tar -zxvf /opt/redis-2.4.7.tar.gz
cd /opt/redis-2.4.7/
make

cp /opt/redis-2.4.7/redis.conf /opt/redis/redis.conf.default
cp /opt/redis-2.4.7/src/redis-benchmark /opt/redis/
cp /opt/redis-2.4.7/src/redis-cli /opt/redis/
cp /opt/redis-2.4.7/src/redis-server /opt/redis/
cp /opt/redis-2.4.7/src/redis-check-aof /opt/redis/
cp /opt/redis-2.4.7/src/redis-check-dump /opt/redis/