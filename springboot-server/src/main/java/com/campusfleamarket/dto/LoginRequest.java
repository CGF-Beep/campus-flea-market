package com.campusfleamarket.dto;

import lombok.Data;

/**
 * 登录请求体：{ username, password }，password 为前端用 RSA 公钥加密的密文。
 */
@Data
public class LoginRequest {

    private String username;

    /** 密文（base64），需先用私钥解密 */
    private String password;
}
