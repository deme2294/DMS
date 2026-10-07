// ─────────────────────────────────────────────────────────────────────────────
// server.js  –  Application entry point
// Run with:  node server.js   (no extra flags needed)
// ─────────────────────────────────────────────────────────────────────────────

// 0. Self-restart with --no-deprecation when run as `node server.js`
//    This suppresses the harmless DEP0169 url.parse() warning from mysql2.
//    Works in ESM because the check runs before any module imports fire.
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

if (!process.execArgv.includes('--no-deprecation')) {
    const __filename = fileURLToPath(import.meta.url);
    try {
        execFileSync(
            process.execPath,
            ['--no-deprecation', __filename, ...process.argv.slice(2)],
            { stdio: 'inherit' }
        );
    } catch (e) {
        process.exit(e.status ?? 1);
    }
    process.exit(0);
}

// Global error safety net
process.on('uncaughtException', (err) => {
    console.error('🚨 Uncaught Exception:', err.message);
    process.exit(1);
});
process.on('unhandledRejection', (err) => {
    console.error('🚨 Unhandled Rejection:', err);
    process.exit(1);
});
process.on('SIGTERM', () => { stopSlaMonitor(); process.exit(0); });
process.on('SIGINT', () => { stopSlaMonitor(); process.exit(0); });

import net from 'net';
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

// 1. Load environment variables first so every subsequent import can read them.
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setIo } from './services/socketService.js';
import { startNoticeScheduler } from './services/noticeScheduler.js';
import { startSlaMonitor, stopSlaMonitor } from './services/slaMonitorService.js';
import { runAutoMigrations } from './services/migrationService.js';

// ── Config & infrastructure ──────────────────────────────────────────────────
import pool from './config/db.js';

// ── Route modules ────────────────────────────────────────────────────────────
import authRoutes from './routes/authRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import noticeRoutes from './routes/noticeRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import userRoutes from './routes/userRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import matrixRoutes from './routes/matrixRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import slaRoutes from './routes/slaRoutes.js';
import chatRoutes from './routes/chatRoutes.js';

// ── Error-handling middleware ────────────────────────────────────────────────
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// ── Terminal Styling Utility (ANSI Formatting) ──────────────────────────────
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
    white: '\x1b[37m',
    red: '\x1b[31m',
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Verify MySQL connection & run auto migrations before binding to the port
// ─────────────────────────────────────────────────────────────────────────────
async function connectDB() {
    try {
        const connection = await pool.getConnection();
        console.log(`  ${c.green}●${c.reset} ${c.bold}[DATABASE]${c.reset}   MySQL connected successfully ${c.dim}(${process.env.DB_NAME || 'helpdesk_db'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306})${c.reset}`);
        connection.release();

        // Ensure revoked_tokens table exists for scheduled cleanup
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS revoked_tokens (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    token VARCHAR(500) NOT NULL,
                    expires_at DATETIME NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_expires_at (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        } catch (tableErr) {
            console.warn('⚠️  Could not initialize revoked_tokens table:', tableErr.message);
        }

        await runAutoMigrations();
    } catch (err) {
        console.error('❌  MySQL connection failed:', err.message);
        process.exit(1); // Fatal – no point running without a database
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Create and configure the Express application
// ─────────────────────────────────────────────────────────────────────────────
const app = express();

// ── __dirname equivalent for ES modules ─────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Security headers (helmet and custom) ──────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
// Custom header
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Custom-Security', 'DMS-Secure');
    next();
});

// Prevent browsers/proxies from caching API GET responses (avoids stale list
// data after create/update/delete/toggle operations).
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// ── CORS ─────────────────────────────────────────────────────────────────────
const configuredOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    ...configuredOrigins,
]);

const isAllowedOrigin = (origin) => {
    if (!origin) return true;

    if (allowedOrigins.has(origin)) return true;

    return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);
};

app.use(
    cors({
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['Set-Cookie'],
    })
);

// ── Request body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Cookie & session parsing ─────────────────────────────────────────────────
app.use(cookieParser());
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'change_me',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
        },
    })
);

