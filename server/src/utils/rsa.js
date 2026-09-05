// RSA 密钥管理与敏感字段解密工具
// 首次启动自动生成 2048 位密钥对并持久化到 keys/ 目录（重启复用，避免公钥失效）
// 前端使用公钥加密密码/手机号等敏感字段，后端用私钥解密，防止传输过程被抓包看到明文
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, '../../keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'rsa_private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'rsa_public.pem');

let privateKey = null;
let publicKey = null;

// 加载已有密钥或首次生成（仅内存持有，私钥永不外发）
function ensureKeys() {
  if (privateKey && publicKey) return;
  fs.mkdirSync(KEYS_DIR, { recursive: true });

  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    console.log('[安全] RSA 密钥已加载（keys/rsa_private.pem）');
  } else {
    const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    privateKey = priv;
    publicKey = pub;
    fs.writeFileSync(PRIVATE_KEY_PATH, priv);
    fs.writeFileSync(PUBLIC_KEY_PATH, pub);
    console.log('[安全] 已生成新的 RSA 密钥对（keys/rsa_private.pem）');
  }
}

// 返回公钥 PEM（下发前端用于加密敏感字段）
function getPublicKey() {
  ensureKeys();
  return publicKey;
}

// 解密前端用公钥加密的字段（PKCS#1 v1.5 填充，与前端 jsencrypt 默认一致），失败返回 null
function decryptField(cipherBase64) {
  if (!cipherBase64 || typeof cipherBase64 !== 'string') return null;
  ensureKeys();
  try {
    const decrypted = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(cipherBase64, 'base64')
    );
    return decrypted.toString('utf8');
  } catch (err) {
    return null;
  }
}

module.exports = { getPublicKey, decryptField };
