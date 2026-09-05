package com.campusfleamarket.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 业务配置项，对应原 Express 的 .env 环境变量。
 */
@Data
@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    /** JWT 密钥，必须与原 Express 的 JWT_SECRET 一致 */
    private String jwtSecret;

    /** JWT 过期时间（秒），对应原 JWT_EXPIRES=7d */
    private long jwtExpiresSeconds = 604800;

    /** RSA 私钥路径（PKCS8 PEM） */
    private String rsaPrivateKeyPath = "keys/rsa_private.pem";

    /** 上传文件保存目录（复用原 Express 的 uploads） */
    private String uploadDir = "../server/src/uploads";

    /** 前端地址（CORS 白名单） */
    private String clientUrl = "http://localhost:5173";

    /** 前端构建产物目录，存在时开启 SPA 回退 */
    private String clientDistDir = "../client/dist";

    /** 是否信任反向代理（true 时取 X-Forwarded-For 做限流） */
    private boolean trustedProxy = true;
}
