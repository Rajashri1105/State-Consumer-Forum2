const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config/env');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Builds a multer instance that stores files under uploads/<subfolder>/
 * with randomized, collision-safe filenames while preserving the
 * original extension.
 * @param {'complaints'|'evidence'|'judgments'|'profile-images'} subfolder
 */
function createUploader(subfolder) {
  const destination = path.join(__dirname, '..', config.upload.dir, subfolder);
  ensureDir(destination);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
      cb(null, unique);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, JPG, PNG, WEBP, DOC, DOCX.`));
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: config.upload.maxFileSizeMb * 1024 * 1024 },
  });
}

module.exports = { createUploader, ALLOWED_MIME_TYPES };
