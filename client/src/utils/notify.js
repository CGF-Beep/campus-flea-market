// 统一兜底错误提示
//
// 背景：request.js 的响应拦截器已经统一提示了「axios 请求错误」和「业务错误码」，
// 但有些异常不是请求产生的（例如获取 RSA 公钥失败、敏感字段加密失败），它们会在
// 页面 catch 中被静默吞掉，导致用户点了按钮既没成功提示也没失败提示。
//
// 用法：在页面 catch 中调用 notifyUnexpected(e)，只对「未被拦截器处理过的异常」提示。
import { ElMessage } from 'element-plus'

export function notifyUnexpected(err) {
  // axios 错误（AxiosError）与拦截器 reject 的业务对象（{code,message,data}）都已提示过，不再重复
  const handledByInterceptor = err?.isAxiosError === true || (err && typeof err === 'object' && !err.stack)
  if (!handledByInterceptor) {
    ElMessage.error(err?.message || '操作失败')
  }
}
