package com.campusfleamarket.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 登录成功返回的 data 结构：{ token, user }。
 */
@Data
@AllArgsConstructor
public class LoginData {

    private String token;
    private UserVO user;
}
