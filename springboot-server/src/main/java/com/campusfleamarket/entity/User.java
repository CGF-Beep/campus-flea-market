package com.campusfleamarket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户表 users（password 字段存在但绝不出现在任何响应中，对应 User.toJSON 删除 password）。
 */
@Data
@TableName("users")
public class User {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private String username;

    /** BCrypt 哈希，仅内部使用 */
    private String password;

    private String nickname;

    private String avatar;

    private String phone;

    private String email;

    @TableField("student_id")
    private String studentId;

    private String college;

    /** ENUM('user','admin') */
    private String role;

    /** 1-正常 0-禁用 */
    private Integer status;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
