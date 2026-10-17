<!-- 个人信息页：资料展示、编辑、头像上传、密码修改 -->
<template>
  <div class="profile">
    <div class="profile-container">
      <div class="profile-layout">
        <!-- 左侧：头像 + 密码合并卡 -->
        <div class="profile-left">
          <div class="card user-card">
            <div class="user-body">
              <div class="user-avatar" :class="{ 'avatar-uploading': uploading }" @click="triggerUpload" title="点击更换头像">
                <img v-if="userStore.user?.avatar && !avatarError" :src="userStore.user.avatar" alt="avatar" @error="avatarError = true" />
                <span v-else class="avatar-fallback">{{ (userStore.user?.nickname || userStore.user?.username || '用')[0] }}</span>
                <div class="avatar-mask">
                  <span class="avatar-mask-text">{{ uploading ? '上传中…' : '更换头像' }}</span>
                </div>
                <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden @change="handleFileChange" />
              </div>
              <h3 class="user-name">{{ userStore.user?.nickname || userStore.user?.username }}</h3>
              <span class="role-pill" :class="userStore.user?.role === 'admin' ? 'pill-admin' : 'pill-user'">
                {{ userStore.user?.role === 'admin' ? '管理员' : '校园用户' }}
              </span>
            </div>

            <!-- 移动端：折叠为一行入口，点击从底部滑出表单（桌面端由 CSS 隐藏） -->
            <button type="button" class="pwd-trigger" @click="pwdVisible = true">
              <span>修改密码</span>
              <el-icon :size="16"><ArrowRight /></el-icon>
            </button>

            <!-- 移动端浮层遮罩 -->
            <div class="pwd-mask" :class="{ show: pwdVisible }" @click="pwdVisible = false"></div>

            <div class="pwd-section" :class="{ 'sheet-open': pwdVisible }">
              <!-- 移动端浮层顶部条（桌面端隐藏） -->
              <div class="pwd-sheet-bar">
                <span class="pwd-sheet-title">修改密码</span>
                <button type="button" class="pwd-sheet-close" @click="pwdVisible = false">关闭</button>
              </div>
              <div class="section-title">修改密码</div>
              <el-form :model="pwdForm" label-position="top" @submit.prevent>
                <el-form-item label="原密码">
                  <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="输入当前密码" class="input-rounded" />
                </el-form-item>
                <el-form-item label="新密码">
                  <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少 6 位" class="input-rounded" />
                </el-form-item>
                <div class="form-actions">
                  <button type="button" class="btn-primary" @click="handleChangePwd">更新密码</button>
                </div>
              </el-form>
            </div>
          </div>
        </div>

        <!-- 右侧：个人信息 -->
        <div class="profile-right">
          <div class="card info-card">
            <div class="card-header">
              <div>
                <h3 class="card-title">个人信息</h3>
                <p class="card-sub">完善资料，让交易更顺畅</p>
              </div>
              <button v-if="!editing" type="button" class="btn-text" @click="startEdit">编辑资料</button>
            </div>

            <!-- 展示模式 -->
            <div v-if="!editing" class="info-list">
              <div class="info-row">
                <span class="info-label">用户名</span>
                <span class="info-value">{{ form.username || '—' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">昵称</span>
                <span class="info-value">{{ form.nickname || '—' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">手机号</span>
                <span class="info-value">{{ form.phone || '—' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">邮箱</span>
                <span class="info-value">{{ form.email || '—' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">学号</span>
                <span class="info-value">{{ form.studentId || '—' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">学院</span>
                <span class="info-value">{{ form.college || '—' }}</span>
              </div>
            </div>

            <!-- 编辑模式 -->
            <div v-else class="edit-form">
              <el-form :model="form" label-position="top" @submit.prevent>
                <div class="form-grid">
                  <el-form-item label="昵称">
                    <el-input v-model="form.nickname" placeholder="输入昵称" class="input-rounded" />
                  </el-form-item>
                  <el-form-item label="手机号">
                    <el-input v-model="form.phone" placeholder="输入手机号" class="input-rounded" />
                  </el-form-item>
                  <el-form-item label="邮箱">
                    <el-input v-model="form.email" placeholder="输入邮箱" class="input-rounded" />
                  </el-form-item>
                  <el-form-item label="学号">
                    <el-input v-model="form.studentId" placeholder="输入学号" class="input-rounded" />
                  </el-form-item>
                  <el-form-item label="学院" class="col-full">
                    <el-select v-model="form.college" placeholder="请选择所在学院" class="input-rounded select-full">
                      <el-option v-for="c in COLLEGES" :key="c" :label="c" :value="c" />
                    </el-select>
                  </el-form-item>
                </div>
                <div class="form-actions">
                  <button type="button" class="btn-primary" @click="handleSave">保存修改</button>
                  <button type="button" class="btn-ghost" @click="cancelEdit">取消</button>
                </div>
              </el-form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { updateProfile, changePassword, uploadFile } from '@/api'
import { COLLEGES } from '@/utils/profile'
import { notifyUnexpected } from '@/utils/notify'
import { ArrowRight } from '@element-plus/icons-vue'

const userStore = useUserStore()
const editing = ref(false)
const form = reactive({})
const pwdForm = reactive({ oldPassword: '', newPassword: '' })
const fileInput = ref(null)
const uploading = ref(false)
const avatarError = ref(false)
// 移动端「修改密码」浮层开关（桌面端该入口被 CSS 隐藏，始终为 false）
const pwdVisible = ref(false)

// 写回本地存储时保留 token，否则后续请求会因缺少 Authorization 被登出
const persistUser = (data) => {
  const saved = localStorage.getItem('user')
  const token = saved ? JSON.parse(saved).token : null
  localStorage.setItem('user', JSON.stringify({ ...data, token }))
}

const triggerUpload = () => {
  if (uploading.value) return
  fileInput.value?.click()
}

const handleFileChange = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    ElMessage.warning('仅支持 jpg/png/gif/webp 格式的图片')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 5MB')
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data: uploadRes } = await uploadFile(formData)
    const updateRes = await updateProfile({ avatar: uploadRes.url })
    userStore.user = updateRes.data
    persistUser(updateRes.data)
    Object.assign(form, updateRes.data)
    avatarError.value = false
    ElMessage.success('头像更新成功')
  } catch (err) {
    notifyUnexpected(err)
  } finally {
    uploading.value = false
  }
}

const startEdit = () => {
  Object.assign(form, userStore.user)
  editing.value = true
}

const handleSave = async () => {
  try {
    const res = await updateProfile(form)
    userStore.user = res.data
    persistUser(res.data)
    Object.assign(form, res.data)
    editing.value = false
    ElMessage.success('保存成功')
  } catch (e) {
    notifyUnexpected(e)
  }
}

const cancelEdit = () => {
  Object.assign(form, userStore.user)
  editing.value = false
}

const handleChangePwd = async () => {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) {
    ElMessage.warning('请填写完整')
    return
  }
  if (pwdForm.newPassword.length < 6) {
    ElMessage.warning('新密码不少于6位')
    return
  }
  try {
    await changePassword({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword })
    ElMessage.success('密码修改成功')
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    // 移动端：改完自动收起浮层（桌面端本来就是 false，无副作用）
    pwdVisible.value = false
  } catch (e) {
    notifyUnexpected(e)
  }
}

onMounted(async () => {
  await userStore.fetchProfile()
  Object.assign(form, userStore.user)
})
</script>

<style scoped>
/* 页面 */
.profile {
  min-height: 100vh;
  background: #f7f8fa;
  padding: 40px 24px;
}

.profile-container {
  max-width: 1120px;
  margin: 0 auto;
}

/* 左右两栏，高度对齐 */
.profile-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 28px;
  align-items: stretch;
}

.profile-left {
  display: flex;
  flex-direction: column;
  gap: 28px;
  height: 100%;
}

.profile-right {
  height: 100%;
}

@media (max-width: 960px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }
  .profile-right {
    height: auto;
  }
}

/* 通用卡片：大圆角 + 柔和浅阴影 */
.card {
  background: #ffffff;
  border-radius: 32px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  transition: box-shadow 0.3s ease;
}

.card:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
}

/* 左侧头像卡 */
.user-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.user-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 28px 28px;
  text-align: center;
}

.user-avatar {
  position: relative;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  border: 4px solid #fff;
  background: linear-gradient(135deg, #5ac8fa, #0071e3);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: transform 0.3s ease;
}

.user-avatar:hover {
  transform: scale(1.03);
}

.avatar-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.user-avatar:hover .avatar-mask,
.avatar-uploading .avatar-mask {
  opacity: 1;
}

.avatar-mask-text {
  font-size: 13px;
  font-weight: 600;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  color: #fff;
  font-size: 36px;
  font-weight: 600;
}

.user-name {
  margin-top: 16px;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
}

.role-pill {
  display: inline-block;
  margin-top: 10px;
  padding: 5px 16px;
  border-radius: 980px;
  font-size: 12px;
  font-weight: 600;
}

.pill-admin {
  color: #c76f00;
  background: rgba(255, 149, 0, 0.12);
}

.pill-user {
  color: #0071e3;
  background: rgba(0, 113, 227, 0.1);
}

/* 移动端「修改密码」入口 / 浮层遮罩 / 浮层顶部条：桌面端一律不显示，
   桌面端仍用下面的内联表单 */
.pwd-trigger,
.pwd-mask,
.pwd-sheet-bar {
  display: none;
}

.pwd-section {
  padding: 24px 28px 28px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 16px;
}

/* 右侧个人信息卡 */
.info-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 28px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 22px;
}

.card-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
}

.card-sub {
  margin-top: 5px;
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.btn-text {
  border: none;
  background: transparent;
  padding: 8px 16px;
  border-radius: 980px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.25s ease;
}

.btn-text:hover {
  background: rgba(0, 113, 227, 0.08);
}

/* 信息列表 */
.info-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-radius: 18px;
  background: #f8f9fb;
}

.info-label {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.info-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  text-align: right;
  word-break: break-all;
  max-width: 60%;
}

/* 编辑表单 */
.edit-form {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 20px;
}

.form-grid .col-full {
  grid-column: 1 / -1;
}

/* ================================================================
   移动端（≤640px）：去卡片背景，改为「页面即容器」的分组式布局
   卡片的白底 / 阴影 / 32px 大圆角在窄屏上会形成一层层「套娃」，
   改用留白 + 分隔线区分区块，同时按窄屏重调字号与内边距比例
   ================================================================ */
@media (max-width: 640px) {
  .profile {
    /* 页面内边距收紧：内容更贴边，可用宽度更大 */
    padding: 20px 16px 32px;
  }

  .profile-layout {
    gap: 20px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-grid .col-full {
    grid-column: auto;
  }

  /* 去掉卡片背景 / 圆角 / 阴影 */
  .card {
    background: transparent;
    border-radius: 0;
    box-shadow: none;
    overflow: visible;
  }
  /* 移动端无 hover，直接取消阴影变化 */
  .card:hover {
    box-shadow: none;
  }

  /* 身份区：由居中大块改为紧凑的顶部区 */
  .user-body {
    padding: 8px 4px 20px;
  }
  .user-name {
    font-size: 19px;
  }

  /* 「修改密码」在移动端折叠为一行入口 + 底部浮层：
     内联表单在窄屏竖占空间太大，收起后页面只剩身份区与信息列表 */
  .pwd-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 14px 2px;
    /* 不再画下边框：紧跟其后的 .info-card 已有 border-top，
       两者相邻会叠成双线 */
    border: none;
    background: transparent;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
  }
  .pwd-trigger .el-icon {
    color: var(--color-text-tertiary);
  }

  /* 浮层遮罩 */
  .pwd-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 2100;
    background: rgba(0, 0, 0, 0.4);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.28s ease, visibility 0.28s ease;
  }
  .pwd-mask.show {
    opacity: 1;
    visibility: visible;
  }

  /* 表单浮层：从底部滑入。
     复用同一份表单 DOM，只是改变呈现方式，避免把表单写两遍 */
  .pwd-section {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2200;
    max-height: 86vh;
    overflow-y: auto;
    padding: 18px 20px calc(22px + env(safe-area-inset-bottom));
    background: #fff;
    border-top: none;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.16);
    transform: translateY(110%);
    transition: transform 0.32s cubic-bezier(0.25, 0.1, 0.25, 1);
  }
  .pwd-section.sheet-open {
    transform: translateY(0);
  }

  /* 浮层顶部条（含关闭） */
  .pwd-sheet-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .pwd-sheet-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text);
  }
  .pwd-sheet-close {
    border: none;
    background: transparent;
    padding: 4px 0;
    font-size: 14px;
    color: var(--color-primary);
    cursor: pointer;
  }

  /* 顶部条已有标题，隐藏原小节标题避免重复 */
  .pwd-section .section-title {
    display: none;
  }

  .info-card {
    padding: 20px 4px 0;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }

  /* 字号比例：标题收一档，正文保持 14px 可读 */
  .card-title {
    font-size: 17px;
  }
  .card-sub {
    margin-top: 3px;
    font-size: 12px;
  }
  .card-header {
    margin-bottom: 14px;
  }
  .section-title {
    font-size: 15px;
    margin-bottom: 14px;
  }

  /* 信息行：去掉灰底块，改为轻量的分隔线列表 */
  .info-list {
    gap: 0;
  }
  .info-row {
    padding: 14px 2px;
    border-radius: 0;
    background: transparent;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }
  .info-row:last-child {
    border-bottom: none;
  }
}

.input-rounded :deep(.el-input__wrapper) {
  border-radius: 14px;
  height: 46px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.04);
}

.input-rounded :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1), 0 0 0 1px rgba(0, 113, 227, 0.2);
}

/* 学院下拉：宽度撑满，圆角高度与其他输入框保持一致 */
.select-full {
  width: 100%;
}

.select-full :deep(.el-select__wrapper) {
  border-radius: 14px;
  min-height: 46px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.04);
}

.select-full :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1), 0 0 0 1px rgba(0, 113, 227, 0.2);
}


.form-actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
  padding-top: 20px;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 12px 28px;
  border-radius: 980px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 113, 227, 0.28);
}

.btn-ghost {
  border: none;
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text);
  padding: 12px 28px;
  border-radius: 980px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-ghost:hover {
  background: rgba(0, 0, 0, 0.09);
}
</style>
