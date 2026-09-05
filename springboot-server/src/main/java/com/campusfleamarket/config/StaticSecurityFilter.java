package com.campusfleamarket.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.File;
import java.io.IOException;

/**
 * 静态资源相关过滤器，对齐 app.js：
 * 1. /uploads/** 响应加 X-Content-Type-Options: nosniff（禁止浏览器嗅探上传内容类型）
 * 2. SPA 回退：client/dist 存在时，非 /api /uploads /health 的 GET 请求回退到 index.html
 *    （对应 app.js 中 SPA 路由回退正则：排除 api、uploads、health 前缀）
 */
@Component
@Order(20)
@RequiredArgsConstructor
public class StaticSecurityFilter extends OncePerRequestFilter {

    private final AppProperties props;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();

        // 1. 上传目录响应头
        if (uri.startsWith("/uploads/")) {
            response.setHeader("X-Content-Type-Options", "nosniff");
        }

        // 2. SPA 回退（仅 GET，且路径不含文件扩展名）
        File dist = new File(props.getClientDistDir());
        if (!dist.isAbsolute()) {
            dist = new File(System.getProperty("user.dir"), props.getClientDistDir());
        }
        boolean spaEnabled = new File(dist, "index.html").exists();
        if (spaEnabled && "GET".equalsIgnoreCase(request.getMethod())
                && !uri.startsWith("/api")
                && !uri.startsWith("/uploads")
                && !uri.equals("/health")
                && !uri.contains(".")) {
            request.getRequestDispatcher("/index.html").forward(request, response);
            return;
        }

        chain.doFilter(request, response);
    }
}
