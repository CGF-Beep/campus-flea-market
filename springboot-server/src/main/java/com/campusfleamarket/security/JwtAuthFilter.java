package com.campusfleamarket.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * JWT 解析过滤器：对所有请求尝试解析 Authorization: Bearer <token>，
 * 将结果写入 UserContext（对应 Express 中间件解析 req.user）。
 *
 * 注意：本过滤器只解析、不拦截——是否要求登录由 @RequireAuth/@RequireAdmin
 * 切面按接口决定（对应 Express 路由上挂不挂 authenticate 中间件）。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            String authHeader = request.getHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                UserContext.set(UserContext.State.NO_TOKEN, null);
            } else {
                String token = authHeader.substring(7).trim();
                Claims claims = jwtUtil.parse(token);
                if (claims == null) {
                    UserContext.set(UserContext.State.INVALID, null);
                } else {
                    UserContext.set(UserContext.State.VALID,
                            new UserContext.CurrentUser(jwtUtil.getId(claims), jwtUtil.getUsername(claims), jwtUtil.getRole(claims)));
                }
            }
            chain.doFilter(request, response);
        } finally {
            UserContext.clear();
        }
    }
}
