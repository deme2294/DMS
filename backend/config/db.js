import mysql from 'mysql2/promise';
import './env.js';

export function resolveDbConfig(targetName) {
    const target = (targetName || process.env.DB_TARGET || process.env.DB_CLIENT || 'xampp').trim().toLowerCase();

    let host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' && !target ? 'db' : '127.0.0.1');
    let port = Number(process.env.DB_PORT || (target === 'docker' ? 3307 : 3306));
    let user = process.env.DB_USER || 'root';
    let password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
    let database = process.env.DB_NAME || 'helpdesk_db';

    if (target === 'xampp') {
        host = process.env.XAMPP_DB_HOST || (host === 'db' ? '127.0.0.1' : host);
        port = Number(process.env.XAMPP_DB_PORT || (port === 3307 ? 3306 : port));
        user = process.env.XAMPP_DB_USER || (user === 'dms_app' ? 'root' : user);
        password = process.env.XAMPP_DB_PASSWORD !== undefined ? process.env.XAMPP_DB_PASSWORD : (password === 'root' ? '' : password);
        database = process.env.XAMPP_DB_NAME || database;
    } else if (target === 'docker') {
        host = process.env.DOCKER_DB_HOST || (host === 'db' ? '127.0.0.1' : host);
        port = Number(process.env.DOCKER_DB_PORT || (port === 3306 ? 3307 : port));
        user = process.env.DOCKER_DB_USER || user;
        password = process.env.DOCKER_DB_PASSWORD || (password || 'root');
        database = process.env.DOCKER_DB_NAME || database;
    }

    return { target, host, port, user, password, database };
}

let activeConfig = resolveDbConfig();
let activePool = mysql.createPool({
    host: activeConfig.host,
    port: activeConfig.port,
    user: activeConfig.user,
    password: activeConfig.password,
    database: activeConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
});

export function switchTarget(newTarget) {
    const newConfig = resolveDbConfig(newTarget);
    if (activePool) {
        activePool.end().catch(() => {});
    }
    activeConfig = newConfig;
    process.env.DB_TARGET = newConfig.target;
    process.env.DB_PORT = String(newConfig.port);
    process.env.DB_HOST = newConfig.host;
    process.env.DB_USER = newConfig.user;
    process.env.DB_PASSWORD = newConfig.password;
    activePool = mysql.createPool({
        host: newConfig.host,
        port: newConfig.port,
        user: newConfig.user,
        password: newConfig.password,
        database: newConfig.database,
        waitForConnections: true,
        connectionLimit: 10,
        namedPlaceholders: true,
    });
    return activeConfig;
}

export function getActiveDbConfig() {
    return { ...activeConfig };
}

const pool = new Proxy({}, {
    get(target, prop) {
        if (prop === 'switchTarget') return switchTarget;
        if (prop === 'getActiveDbConfig') return getActiveDbConfig;
        if (prop === 'resolveDbConfig') return resolveDbConfig;
        if (prop === 'rawPool') return activePool;

        const val = activePool[prop];
        if (typeof val === 'function') {
            return val.bind(activePool);
        }
        return val;
    }
});

export default pool;
