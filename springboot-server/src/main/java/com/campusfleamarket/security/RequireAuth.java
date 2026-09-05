package com.campusfleamarket.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 需要登录（对应 Express 路由上的 authenticate 中间件）。
 * 校验失败返回：
 * - 未携带 token：401 {code:401, message:'未登录或token已失效'}
 * - token 无效/过期：401 {code:401, message:'token无效或已过期'}
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireAuth {
}
