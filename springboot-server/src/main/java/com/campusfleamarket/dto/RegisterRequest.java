package com.campusfleamarket.dto;

import lombok.Data;

/**
 * 注册请求体：{ username, nickname, studentId, college, password, phone }
 * password 必填且为 RSA 密文；phone 可选，传了则为 RSA 密文。
 */
@Data
public class RegisterRequest {

    private String username;
    private String nickname;
    private String studentId;
    private String college;
    /** RSA 密文 */
    private String password;
    /** RSA 密文（可选） */
    private String phone;
}
