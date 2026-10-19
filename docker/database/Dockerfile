# ==============================================================================
# DMS Database - Autonomous MariaDB 10.11 LTS Image
# Bundles optimized MariaDB configuration and automatic database initialization schema.
# ==============================================================================
FROM mariadb:10.11

# Set default database name (credentials must be supplied at runtime via environment variables)
ENV MYSQL_DATABASE=helpdesk_db

# Copy optimized server configuration (utf8mb4, innodb buffer, connections)
COPY docker/database/my.cnf /etc/mysql/conf.d/my.cnf

# Copy initialization SQL script into the container's auto-init directory.
# On first startup (when data volume is empty), MariaDB automatically executes
# this script to create all tables, relationships, and initial accounts.
COPY backend/sql/database.sql /docker-entrypoint-initdb.d/01-database.sql

# Expose standard MariaDB / MySQL port
EXPOSE 3306

# Start mysqld
CMD ["mysqld"]
