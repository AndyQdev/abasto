# Catálogo · Laravel sobre PHP 8.4 con la extensión de MongoDB.
# Se desarrolla dentro de este contenedor: nadie necesita instalar PHP ni Composer en Windows.
#   base → PHP + extensiones + Composer
#   dev  → base + dependencias; docker-compose monta el código encima para editar en caliente

FROM php:8.4-cli AS base
# La extensión de MongoDB se compila desde el paquete que MongoDB publica en sus releases de GitHub,
# no desde pecl.php.net, que se cae seguido. El resto lo instala install-php-extensions.
ARG MONGODB_EXT=2.5.5
COPY --from=mlocati/php-extension-installer:2 /usr/bin/install-php-extensions /usr/local/bin/
RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libssl-dev $PHPIZE_DEPS \
    && curl -fsSL "https://github.com/mongodb/mongo-php-driver/releases/download/${MONGODB_EXT}/mongodb-${MONGODB_EXT}.tgz" -o /tmp/mongodb.tgz \
    && tar -xzf /tmp/mongodb.tgz -C /tmp \
    && cd "/tmp/mongodb-${MONGODB_EXT}" && phpize && ./configure --with-mongodb-ssl=openssl && make -j"$(nproc)" && make install \
    && docker-php-ext-enable mongodb \
    && install-php-extensions zip bcmath pcntl intl \
    && cd / && rm -rf /tmp/mongodb* /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1
WORKDIR /app

FROM base AS dev
COPY composer.json composer.lock ./
RUN composer install --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY . .
RUN composer dump-autoload --optimize && php artisan package:discover --ansi
EXPOSE 8082
ENV PHP_CLI_SERVER_WORKERS=4
CMD ["php", "-S", "0.0.0.0:8082", "-t", "public", "vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php"]
