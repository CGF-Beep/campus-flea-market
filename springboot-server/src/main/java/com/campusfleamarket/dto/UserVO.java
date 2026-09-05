package com.campusfleamarket.dto;

import com.campusfleamarket.entity.User;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户信息响应体，对应 Sequelize User.toJSON()：
 * 全部字段（含 null）照原样输出，仅删除 password。
 */
@Data
@AllArgsConstructor
public class UserVO {

    private Integer id;
    private String username;
    private String nickname;
    private String avatar;
    private String phone;
    private String email;
    private String studentId;
    private String college;
    private String role;
    private Integer status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static UserVO from(User u) {
        return new UserVO(
                u.getId(), u.getUsername(), u.getNickname(), u.getAvatar(),
                u.getPhone(), u.getEmail(), u.getStudentId(), u.getCollege(),
                u.getRole(), u.getStatus(), u.getCreatedAt(), u.getUpdatedAt());
    }
}
