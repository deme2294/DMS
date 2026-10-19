import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

// 1. Inspect command-line flags (e.g. node server.js --target=docker or --docker)
for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--target=')) {
        process.env.DB_TARGET = arg.split('=')[1].trim().toLowerCase();
    } else if (arg === '--docker') {
        process.env.DB_TARGET = 'docker';
    } else if (arg === '--xampp') {
        process.env.DB_TARGET = 'xampp';
    }
}

// 2. Load the unified .env file
const baseEnvPath = path.resolve(backendDir, '.env');
if (fs.existsSync(baseEnvPath)) {
    dotenv.config({ path: baseEnvPath });
}

export default process.env;
