package com.campusfleamarket.security;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 鉴权切面，对应 Express 的 authenticate / requireAdmin 中间件。
 * 通过 @RequireAuth / @RequireAdmin 注解触发；@Around 拦截可阻止方法继续执行。
 *
 * 校验顺序与 Express 一致（authenticate → requireAdmin）：
 * - 未携带 token → 401 {"code":401,"message":"未登录或token已失效"}（无 data 字段）
 * - token 无效/过期 → 401 {"code":401,"message":"token无效或已过期"}（无 data 字段）
 * - 非 admin → 403 {"code":403,"message":"无权限访问"}（无 data 字段）
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuthAspect {

    @Around("@annotation(com.campusfleamarket.security.RequireAuth) || @within(com.campusfleamarket.security.RequireAuth)")
    public Object checkAuth(ProceedingJoinPoint pjp) throws Throwable {
        UserContext.State state = UserContext.getState();
        if (state == UserContext.State.NO_TOKEN) {
            writeJson(401, "未登录或token已失效");
            return null;
        }
        if (state == UserContext.State.INVALID) {
            writeJson(401, "token无效或已过期");
            return null;
        }
        return pjp.proceed();
    }

    @Around("@annotation(com.campusfleamarket.security.RequireAdmin) || @within(com.campusfleamarket.security.RequireAdmin)")
    public Object checkAdmin(ProceedingJoinPoint pjp) throws Throwable {
        // 与 Express 一致：先走 authenticate 的 401 判断，再判断 admin 角色
        UserContext.State state = UserContext.getState();
        if (state == UserContext.State.NO_TOKEN) {
            writeJson(401, "未登录或token已失效");
            return null;
        }
        if (state == UserContext.State.INVALID) {
            writeJson(401, "token无效或已过期");
            return null;
        }
        UserContext.CurrentUser user = UserContext.getUser();
        if (user == null || !"admin".equals(user.getRole())) {
            writeJson(403, "无权限访问");
            return null;
        }
        return pjp.proceed();
    }

    private void writeJson(int status, String message) throws IOException {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) return;
        HttpServletResponse response = attrs.getResponse();
        if (response == null || response.isCommitted()) return;
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        // 与原 Express 一致：{code, message}，不含 data 字段
        response.getOutputStream().write(
                ("{\"code\":" + status + ",\"message\":\"" + message + "\"}").getBytes(StandardCharsets.UTF_8));
        // 提交响应，防止后续 Spring MVC 处理覆盖状态码
        response.flushBuffer();
    }
}
