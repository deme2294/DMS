// start.cjs — CommonJS wrapper that suppresses DEP0169 before ESM imports load
// Usage: node start.cjs  (or just: node server.js via the updated package.json)

// Suppress the harmless mysql2 url.parse() deprecation warning
const originalEmit = process.emit.bind(process);
process.emit = function (event, ...args) {
    if (
        event === 'warning' &&
        args[0] &&
        (args[0].code === 'DEP0169' || (args[0].message && args[0].message.includes('url.parse')))
    ) {
        return false;
    }
    return originalEmit(event, ...args);
};

// Now load the actual ESM server entry point
import('./server.js').catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
