package com.campusfleamarket.security;

import com.campusfleamarket.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

/**
 * JWT 工具，对应原 jsonwebtoken 用法：
 * - 载荷 { id, username, role }（无 sub），HS256 签名
 * - 密钥为 JWT_SECRET 字符串的 UTF-8 字节（与原 jsonwebtoken 完全一致，
 *   确保迁移期间旧 token 也能被本服务校验）
 * - 过期时间与 jsonwebtoken 的 expiresIn: '7d' 语义一致（绝对时长）
 */
@Component
public class JwtUtil {

    private final AppProperties props;
    private final SecretKey key;

    public JwtUtil(AppProperties props) {
        this.props = props;
        this.key = Keys.hmacShaKeyFor(props.getJwtSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(Integer id, String username, String role) {
        Instant now = Instant.now();
        Instant exp = now.plus(props.getJwtExpiresSeconds(), ChronoUnit.SECONDS);
        return Jwts.builder()
                .claim("id", id)
                .claim("username", username)
                .claim("role", role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                // 强制 HS256，与原 jsonwebtoken 默认算法一致（jjwt 默认按密钥长度选算法，需显式指定）
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * 解析 token，成功返回载荷，失败返回 null（对应 jwt.verify 抛异常被捕获）。
     */
    public Claims parse(String token) {
        try {
            return Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();
        } catch (Exception e) {
            return null;
        }
    }

    /** 从 Claims 中取 id（jsonwebtoken 中为 number，兼容 Integer/Long） */
    public Integer getId(Claims claims) {
        Object v = claims.get("id");
        return v == null ? null : ((Number) v).intValue();
    }

    public String getUsername(Claims claims) {
        return claims.get("username", String.class);
    }

    public String getRole(Claims claims) {
        return claims.get("role", String.class);
    }
}
