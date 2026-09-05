const path = require('path');
const multer = require('multer');

// 扩展名与MIME双重白名单，两者必须同时匹配才允许上传
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// 危险扩展名黑名单（双重保险，防止存储型XSS）
const FORBIDDEN_EXTENSIONS = ['.html', '.htm', '.svg', '.js', '.php', '.jsp', '.exe', '.sh', '.bat'];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    // 仅保留白名单内的扩展名，杜绝原始文件名携带危险后缀
    const ext = ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())
      ? path.extname(file.originalname).toLowerCase()
      : '';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  // 黑名单优先拦截
  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    return cb(new Error('仅支持 jpg/png/gif/webp 格式的图片'), false);
  }
  // 扩展名 + MIME 双重白名单校验
  if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('仅支持 jpg/png/gif/webp 格式的图片'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = upload;