// ── Professional Request Logging with Status Lights ────────────────────────
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const statusLight = status >= 500 ? `${c.red}●${c.reset}`
            : status >= 400 ? `${c.yellow}●${c.reset}`
            : `${c.green}●${c.reset}`;
        
        const methodColor = req.method === 'GET' ? c.cyan
            : req.method === 'POST' ? c.green
            : req.method === 'DELETE' ? c.red
            : c.yellow;

        const ts = new Date().toLocaleTimeString();
        console.log(`  ${statusLight} ${methodColor}${req.method.padEnd(6)}${c.reset} ${req.originalUrl.padEnd(38)} ${c.dim}${status} (${duration}ms)${c.reset} ${c.gray}${ts}${c.reset}`);
    });
    next();
});

// ── Rate-limiting on the login endpoint ──────────────────────────────────────
app.use(
    '/api/auth/login',
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Too many login attempts, please try again later.' },
    })
);

// ── Root API Info endpoint (GET /api, GET /) ─────────────────────────────────
const apiRootInfo = async (_req, res) => {
    let dbStatus = 'healthy';
    try {
        await pool.query('SELECT 1');
    } catch {
        dbStatus = 'disconnected';
    }
    const ioInstance = app.get('io');

    res.json({
        success: true,
        service: 'DMS Helpdesk API Service',
        message: 'DMS Helpdesk API Service is running and operational',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        status: dbStatus === 'healthy' ? 'operational' : 'degraded',
        uptime: `${Math.round(process.uptime())}s`,
        connections: {
            database: dbStatus,
            activeSockets: ioInstance ? ioInstance.engine?.clientsCount || 0 : 0,
        },
        healthCheck: '/api/health',
        endpoints: {
            auth: '/api/auth',
            tickets: '/api/tickets',
            dashboard: '/api/dashboard',
            departments: '/api/departments',
            users: '/api/users',
            tenants: '/api/tenants',
            chat: '/api/chat',
            knowledge: '/api/knowledge',
            notices: '/api/notices',
            feedback: '/api/feedback',
            reports: '/api/reports',
            audit: '/api/audit',
            matrix: '/api/matrix',
            categories: '/api/ticket-categories',
            sla: '/api/sla',
            health: '/api/health',
        },
        timestamp: new Date().toISOString(),
    });
};

app.get(['/api', '/api/'], apiRootInfo);
if (process.env.NODE_ENV !== 'production') {
    app.get('/', apiRootInfo);
}

