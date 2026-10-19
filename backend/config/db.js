import mysql from 'mysql2/promise';
import './env.js';

const dbTarget = (process.env.DB_TARGET || process.env.DB_CLIENT || 'xampp').trim().toLowerCase();

let host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' && !dbTarget ? 'db' : '127.0.0.1');
let port = Number(process.env.DB_PORT || 3306);
let user = process.env.DB_USER || 'root';
let password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
let database = process.env.DB_NAME || 'helpdesk_db';

if (dbTarget === 'xampp') {
    host = process.env.XAMPP_DB_HOST || host;
    port = Number(process.env.XAMPP_DB_PORT || (port === 3307 ? 3306 : port));
    user = process.env.XAMPP_DB_USER || user;
    password = process.env.XAMPP_DB_PASSWORD !== undefined ? process.env.XAMPP_DB_PASSWORD : (password === 'root' ? '' : password);
    database = process.env.XAMPP_DB_NAME || database;
} else if (dbTarget === 'docker') {
    host = process.env.DOCKER_DB_HOST || host;
    port = Number(process.env.DOCKER_DB_PORT || (port === 3306 ? 3307 : port));
    user = process.env.DOCKER_DB_USER || user;
    password = process.env.DOCKER_DB_PASSWORD || (password || 'root');
    database = process.env.DOCKER_DB_NAME || database;
}

const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
});

export default pool;
