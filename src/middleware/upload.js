const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { uploadsDir } = require('../db');
const { Logger } = require('../logger');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.ico'];
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon'
];

// Multer storage for media uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : '.jpg';
    const randomName = 'img_' + crypto.randomBytes(16).toString('hex') + safeExt;
    cb(null, randomName);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  // Guard: Reject files with double extensions (e.g. .php.png, .exe.jpg)
  const parts = file.originalname.split('.');
  if (parts.length > 2) {
    const suspiciousExts = ['php', 'exe', 'sh', 'bat', 'cmd', 'js', 'py', 'pl', 'cgi', 'html', 'htm'];
    for (let i = 1; i < parts.length - 1; i++) {
      if (suspiciousExts.includes(parts[i].toLowerCase())) {
        return cb(new Error('Invalid filename. Double extensions are not allowed.'));
      }
    }
  }

  if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIMES.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Only valid image files (jpg, png, webp, gif, svg, ico) are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// Magic Byte Signatures Verification (ASVS V12)
function verifyUploadedFileSignature(req, res, next) {
  if (!req.file) return next();

  const filePath = req.file.path;
  const ext = path.extname(req.file.filename).toLowerCase();

  // SVGs are text XML
  if (ext === '.svg') {
    try {
      const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
      // Guard against malicious SVG script tags or event handlers
      if (content.includes('<script') || content.includes('javascript:') || content.includes('onload=') || content.includes('onerror=')) {
        fs.unlinkSync(filePath);
        Logger.warn('[Upload] Blocked SVG containing embedded scripts', req);
        return res.status(400).json({ error: 'Uploaded SVG contains disallowed script elements' });
      }
    } catch (e) {}
    return next();
  }

  // Binary image magic byte signatures
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    let isValid = false;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      isValid = true;
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      isValid = true;
    }
    // GIF: 47 49 46 38
    else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      isValid = true;
    }
    // WEBP: 52 49 46 46 ... 57 45 42 50
    else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
             buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      isValid = true;
    }
    // ICO: 00 00 01 00
    else if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
      isValid = true;
    }

    if (!isValid) {
      fs.unlinkSync(filePath);
      Logger.warn('[Upload] File signature mismatch. Discarded suspicious file.', req);
      return res.status(400).json({ error: 'File contents do not match a valid image signature.' });
    }
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(500).json({ error: 'Failed to verify uploaded file.' });
  }

  next();
}

module.exports = {
  upload,
  verifyUploadedFileSignature
};