// ── Health check & Connections checking endpoint ───────────────────────────
app.get('/api/health', async (_req, res) => {
    let dbStatus = 'healthy';
    try {
        await pool.query('SELECT 1');
    } catch {
        dbStatus = 'disconnected';
    }
    const ioInstance = app.get('io');
    res.json({
        success: true,
        status: dbStatus === 'healthy' ? 'operational' : 'degraded',
        message: 'DMS Helpdesk API Service is running',
        connections: {
            database: dbStatus,
            activeSockets: ioInstance ? ioInstance.engine?.clientsCount || 0 : 0,
        },
        uptime: `${Math.round(process.uptime())}s`,
        env: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Register all API routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/matrix', matrixRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/ticket-categories', categoryRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/chat', chatRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Serve uploaded files as static assets
//    Files uploaded via multer land in  /uploads/tickets  and  /uploads/users.
//    Accessible at  GET /uploads/<subfolder>/<filename>
// ─────────────────────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─────────────────────────────────────────────────────────────────────────────
// 6. In production, serve the compiled frontend from ../frontend/dist
// ─────────────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
    app.use(express.static(frontendDist));
    // Any non-API route falls through to the SPA shell
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Unknown route → 404
// ─────────────────────────────────────────────────────────────────────────────
app.use(notFound);

// ─────────────────────────────────────────────────────────────────────────────
// 8. Global error handler  (must be last, and must have 4 parameters)
// ─────────────────────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// 9. Port Auto-selection & Server Initialization
// ─────────────────────────────────────────────────────────────────────────────

// ---- Port auto-selection (scan for first free port) ----
const isPortFree = (port) => {
    return new Promise((resolve) => {
        const srv = net.createServer();

        srv.once('error', (err) => {
            if (err && err.code === 'EADDRINUSE') return resolve(false);
            return resolve(false);
        });

        srv.once('listening', () => {
            srv.close(() => resolve(true));
        });

        srv.listen(port, '0.0.0.0');
    });
};

const killProcessOnPort = async (port) => {
    try {
        const { stdout } = await execPromise(`netstat -ano | findstr :${port} | findstr LISTENING`);
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && /^\d+$/.test(pid)) {
                pids.add(pid);
            }
        }

        if (pids.size === 0) return false;

        let killedAny = false;
        for (const pid of pids) {
            if (Number(pid) === process.pid) continue;
            try {
                const { stdout: taskOutput } = await execPromise(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
                if (taskOutput.toLowerCase().includes('node.exe') || taskOutput.toLowerCase().includes('node')) {
                    await execPromise(`taskkill /F /PID ${pid}`);
                    console.log(`  ${c.yellow}●${c.reset} ${c.bold}[PROCESS]${c.reset}    Cleaned up stale process on port ${port} ${c.dim}(PID: ${pid})${c.reset}`);
                    killedAny = true;
                }
            } catch {
                // Process may have already exited
            }
        }
        return killedAny;
    } catch {
        return false;
    }
};

const findFreePort = async (startPort, maxAttempts = 100) => {
    let port = startPort;

    for (let i = 0; i < maxAttempts; i++) {
        // eslint-disable-next-line no-await-in-loop
        const free = await isPortFree(port);

        if (free) return port;

        console.warn(`⚠️ Port ${port} is busy, trying ${port + 1}...`);
        port += 1;
    }

    throw new Error(`No free port found starting from ${startPort} (tried ${maxAttempts} ports).`);
};

let activeConnectionsCount = 0;

function setupSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (isAllowedOrigin(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
            methods: ['GET', 'POST'],
        },
    });

    setIo(io);
    app.set('io', io);

    io.use(async (socket, next) => {
        try {
            const authToken = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
            if (!authToken) return next(new Error('Authentication required'));
            const jwt = (await import('jsonwebtoken')).default;
            const decoded = jwt.verify(authToken, process.env.JWT_ACCESS_SECRET || 'secret');
            const [rows] = await pool.query(
                `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.status, u.tenant_id, r.name AS role
                 FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :id LIMIT 1`,
                { id: decoded.sub }
            );
            if (!rows.length || rows[0].status !== 'active') return next(new Error('Invalid or inactive user'));
            socket.data.user = rows[0];
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        const user = socket.data.user;
        activeConnectionsCount++;
        const ts = new Date().toLocaleTimeString();
        console.log(`  ${c.green}●${c.reset} ${c.bold}[SOCKET]${c.reset}   ${c.green}Connected${c.reset}    ${c.bold}${user.username}${c.reset} ${c.dim}(${user.role})${c.reset} ${c.gray}• Active: ${activeConnectionsCount} • ${ts}${c.reset}`);
        
        // Join user's personal room
        socket.join(`user:${user.id}`);
        
        // Set user online status
        try {
            const chatService = await import('./services/chatService.js');
            await chatService.setOnlineStatus(user.id, true, socket.id);
            
            // Broadcast online status
            io.emit('user-online', { userId: user.id, username: user.username });
        } catch (err) {
            console.error('Error setting online status:', err.message);
        }

        // ===================== TICKET EVENTS =====================
        socket.on('join-ticket', (ticketId) => {
            socket.join(`ticket:${ticketId}`);
        });

        socket.on('leave-ticket', (ticketId) => {
            socket.leave(`ticket:${ticketId}`);
        });

        // ===================== CHAT ROOM EVENTS =====================
        socket.on('join-room', (roomId) => {
            socket.join(`room:${roomId}`);
            console.log(`${user.username} joined room: ${roomId}`);
        });

        socket.on('leave-room', (roomId) => {
            socket.leave(`room:${roomId}`);
            console.log(`${user.username} left room: ${roomId}`);
        });

        // ===================== MESSAGE EVENTS =====================
        socket.on('send-message', async (data) => {
            try {
                const chatService = await import('./services/chatService.js');
                const message = await chatService.sendMessage(data, user.id);
                
                // Broadcast to all participants in the room
                io.to(`room:${data.roomId}`).emit('new-message', message);
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        socket.on('edit-message', async (data) => {
            try {
                const chatService = await import('./services/chatService.js');
                const message = await chatService.editMessage(data.messageId, data.message, user.id);
                
                // Broadcast to all participants
                const chatRepo = await import('./repository/chatRepository.js');
                const originalMessage = await chatRepo.findMessageById(data.messageId);
                if (originalMessage) {
                    io.to(`room:${originalMessage.room_id}`).emit('message-edited', message);
                }
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        socket.on('delete-message', async (messageId) => {
            try {
                const chatService = await import('./services/chatService.js');
                await chatService.deleteMessage(messageId, user.id);
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        // ===================== TYPING EVENTS =====================
        socket.on('typing-start', async (roomId) => {
            try {
                const chatService = await import('./services/chatService.js');
                await chatService.setTyping(roomId, user.id, true);
                
                // Broadcast to others in room (not sender)
                socket.to(`room:${roomId}`).emit('user-typing', {
                    roomId,
                    userId: user.id,
                    username: user.username,
                    firstName: user.first_name,
                    lastName: user.last_name,
                });
            } catch (err) {
                console.error('Typing start error:', err.message);
            }
        });

        socket.on('typing-stop', async (roomId) => {
            try {
                const chatService = await import('./services/chatService.js');
                await chatService.setTyping(roomId, user.id, false);
                
                socket.to(`room:${roomId}`).emit('user-stopped-typing', {
                    roomId,
                    userId: user.id,
                });
            } catch (err) {
                console.error('Typing stop error:', err.message);
            }
        });

        // ===================== READ STATUS EVENTS =====================
        socket.on('mark-read', async (data) => {
            try {
                const chatService = await import('./services/chatService.js');
                await chatService.markMessagesAsRead(data.roomId, user.id, data.messageIds || []);
                
                // Broadcast read status
                io.to(`room:${data.roomId}`).emit('messages-read', {
                    roomId: data.roomId,
                    userId: user.id,
                    messageIds: data.messageIds,
                });
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        // ===================== IN-APP WEBRTC VIDEO CONFERENCE =====================
        socket.on('video-join', ({ roomId, peerInfo }) => {
            const videoRoom = `video:${roomId}`;
            socket.join(videoRoom);
            console.log(`Video peer joined ${videoRoom}: ${user.username} (${socket.id})`);
            socket.to(videoRoom).emit('video-user-joined', {
                socketId: socket.id,
                userId: user.id,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                peerInfo: peerInfo || {}
            });
        });

        socket.on('video-signal', ({ to, signal }) => {
            if (to) {
                io.to(to).emit('video-signal', {
                    from: socket.id,
                    signal,
                    user: {
                        id: user.id,
                        username: user.username,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        role: user.role
                    }
                });
            }
        });

        socket.on('video-stream-state', ({ roomId, isMicMuted, isCameraOff, isScreenSharing }) => {
            socket.to(`video:${roomId}`).emit('video-peer-state-changed', {
                socketId: socket.id,
                userId: user.id,
                isMicMuted,
                isCameraOff,
                isScreenSharing
            });
        });

        socket.on('video-leave', ({ roomId }) => {
            const videoRoom = `video:${roomId}`;
            socket.leave(videoRoom);
            socket.to(videoRoom).emit('video-user-left', {
                socketId: socket.id,
                userId: user.id
            });
            console.log(`Video peer left ${videoRoom}: ${user.username}`);
        });

        // ===================== DISCONNECT =====================
        socket.on('disconnect', async () => {
            activeConnectionsCount = Math.max(0, activeConnectionsCount - 1);
            const ts = new Date().toLocaleTimeString();
            console.log(`  ${c.gray}○${c.reset} ${c.dim}[SOCKET]   Disconnected${c.reset} ${user.username} ${c.gray}• Active: ${activeConnectionsCount} • ${ts}${c.reset}`);
            
            // Broadcast video-user-left to any active video rooms
            io.emit('video-user-left', { socketId: socket.id, userId: user.id });

            // Set user offline
            try {
                const chatService = await import('./services/chatService.js');
                await chatService.setOnlineStatus(user.id, false, null);
                
                // Broadcast offline status
                io.emit('user-offline', { userId: user.id, username: user.username });
            } catch (err) {
                console.error('Error setting offline status:', err.message);
            }
        });
    });

    return io;
}

const startServerOnPort = (port) => {
    return new Promise((resolve, reject) => {
        const newServer = createServer(app);

        newServer.once('listening', () => {
            console.log(`\n  ${c.green}●${c.reset} ${c.bold}DMS HELPDESK API SERVICE${c.reset} ${c.dim}v1.0.0${c.reset}\n`);
            console.log(`  ${c.green}●${c.reset} ${c.bold}Status${c.reset}       ${c.green}ONLINE${c.reset} ${c.dim}• Ready for incoming requests${c.reset}`);
            console.log(`  ${c.cyan}◆${c.reset} ${c.bold}Local API${c.reset}    ${c.cyan}http://localhost:${port}/api${c.reset}`);
            console.log(`  ${c.yellow}⚡${c.reset} ${c.bold}Realtime WS${c.reset}  ${c.yellow}Socket.IO Active & Listening${c.reset} ${c.dim}(port ${port})${c.reset}`);
            console.log(`  ${c.blue}◆${c.reset} ${c.bold}Database${c.reset}     ${c.blue}MySQL Connected${c.reset} ${c.dim}(${process.env.DB_NAME || 'helpdesk_db'})${c.reset}`);
            console.log(`  ${c.magenta}◆${c.reset} ${c.bold}Health Check${c.reset} ${c.magenta}GET /api/health${c.reset} ${c.dim}• Live connections check${c.reset}`);
            console.log(`  ${c.gray}●${c.reset} ${c.bold}Environment${c.reset}  ${c.dim}${process.env.NODE_ENV || 'development'}${c.reset}\n`);

            // Attach socket ONLY after successful start
            try {
                setupSocket(newServer);
            } catch (e) {
                console.error('❌ setupSocket failed:', e);
            }

            // Seed default system roles on startup (safe — uses ON DUPLICATE KEY UPDATE)
            try {
                import('./controllers/roleController.js').then((module) => {
                    if (module && typeof module.seedDefaultRoles === 'function') {
                        module.seedDefaultRoles();
                    }
                }).catch(() => {
                    // Safe fallback if roleController.js doesn't exist
                });
            } catch (e) {
                console.error('[ROLES] Failed to seed default roles:', e);
            }

            resolve({ server: newServer, port });
        });

        newServer.once('error', (err) => {
            reject(err);
        });

        newServer.listen(port);
    });
};

// ✅ DEFINE PORT ONLY ONCE
// Requirement: start scanning from 5005 (unless explicitly overridden)
const PORT_START = parseInt(process.env.PORT_START, 10) || parseInt(process.env.PORT, 10) || 5005;

/**
 * ✅ START: auto-scan + if race still happens, retry on next ports
 * Note: requirement says “when port 5005 is busy, auto-switch”.
 * We keep scanning from PORT_START upward and ONLY start the HTTP server once.
 */
(async () => {
    await connectDB();
    startNoticeScheduler();
    startSlaMonitor();

    const MAX_START_ATTEMPTS = 50;

    // Clean up stale node processes on the preferred port before starting
    const cleaned = await killProcessOnPort(PORT_START);
    if (cleaned) {
        console.log(`  ${c.green}●${c.reset} ${c.bold}[PROCESS]${c.reset}    Cleaned up stale process on port ${PORT_START}`);
    }

    for (let i = 0; i < MAX_START_ATTEMPTS; i++) {
        const candidatePort = PORT_START + i;

        try {
            // Optional: pre-check to reduce chance of racing with another process
            const free = await isPortFree(candidatePort);
            if (!free) {
                console.warn(`⚠️ Port ${candidatePort} is busy, trying ${candidatePort + 1}...`);
                continue;
            }

            await startServerOnPort(candidatePort);
            return;
        } catch (e) {
            if (e && e.code === 'EADDRINUSE') {
                console.warn(`⚠️ EADDRINUSE on ${candidatePort}. Retrying next port...`);
                continue;
            }
            console.error('❌ Failed to start server:', e);
            process.exit(1);
        }
    }

    console.error(`❌ Could not start server: no free ports found starting from ${PORT_START}.`);
    process.exit(1);
})();

// Scheduled task to clean up expired revoked tokens every 6 hours
setInterval(async () => {
    try {
        console.log("[SECURITY] Running cleanup for expired revoked tokens...");
        const [result] = await pool.query("DELETE FROM revoked_tokens WHERE expires_at < NOW()");
        if (result && result.affectedRows > 0) {
            console.log(`[SECURITY] Cleaned up ${result.affectedRows} expired revoked tokens.`);
        }
    } catch (err) {
        console.error("[SECURITY] Error during revoked tokens cleanup:", err);
    }
}, 6 * 60 * 60 * 1000);

export default app;   // exported so test suites can import the app directly

