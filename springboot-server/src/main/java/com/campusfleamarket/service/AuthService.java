package com.campusfleamarket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.campusfleamarket.common.ApiResponse;
import com.campusfleamarket.dto.LoginData;
import com.campusfleamarket.dto.LoginRequest;
import com.campusfleamarket.dto.RegisterRequest;
import com.campusfleamarket.dto.UserVO;
import com.campusfleamarket.entity.User;
import com.campusfleamarket.mapper.UserMapper;
import com.campusfleamarket.security.JwtUtil;
import com.campusfleamarket.security.UserContext;
import com.campusfleamarket.util.RsaUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 认证服务，逻辑与校验顺序严格对照 controllers/authController.js。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String DEFAULT_AVATAR = "/uploads/default-avatar.svg";

    private final UserMapper userMapper;
    private final RsaUtil rsaUtil;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // ==================== 注册 ====================

    /**
     * 注册，对应 authController.register 的完整校验顺序。
     */
    public AuthResult register(RegisterRequest req) {
        try {
            // 1. 解密密码/手机号（phone 可选：未传/空串不算失败，仅解密失败才 400）
            String password = rsaUtil.decryptField(req.getPassword());
            String phone = null;
            boolean phoneDecryptFailed = false;
            if (req.getPhone() != null && !req.getPhone().isEmpty()) {
                phone = rsaUtil.decryptField(req.getPhone());
                phoneDecryptFailed = (phone == null);
            }
            if (password == null || phoneDecryptFailed) {
                return AuthResult.of(400, ApiResponse.error("数据解密失败，请刷新页面重试"));
            }

            String username = req.getUsername();
            if (username == null || username.isEmpty() || password == null || password.isEmpty()) {
                return AuthResult.of(400, ApiResponse.error("用户名和密码不能为空"));
            }
            if (username.length() < 3 || username.length() > 20) {
                return AuthResult.of(400, ApiResponse.error("用户名长度3-20个字符"));
            }
            if (password.length() < 6 || password.length() > 20) {
                return AuthResult.of(400, ApiResponse.error("密码长度6-20个字符"));
            }

            User existing = userMapper.selectOne(
                    new LambdaQueryWrapper<User>().eq(User::getUsername, username));
            if (existing != null) {
                return AuthResult.of(400, ApiResponse.error("用户名已存在"));
            }

            // 2. 创建用户（对齐 Sequelize 模型：nickname 缺省用 username、avatar 模型默认值、role/status 默认）
            LocalDateTime now = LocalDateTime.now();
            User user = new User();
            user.setUsername(username);
            user.setPassword(passwordEncoder.encode(password));
            user.setNickname(req.getNickname() == null || req.getNickname().isEmpty() ? username : req.getNickname());
            user.setAvatar(DEFAULT_AVATAR);
            user.setPhone(phone);
            user.setStudentId(req.getStudentId());
            user.setCollege(req.getCollege());
            user.setRole("user");
            user.setStatus(1);
            user.setCreatedAt(now);
            user.setUpdatedAt(now);
            userMapper.insert(user);

            // 3. 签发 token（与登录相同）
            String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());
            return AuthResult.of(200, ApiResponse.success(new LoginData(token, UserVO.from(user)), "注册成功"));
        } catch (Exception e) {
            log.error("注册失败:", e);
            return AuthResult.of(500, ApiResponse.error("注册失败", 500));
        }
    }

    // ==================== 登录 ====================

    /**
     * 登录，对应 authController.login 的完整校验顺序。
     */
    public AuthResult login(LoginRequest req) {
        try {
            String password = rsaUtil.decryptField(req.getPassword());
            if (password == null) {
                return AuthResult.of(400, ApiResponse.error("数据解密失败，请刷新页面重试"));
            }

            String username = req.getUsername();
            if (username == null || username.isEmpty() || password.isEmpty()) {
                return AuthResult.of(400, ApiResponse.error("用户名和密码不能为空"));
            }

            User user = userMapper.selectOne(
                    new LambdaQueryWrapper<User>().eq(User::getUsername, username));
            if (user == null) {
                return AuthResult.of(400, ApiResponse.error("用户名或密码错误"));
            }

            if (user.getStatus() != null && user.getStatus() == 0) {
                return AuthResult.of(403, ApiResponse.error("账号已被禁用，请联系管理员"));
            }

            if (!passwordEncoder.matches(password, user.getPassword())) {
                return AuthResult.of(400, ApiResponse.error("用户名或密码错误"));
            }

            String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());
            return AuthResult.of(200, ApiResponse.success(new LoginData(token, UserVO.from(user)), "登录成功"));
        } catch (Exception e) {
            log.error("登录失败:", e);
            return AuthResult.of(500, ApiResponse.error("登录失败", 500));
        }
    }

    // ==================== 个人资料 ====================

    /**
     * 获取当前用户，对应 authController.getProfile。
     */
    public AuthResult getProfile() {
        try {
            User user = userMapper.selectById(currentUserId());
            if (user == null) {
                return AuthResult.of(404, ApiResponse.error("用户不存在"));
            }
            return AuthResult.of(200, ApiResponse.success(UserVO.from(user)));
        } catch (Exception e) {
            log.error("获取信息失败:", e);
            return AuthResult.of(500, ApiResponse.error("获取信息失败", 500));
        }
    }

    /**
     * 更新个人资料，对应 authController.updateProfile。
     * 用 Map 接收请求体，以区分「字段未传」与「字段传 null」（对齐 JS undefined/null 语义）。
     */
    public AuthResult updateProfile(Map<String, Object> body) {
        try {
            // 手机号为可选密文：传了才解密
            String phone = null;
            if (body.containsKey("phone")) {
                Object raw = body.get("phone");
                phone = (raw == null || String.valueOf(raw).isEmpty())
                        ? (raw == null ? null : String.valueOf(raw))
                        : rsaUtil.decryptField(String.valueOf(raw));
                if (phone == null) {
                    return AuthResult.of(400, ApiResponse.error("数据解密失败，请刷新页面重试"));
                }
            }

            Integer userId = currentUserId();
            User user = userMapper.selectById(userId);
            if (user == null) {
                return AuthResult.of(404, ApiResponse.error("用户不存在"));
            }

            // 对应 Sequelize user.update({...})：仅更新请求体中出现的字段
            UpdateWrapper<User> uw = new UpdateWrapper<>();
            uw.eq("id", userId);
            if (body.containsKey("nickname")) uw.set("nickname", body.get("nickname"));
            if (body.containsKey("avatar")) uw.set("avatar", body.get("avatar"));
            if (body.containsKey("email")) uw.set("email", body.get("email"));
            if (body.containsKey("studentId")) uw.set("student_id", body.get("studentId"));
            if (body.containsKey("college")) uw.set("college", body.get("college"));
            if (body.containsKey("phone")) uw.set("phone", phone);
            if (!uw.getSqlSet().isEmpty()) {
                uw.set("updated_at", LocalDateTime.now());
                userMapper.update(null, uw);
            }

            User updated = userMapper.selectById(userId);
            return AuthResult.of(200, ApiResponse.success(UserVO.from(updated), "更新成功"));
        } catch (Exception e) {
            log.error("更新失败:", e);
            return AuthResult.of(500, ApiResponse.error("更新失败", 500));
        }
    }

    // ==================== 修改密码 ====================

    /**
     * 修改密码，对应 authController.changePassword。
     */
    public AuthResult changePassword(Map<String, Object> body) {
        try {
            String oldPassword = rsaUtil.decryptField(body.get("oldPassword") == null ? null : String.valueOf(body.get("oldPassword")));
            String newPassword = rsaUtil.decryptField(body.get("newPassword") == null ? null : String.valueOf(body.get("newPassword")));
            if (newPassword == null || oldPassword == null) {
                return AuthResult.of(400, ApiResponse.error("数据解密失败，请刷新页面重试"));
            }
            if (newPassword.isEmpty() || newPassword.length() < 6) {
                return AuthResult.of(400, ApiResponse.error("新密码长度不能少于6位"));
            }

            User user = userMapper.selectById(currentUserId());
            if (user == null) {
                // 原实现中 user 为 null 时 comparePassword 抛异常进入 catch → 500
                return AuthResult.of(500, ApiResponse.error("修改密码失败", 500));
            }
            if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
                return AuthResult.of(400, ApiResponse.error("原密码错误"));
            }

            user.setPassword(passwordEncoder.encode(newPassword));
            user.setUpdatedAt(LocalDateTime.now());
            userMapper.updateById(user);
            return AuthResult.of(200, ApiResponse.success(null, "密码修改成功"));
        } catch (Exception e) {
            log.error("修改密码失败:", e);
            return AuthResult.of(500, ApiResponse.error("修改密码失败", 500));
        }
    }

    private Integer currentUserId() {
        UserContext.CurrentUser u = UserContext.getUser();
        return u == null ? null : u.getId();
    }

    /** 认证接口统一返回：HTTP 状态码 + 响应体 */
    public record AuthResult(int status, ApiResponse<?> body) {
        static AuthResult of(int status, ApiResponse<?> body) {
            return new AuthResult(status, body);
        }
    }
}
