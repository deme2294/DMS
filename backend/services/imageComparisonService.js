import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';

let _tableInitialized = false;

/**
 * Initialize database schema for tracking profile image uniqueness and history.
 * Automatically indexes existing profile images on system startup.
 */
export const initProfileImageTable = async () => {
  if (_tableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profile_image_history (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_hash VARCHAR(64) NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        file_size INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_file_hash (file_hash),
        INDEX idx_content_hash (content_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // Backfill existing user profile images into history if not already indexed
    const [existingUsers] = await pool.query(
      `SELECT id, username, profile_image FROM users WHERE profile_image IS NOT NULL AND profile_image != ''`
    );

    const uploadsDir = path.join(process.cwd(), 'uploads', 'users');
    for (const u of existingUsers) {
      if (!u.profile_image) continue;
      const fileName = path.basename(u.profile_image);
      const filePath = path.join(uploadsDir, fileName);

      if (fs.existsSync(filePath)) {
        try {
          const buffer = await fs.promises.readFile(filePath);
          const fileHash = computeFileHash(buffer);
          const contentHash = computeContentHash(buffer);

          const [alreadyIndexed] = await pool.query(
            `SELECT id FROM profile_image_history WHERE file_hash = :fileHash LIMIT 1`,
            { fileHash }
          );

          if (!alreadyIndexed.length) {
            await pool.query(
              `INSERT INTO profile_image_history (id, user_id, file_name, file_hash, content_hash, file_size)
               VALUES (:id, :userId, :fileName, :fileHash, :contentHash, :fileSize)`,
              {
                id: uuidv4(),
                userId: String(u.id),
                fileName,
                fileHash,
                contentHash,
                fileSize: buffer.length,
              }
            );
          }
        } catch (readErr) {
          console.warn(`[imageComparison] Could not index existing photo for ${u.username}:`, readErr.message);
        }
      }
    }

    _tableInitialized = true;
  } catch (err) {
    console.error('[imageComparison] Failed to initialize profile_image_history table:', err.message);
  }
};

/**
 * Computes exact SHA-256 hash of a file buffer.
 */
export const computeFileHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * Extracts the image scan payload (stripping variable metadata like EXIF/JFIF/tEXt/comments)
 * to ensure that identical photos captured across different browsers or timestamps match.
 */
export const extractImagePayload = (buffer) => {
  if (!buffer || buffer.length < 16) return buffer;

  // JPEG / JPG format detection (starts with 0xFF 0xD8)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let pos = 2;
    const payloadChunks = [];
    while (pos < buffer.length - 1) {
      if (buffer[pos] === 0xff) {
        const marker = buffer[pos + 1];
        // SOS (Start of Scan) - compressed pixel scan data starts here
        if (marker === 0xda) {
          payloadChunks.push(buffer.subarray(pos));
          break;
        }
        // Skip standalone markers (RST0-RST7, SOI, EOI, TEM)
        if (
          marker === 0xd8 ||
          marker === 0xd9 ||
          marker === 0x01 ||
          (marker >= 0xd0 && marker <= 0xd7)
        ) {
          pos += 2;
          continue;
        }
        // Variable-length segment
        if (pos + 3 < buffer.length) {
          const segLen = buffer.readUInt16BE(pos + 2);
          // Omit APP0-APP15 (0xE0 - 0xEF) and COM (0xFE) metadata segments
          if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) {
            pos += 2 + segLen;
            continue;
          }
        }
      }
      payloadChunks.push(buffer.subarray(pos, pos + 1));
      pos++;
    }
    if (payloadChunks.length > 0) {
      return Buffer.concat(payloadChunks);
    }
  }

  // PNG format detection (starts with 89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    let pos = 8;
    const criticalChunks = [];
    while (pos < buffer.length - 8) {
      const chunkLen = buffer.readUInt32BE(pos);
      const chunkType = buffer.subarray(pos + 4, pos + 8).toString('ascii');
      // Only keep critical chunks: IHDR, PLTE, IDAT, IEND
      if (['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(chunkType)) {
        criticalChunks.push(buffer.subarray(pos + 4, pos + 8 + chunkLen));
      }
      pos += 12 + chunkLen;
    }
    if (criticalChunks.length > 0) {
      return Buffer.concat(criticalChunks);
    }
  }

  return buffer;
};

/**
 * Computes a normalized content hash of the core image scan data.
 */
