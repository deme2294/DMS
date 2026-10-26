#!/bin/sh
set -e

# If BACKEND_HOST is provided at runtime (e.g., in Docker Desktop via -e BACKEND_HOST=host.docker.internal:5000)
# we inject it into the Nginx configuration.
if [ -n "$BACKEND_HOST" ]; then
    echo "DMS Frontend: Configuring backend upstream to $BACKEND_HOST"
    sed -i "s|set \$backend_upstream .*|set \$backend_upstream \"$BACKEND_HOST\";|g" /etc/nginx/conf.d/default.conf
else
    echo "DMS Frontend: Using default upstream backend:5000"
fi
