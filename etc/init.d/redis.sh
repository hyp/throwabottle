#!/bin/sh

### BEGIN INIT INFO
# Provides:          redis
# Required-Start:    $all
# Required-Stop:     $all
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: starts redis database system
# Description:       starts redis using basic start scripts
### END INIT INFO

PATH=/opt/redis/bin:/sbin:/bin:/usr/sbin:/usr/bin
DAEMON=/opt/redis/redis-server
DAEMON_OPTS=/opt/redis/redis.conf
NAME=redis
DESC=redis


test -x $DAEMON || exit 0

set -e

case "$1" in
  start)
        echo -n "Starting $DESC: "

        start-stop-daemon --start --quiet --user redis -c redis:redis --startas $DAEMON -- $DAEMON_OPTS

        echo "$NAME."
        ;;
  stop)
        echo -n "Stopping $DESC: "

        start-stop-daemon --stop --quiet --exec $DAEMON --user redis -c redis:redis -- $DAEMON_OPTS

        echo "$NAME."
        ;;
  restart|force-reload)
	${0} stop
	${0} start
	;;
  *)
	echo "Usage: /etc/init.d/$NAME {start|stop|restart|force-reload}" >&2
	exit 1
	;;
esac

exit 0
