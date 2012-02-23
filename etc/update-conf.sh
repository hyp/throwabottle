cd /home/nodeapp/etc
cp nginx.conf /opt/nginx/conf/nginx.conf
cp redis.conf /opt/redis/redis.conf
chown redis:redis /opt/redis/redis.conf

/etc/init.d/nginx stop
/etc/init.d/redis stop