export const computeContentHash = (buffer) => {
  const payload = extractImagePayload(buffer);
  return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * Computes a structural sampling fingerprint across the image buffer.
 */
export const computeStructuralFingerprint = (buffer) => {
  if (!buffer || buffer.length < 64) return '';
  const samples = 32;
  const step = Math.floor(buffer.length / samples);
  const sampleBytes = [];
  for (let i = 0; i < samples; i++) {
    sampleBytes.push(buffer[i * step]);
  }
  return crypto.createHash('md5').update(Buffer.from(sampleBytes)).digest('hex');
};

/**
 * Compares an uploaded image file against all existing or previously used profile images
 * of OTHER users in the system.
 *
 * @param {string} filePath - Absolute path to the newly uploaded image file on disk.
 * @param {string|null} currentUserId - The ID of the user uploading the image (to allow re-saving own image).
 * @returns {Promise<{ isUnique: boolean, matchedUser?: string, reason?: string }>}
 */
export const checkProfileImageUniqueness = async (filePath, currentUserId = null) => {
  await initProfileImageTable();

  if (!fs.existsSync(filePath)) {
    throw new Error('Uploaded image file not found on server');
  }

  const newBuffer = await fs.promises.readFile(filePath);
  const newFileHash = computeFileHash(newBuffer);
  const newContentHash = computeContentHash(newBuffer);
  const newFingerprint = computeStructuralFingerprint(newBuffer);
  const newSize = newBuffer.length;

  const currentUserIdStr = currentUserId ? String(currentUserId) : null;

  // 1. Check against profile_image_history records for OTHER users
  const [historyMatches] = await pool.query(
    `SELECT h.user_id, h.file_name, h.file_hash, h.content_hash, h.created_at, u.username, u.first_name, u.last_name
     FROM profile_image_history h
     LEFT JOIN users u ON u.id = h.user_id COLLATE utf8mb4_general_ci
     WHERE (h.file_hash = :newFileHash OR h.content_hash = :newContentHash)
     LIMIT 5`,
    { newFileHash, newContentHash }
  );

  for (const m of historyMatches) {
    if (!currentUserIdStr || String(m.user_id) !== currentUserIdStr) {
      const otherUserName = m.username || m.first_name || `User #${m.user_id}`;
      return {
        isUnique: false,
        matchedUser: otherUserName,
        matchedUserId: m.user_id,
        reason: `This photo has already been used or captured before for user @${otherUserName}. Inserting duplicate photos across users is forbidden.`,
      };
    }
  }

  // 2. Direct byte-level comparison against active profile images of other users in users table
  const [activeUsers] = await pool.query(
    `SELECT id, username, first_name, last_name, profile_image
     FROM users
     WHERE profile_image IS NOT NULL AND profile_image != ''`
  );

  const uploadsDir = path.join(process.cwd(), 'uploads', 'users');
  for (const u of activeUsers) {
    if (currentUserIdStr && String(u.id) === currentUserIdStr) continue;
    if (!u.profile_image) continue;

    const existingFileName = path.basename(u.profile_image);
    const existingFilePath = path.join(uploadsDir, existingFileName);

    if (fs.existsSync(existingFilePath)) {
      try {
        const existingBuffer = await fs.promises.readFile(existingFilePath);

        // Exact binary file match
        if (existingBuffer.length === newSize && existingBuffer.equals(newBuffer)) {
          const otherName = u.username || u.first_name || `User #${u.id}`;
          return {
            isUnique: false,
            matchedUser: otherName,
            matchedUserId: u.id,
            reason: `This exact photo is currently set as the profile picture of user @${otherName}. Duplicate profile photos are not allowed.`,
          };
        }

        // Exact content scan hash match (ignoring different metadata timestamps)
        const existingContentHash = computeContentHash(existingBuffer);
        if (existingContentHash === newContentHash) {
          const otherName = u.username || u.first_name || `User #${u.id}`;
          return {
            isUnique: false,
            matchedUser: otherName,
            matchedUserId: u.id,
            reason: `This image matches an image already used by @${otherName}. Each user must have a unique profile photo.`,
          };
        }

        // Structural fingerprint match for same dimensions / image capture
        const existingFingerprint = computeStructuralFingerprint(existingBuffer);
        if (
          existingFingerprint === newFingerprint &&
          Math.abs(existingBuffer.length - newSize) < 64
        ) {
          const otherName = u.username || u.first_name || `User #${u.id}`;
          return {
            isUnique: false,
            matchedUser: otherName,
            matchedUserId: u.id,
            reason: `This captured image matches an image already assigned to user @${otherName}. Duplicate profile photos are not allowed.`,
          };
        }
      } catch (compareErr) {
        console.warn(`[imageComparison] Error reading existing photo ${existingFileName}:`, compareErr.message);
      }
    }
  }

  return {
    isUnique: true,
    fileHash: newFileHash,
    contentHash: newContentHash,
    fileSize: newSize,
  };
};

/**
 * Registers an approved unique profile image in the persistent history registry.
 */
export const recordProfileImage = async (userId, filePath, fileName) => {
  if (!userId || !filePath || !fs.existsSync(filePath)) return;
  try {
    await initProfileImageTable();
    const buffer = await fs.promises.readFile(filePath);
    const fileHash = computeFileHash(buffer);
    const contentHash = computeContentHash(buffer);

    await pool.query(
      `INSERT INTO profile_image_history (id, user_id, file_name, file_hash, content_hash, file_size)
       VALUES (:id, :userId, :fileName, :fileHash, :contentHash, :fileSize)
       ON DUPLICATE KEY UPDATE file_hash = :fileHash, content_hash = :contentHash`,
      {
        id: uuidv4(),
        userId: String(userId),
        fileName: fileName || path.basename(filePath),
        fileHash,
        contentHash,
        fileSize: buffer.length,
      }
    );
  } catch (err) {
    console.error('[imageComparison] Failed to record profile image in history:', err.message);
  }
};

/**
 * Validates that an uploaded profile image is unique and has not been used or captured before
 * for any other user in the system.
 * If a duplicate is detected, it automatically deletes the temporary uploaded file and throws
 * an HTTP 409 conflict error.
 *
 * @param {string} filePath - Path to uploaded image file.
 * @param {string|null} currentUserId - ID of user updating/uploading profile.
 */
export const assertUniqueProfileImage = async (filePath, currentUserId = null) => {
  const result = await checkProfileImageUniqueness(filePath, currentUserId);
  if (!result.isUnique) {
    // Delete the duplicate file from disk immediately so it is impossible to insert
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (cleanupErr) {
      console.warn('[imageComparison] Failed to cleanup duplicate upload file:', cleanupErr.message);
    }

    const err = new Error(
      result.reason ||
      'This profile image has already been used by another user or uploaded before. Please choose or capture a unique photo.'
    );
    err.statusCode = 409;
    err.isDuplicateImage = true;
    err.matchedUser = result.matchedUser;
    throw err;
  }

  return result;
};
