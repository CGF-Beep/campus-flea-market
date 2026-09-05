// RSA 敏感字段加密工具
// 获取后端下发的 RSA 公钥，用 jsencrypt 加密密码/手机号等敏感字段后再传输
// 公钥内存缓存：刷新页面后重新获取，服务端密钥轮换后刷新页面即可恢复
import { JSEncrypt } from 'jsencrypt'

// 与 request.js 保持一致：生产构建用 VITE_API_URL 绝对地址，本地开发回退到 '/api'（Vite 代理转发）。
// 不能硬编码相对路径 '/api'：前端托管域名与 API 域名不一致时，会请求到前端自己域名下导致 404。
const API_BASE = import.meta.env.VITE_API_URL || '/api'

let publicKeyCache = null

// 获取后端 RSA 公钥（首次调用时请求，之后内存缓存）
async function getPublicKey() {
  if (publicKeyCache) return publicKeyCache
  const res = await fetch(`${API_BASE}/auth/public-key`)
  let data
  try {
    data = await res.json()
  } catch (err) {
    throw new Error(`获取加密公钥失败：${err.message || '接口返回非 JSON'}`)
  }
  if (data?.code !== 200 || !data.data?.publicKey) {
    throw new Error('获取加密公钥失败：接口返回异常')
  }
  publicKeyCache = data.data.publicKey
  return publicKeyCache
}

// 使用公钥加密敏感字段，返回 Base64 密文（空值原样返回）
export async function encryptSensitive(text) {
  if (text === undefined || text === null || text === '') return text
  const key = await getPublicKey()
  const encryptor = new JSEncrypt()
  encryptor.setPublicKey(key)
  const encrypted = encryptor.encrypt(String(text))
  if (!encrypted) {
    throw new Error('数据加密失败')
  }
  return encrypted
}
