#! /bin/sh

### BEGIN INIT INFO
# Provides:          nodeapp
# Required-Start:    $all
# Required-Stop:     $all
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: starts the node.js application
# Description:       starts node.js application using forever
### END INIT INFO

#!/bin/bash

PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
APP=server.js
DESC="Node.JS application $APP"

su - nodeapp

function start_app {
  node "$APP" 1>>'/var/log/nodeapp.log'  2>&1 &
  echo $! > '/var/run/nodeapp.pid'
}

function stop_app {
  kill `cat /var/run/nodeapp.pid`
}

case $1 in
   start)
	  echo "Starting $DESC"
      start_app ;;
    stop)
	  echo "Stopping $DESC"
      stop_app ;;
    restart)
      stop_app
      start_app
      ;;
    *)
      echo "usage: $APP {start|stop}" ;;
esac
exit 0