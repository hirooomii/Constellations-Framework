#!/bin/sh
set -e

echo "==> Starting Laravel setup..."

# Generate app key if not set
if [ -z "$APP_KEY" ]; then
    echo "==> Generating APP_KEY..."
    php artisan key:generate --force
fi

# Run migrations
echo "==> Running migrations..."
php artisan migrate --force

# Clear and cache config
echo "==> Caching config..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Create storage symlink
php artisan storage:link || true

# Create supervisor log directory
mkdir -p /var/log/supervisor

echo "==> Starting services..."
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
