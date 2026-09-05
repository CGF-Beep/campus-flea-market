package com.campusfleamarket.controller;

import com.campusfleamarket.common.ApiResponse;
import com.campusfleamarket.dto.LoginRequest;
import com.campusfleamarket.dto.RegisterRequest;
import com.campusfleamarket.security.RateLimiter;
import com.campusfleamarket.security.RequireAuth;
import com.campusfleamarket.service.AuthService;
import com.campusfleamarket.util.RsaUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 认证接口，对应 routes/index.js 认证路由：
 * GET  /api/auth/public-key   （无鉴权）
 * POST /api/auth/register     （无鉴权 + 注册限流 1h/5）
 * POST /api/auth/login        （无鉴权 + 登录限流 15min/10）
 * GET  /api/auth/profile      （@RequireAuth）
 * PUT  /api/auth/profile      （@RequireAuth）
 * PUT  /api/auth/password     （@RequireAuth）
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RsaUtil rsaUtil;
    @Qualifier("loginRateLimiter")
    private final RateLimiter loginRateLimiter;
    @Qualifier("registerRateLimiter")
    private final RateLimiter registerRateLimiter;

    /**
     * 获取 RSA 公钥（前端加密密码/手机号等敏感字段用）。
     * 响应：{ code:200, message:'操作成功', data:{ publicKey: PEM } }
     */
    @GetMapping("/public-key")
    public ApiResponse<Map<String, String>> publicKey() {
        return ApiResponse.success(Map.of("publicKey", rsaUtil.getPublicKey()));
    }

    /**
     * 注册。限流：1 小时 5 次/IP，超限返回 429「注册过于频繁，请1小时后再试」
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<?>> register(@RequestBody(required = false) RegisterRequest req,
                                                   HttpServletRequest request,
                                                   HttpServletResponse response) {
        RateLimiter.Result limit = registerRateLimiter.checkAndRecord(request, response);
        if (!limit.allowed) {
            return ResponseEntity.status(429).body(ApiResponse.error(registerRateLimiter.getMessage(), 429));
        }
        if (req == null) {
            req = new RegisterRequest();
        }
        AuthService.AuthResult result = authService.register(req);
        return ResponseEntity.status(result.status()).body(result.body());
    }

    /**
     * 登录。限流：15 分钟 10 次/IP，超限返回 429「登录尝试过于频繁，请15分钟后再试」
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<?>> login(@RequestBody(required = false) LoginRequest req,
                                                HttpServletRequest request,
                                                HttpServletResponse response) {
        RateLimiter.Result limit = loginRateLimiter.checkAndRecord(request, response);
        if (!limit.allowed) {
            return ResponseEntity.status(429).body(ApiResponse.error(loginRateLimiter.getMessage(), 429));
        }

        // 空请求体 → 空对象，password 为空 → 解密失败分支（对齐 Express {} 的行为）
        if (req == null) {
            req = new LoginRequest();
        }
        AuthService.AuthResult result = authService.login(req);
        return ResponseEntity.status(result.status()).body(result.body());
    }

    /** 获取当前用户信息（对应 authController.getProfile） */
    @GetMapping("/profile")
    @RequireAuth
    public ResponseEntity<ApiResponse<?>> profile() {
        AuthService.AuthResult result = authService.getProfile();
        return ResponseEntity.status(result.status()).body(result.body());
    }

    /** 更新个人资料（手机号可选 RSA 加密；对应 authController.updateProfile） */
    @PutMapping("/profile")
    @RequireAuth
    public ResponseEntity<ApiResponse<?>> updateProfile(@RequestBody(required = false) Map<String, Object> body) {
        AuthService.AuthResult result = authService.updateProfile(body == null ? Map.of() : body);
        return ResponseEntity.status(result.status()).body(result.body());
    }

    /** 修改密码（原/新密码均 RSA 加密；对应 authController.changePassword） */
    @PutMapping("/password")
    @RequireAuth
    public ResponseEntity<ApiResponse<?>> changePassword(@RequestBody(required = false) Map<String, Object> body) {
        AuthService.AuthResult result = authService.changePassword(body == null ? Map.of() : body);
        return ResponseEntity.status(result.status()).body(result.body());
    }
}
