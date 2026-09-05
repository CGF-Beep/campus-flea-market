package com.campusfleamarket.config;

import com.campusfleamarket.security.RateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 限流器配置，对应 routes/index.js 中 express-rate-limit 的两个实例：
 * - 登录：15 分钟最多 10 次/IP
 * - 注册：1 小时最多 5 次/IP
 */
@Configuration
public class RateLimitConfig {

    private final AppProperties props;

    public RateLimitConfig(AppProperties props) {
        this.props = props;
    }

    @Bean
    public RateLimiter loginRateLimiter() {
        return new RateLimiter(15 * 60 * 1000L, 10, "登录尝试过于频繁，请15分钟后再试", props.isTrustedProxy());
    }

    @Bean
    public RateLimiter registerRateLimiter() {
        return new RateLimiter(60 * 60 * 1000L, 5, "注册过于频繁，请1小时后再试", props.isTrustedProxy());
    }
}
