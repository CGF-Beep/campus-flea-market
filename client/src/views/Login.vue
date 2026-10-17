<!-- 用户登录页：账号密码登录、表单校验 -->
<template>
  <div class="auth-page login-page">
    <div class="glow glow-a" aria-hidden="true"></div>
    <div class="glow glow-b" aria-hidden="true"></div>

    <section class="brand">
      <img :src="logoImg" class="brand-logo" alt="乐购" />
      <h2>把闲置，<br />变成<span>礼物</span>。</h2>
      <p>乐购是一个让物品延续价值的校园市集。</p>
    </section>

    <section class="login-glass">
      <div class="login-header">
        <span class="header-icon"><el-icon><Collection /></el-icon></span>
        <h1>欢迎回来</h1>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" class="login-form">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            size="large"
            :prefix-icon="User"
            class="apple-input"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            size="large"
            show-password
            class="apple-input"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          登录
        </el-button>
        <div class="login-footer">
          还没有账号？<span class="link" @click="$router.push('/register')">立即注册</span>
        </div>
      </el-form>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { User, Lock, Collection } from '@element-plus/icons-vue'
import logoImg from '@/assets/logo.png'
import { notifyUnexpected } from '@/utils/notify'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const formRef = ref()
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  // 手动校验（不依赖 el-form validate，避免个别环境下校验不触发导致"点了没反应"）
  const name = form.username.trim()
  if (!name || !form.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  if (name.length < 3 || name.length > 20) {
    ElMessage.warning('用户名需 3-20 个字符')
    return
  }
  if (form.password.length < 6 || form.password.length > 20) {
    ElMessage.warning('密码需 6-20 个字符')
    return
  }

  loading.value = true
  try {
    await userStore.login({ username: name, password: form.password })
    ElMessage.success('登录成功')
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (e) {
    notifyUnexpected(e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ===== 整体背景：浅色，左侧淡蓝紫漫射光晕 ===== */
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 14%;
  overflow: hidden;
  background:
    radial-gradient(60vw 60vw at 12% 42%, rgba(120, 150, 235, 0.18), transparent 60%),
    radial-gradient(46vw 46vw at 30% 78%, rgba(175, 150, 235, 0.14), transparent 58%),
    linear-gradient(135deg, #f7f9fc 0%, #eef2f8 100%);
  transition: background 0.6s ease;
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  pointer-events: none;
  z-index: 0;
}

.glow-a {
  width: 50vw;
  height: 50vw;
  min-width: 360px;
  min-height: 360px;
  left: -6vw;
  top: 4%;
  background: rgba(140, 165, 240, 0.16);
  animation: float-a 34s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
}

.glow-b {
  width: 36vw;
  height: 36vw;
  min-width: 280px;
  min-height: 280px;
  left: 22%;
  bottom: -12%;
  background: rgba(180, 158, 232, 0.12);
  animation: float-b 30s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
}

@keyframes float-a {
  0% { transform: translate3d(0, 0, 0) scale(1); }
  100% { transform: translate3d(4vw, -3vh, 0) scale(1.06); }
}

@keyframes float-b {
  0% { transform: translate3d(0, 0, 0) scale(1); }
  100% { transform: translate3d(-3vw, 4vh, 0) scale(1.04); }
}

/* ===== 左侧品牌文案 ===== */
.brand {
  position: absolute;
  left: 9%;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  max-width: 440px;
  color: #2b2d31;
  animation: rise 0.75s cubic-bezier(0.22, 0.61, 0.36, 1) both 0.05s;
}

.brand-logo {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 10px 26px rgba(26, 30, 38, 0.08);
  padding: 10px;
  object-fit: contain;
  margin-bottom: 30px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.brand h2 {
  font-size: 44px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.24;
  margin-bottom: 22px;
  color: #2b2d31;
}

.brand h2 span {
  color: #5b7cc7;
}

.brand p {
  font-size: 16px;
  color: #6f727a;
  line-height: 1.75;
  font-weight: 400;
}

/* ===== 右侧玻璃卡片 ===== */
.login-glass {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 424px;
  padding: 44px 42px 46px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(22px) saturate(150%);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.85);
  box-shadow:
    0 1px 2px rgba(26, 30, 38, 0.06),
    0 14px 34px rgba(26, 30, 38, 0.08),
    0 36px 70px rgba(26, 30, 38, 0.07);
  animation: rise 0.75s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

@keyframes rise {
  from { opacity: 0; transform: translate3d(0, 16px, 0); }
  to { opacity: 1; transform: none; }
}

.login-header {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 34px;
}

.header-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7e9bd0 0%, #5b7cc7 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(91, 124, 199, 0.22);
}

.login-header h1 {
  font-size: 22px;
  font-weight: 600;
  color: #2b2d31;
  letter-spacing: -0.01em;
}

/* ===== 表单 ===== */
.login-form {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 18px;
  width: 100%;
}

.login-form :deep(.el-form-item__content) {
  width: 100%;
}

.login-form :deep(.el-form-item__error) {
  font-size: 12px;
  padding-top: 5px;
  color: #b4798a;
}

/* 输入框：柔和聚焦过渡 */
.apple-input :deep(.el-input__wrapper) {
  height: 54px;
  border-radius: 15px;
  font-size: 15px;
  padding: 0 18px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 0 0 1px rgba(26, 30, 38, 0.07);
  transition:
    background 0.38s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.38s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.apple-input :deep(.el-input__inner) {
  color: #2b2d31;
  font-size: 15px;
}

.apple-input :deep(.el-input__inner)::placeholder {
  color: #9a9da5;
}

.apple-input :deep(.el-input__wrapper:hover) {
  background: rgba(255, 255, 255, 0.92);
}

.apple-input :deep(.el-input__wrapper.is-focus) {
  background: rgba(255, 255, 255, 0.95);
  box-shadow:
    inset 0 0 0 1.5px rgba(91, 124, 199, 0.32),
    0 0 0 4px rgba(91, 124, 199, 0.16);
}

.apple-input :deep(.el-input__icon) {
  color: #9a9da5;
  font-size: 16px;
  transition: color 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.apple-input :deep(.el-input__wrapper.is-focus .el-input__icon) {
  color: #5b7cc7;
}

/* 提交按钮：hover + 加载动效 */
.login-btn {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 52px !important;
  border-radius: 980px !important;
  font-size: 16px !important;
  font-weight: 500 !important;
  letter-spacing: 0.03em;
  margin-top: 10px !important;
  border: none !important;
  background: linear-gradient(135deg, #7e9bd0 0%, #5b7cc7 100%) !important;
  color: #fff !important;
  box-shadow: 0 3px 12px rgba(91, 124, 199, 0.22);
  transition:
    transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.34s cubic-bezier(0.22, 0.61, 0.36, 1),
    filter 0.34s ease;
}

.login-btn:hover {
  transform: translate3d(0, -1px, 0);
  box-shadow: 0 8px 22px rgba(91, 124, 199, 0.22);
  filter: brightness(1.04);
}

.login-btn:active {
  transform: translate3d(0, 0, 0) scale(0.99);
  box-shadow: 0 3px 10px rgba(91, 124, 199, 0.22);
}

.login-btn.is-loading {
  cursor: progress;
}

.login-btn.is-loading::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    100deg,
    transparent 32%,
    rgba(255, 255, 255, 0.14) 50%,
    transparent 68%
  );
  background-size: 220% 100%;
  animation: sheen 2.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes sheen {
  0% { background-position: 140% 0; }
  100% { background-position: -40% 0; }
}

.login-btn :deep(.el-icon.is-loading) {
  animation: soft-spin 1.25s cubic-bezier(0.42, 0.12, 0.3, 0.95) infinite;
}

@keyframes soft-spin {
  to { transform: rotate(360deg); }
}

.login-footer {
  margin-top: 26px;
  font-size: 14px;
  color: #6f727a;
  text-align: center;
}

.link {
  color: #5b7cc7;
  cursor: pointer;
  font-weight: 500;
  margin-left: 5px;
  transition: opacity 0.25s ease, text-decoration-color 0.25s ease;
}

.link:hover {
  opacity: 0.78;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* ===== 响应式：移动端单列垂直布局 ===== */
@media (max-width: 768px) {
  /* ≤768 完全上下堆叠撑满（与项目其他视图断点一致） */
  .login-page {
    flex-direction: column;
    justify-content: flex-start;
    padding: 24px 20px calc(80px + env(safe-area-inset-bottom));
    align-items: stretch;
  }
  .brand {
    position: static;
    transform: none;
    margin: 12px auto 20px;
    text-align: center;
    max-width: 100%;
  }
  .brand-logo { margin-bottom: 14px; }
  .brand h2 { font-size: 26px; margin-bottom: 8px; }
  .brand p { font-size: 14px; }
  .login-glass {
    max-width: 100%;
    margin: 0;
    padding: 28px 22px 32px;
    border-radius: 22px;
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
  }
}

@media (max-width: 520px) {
  .brand { margin-top: 44px; }
  .brand h2 { font-size: 28px; }
  .login-glass {
    padding: 34px 24px 38px;
    border-radius: 24px;
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
  }
}

/* ===== 无障碍：尊重系统减少动效偏好 ===== */
@media (prefers-reduced-motion: reduce) {
  .glow,
  .brand,
  .login-glass,
  .login-btn.is-loading::after {
    animation: none !important;
  }
  .login-btn :deep(.el-icon.is-loading) {
    animation: soft-spin 1.6s linear infinite !important;
  }
}
</style>
