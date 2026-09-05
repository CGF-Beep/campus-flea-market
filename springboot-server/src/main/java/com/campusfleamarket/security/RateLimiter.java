package com.campusfleamarket.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 通用滑动窗口限流器，对应 Express 的 express-rate-limit：
 * - 按 IP 计数（trusted-proxy 开启时取 X-Forwarded-For 第一个）
 * - 超限响应：429 {"code":429,"message":"<message>","data":null}
 * - 响应头：RateLimit-Limit / RateLimit-Remaining / RateLimit-Reset
 *   （对应 express-rate-limit v8 的 standardHeaders: true, legacyHeaders: false）
 * - 进程内内存实现（与原 express-rate-limit 默认内存存储一致，重启即清零）
 *
 * 使用方式：在 RateLimitConfig 中声明带不同参数的 Bean（登录 15min/10，注册 1h/5）。
 */
public class RateLimiter {

    private final long windowMs;
    private final int max;
    private final String message;
    private final boolean trustedProxy;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public RateLimiter(long windowMs, int max, String message, boolean trustedProxy) {
        this.windowMs = windowMs;
        this.max = max;
        this.message = message;
        this.trustedProxy = trustedProxy;
    }

    public static class Result {
        public final boolean allowed;
        public final long resetEpochSec;

        Result(boolean allowed, long resetEpochSec) {
            this.allowed = allowed;
            this.resetEpochSec = resetEpochSec;
        }
    }

    public String getMessage() {
        return message;
    }

    /**
     * 对本次请求计一次并判断是否放行；无论放行与否均写入响应头。
     */
    public Result checkAndRecord(HttpServletRequest request, HttpServletResponse response) {
        String ip = clientIp(request);
        long now = System.currentTimeMillis();

        Deque<Long> timestamps = hits.computeIfAbsent(ip, k -> new ArrayDeque<>());

        boolean allowed;
        long resetEpochSec;
        synchronized (timestamps) {
            // 清理窗口外的时间戳
            while (!timestamps.isEmpty() && timestamps.peekFirst() <= now - windowMs) {
                timestamps.pollFirst();
            }
            long oldest = timestamps.peekFirst() == null ? now : timestamps.peekFirst();
            resetEpochSec = (oldest + windowMs) / 1000;

            if (timestamps.size() >= max) {
                allowed = false;
            } else {
                timestamps.addLast(now);
                allowed = true;
            }
        }

        long remaining = Math.max(0, max - timestamps.size());
        response.setHeader("RateLimit-Limit", String.valueOf(max));
        response.setHeader("RateLimit-Remaining", String.valueOf(remaining));
        response.setHeader("RateLimit-Reset", String.valueOf(resetEpochSec));
        return new Result(allowed, resetEpochSec);
    }

    /**
     * 取客户端 IP：trusted-proxy 开启时取 X-Forwarded-For 第一个（对应 Express trust proxy=1）。
     */
    private String clientIp(HttpServletRequest request) {
        if (trustedProxy) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                return xff.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }
}
