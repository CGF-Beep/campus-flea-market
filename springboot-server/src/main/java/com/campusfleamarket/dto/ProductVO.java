package com.campusfleamarket.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 商品响应体，对应 Sequelize Product.toJSON() 结构（camelCase，含 null 字段）。
 * 关联对象：
 * - user：{id, username, nickname, avatar}
 * - category：{id, name, icon}
 * price/originalPrice 由全局序列化器输出为两位小数字符串（对齐 mysql2 的 DECIMAL 字符串行为）。
 */
@Data
@AllArgsConstructor
public class ProductVO {

    private Integer id;
    private Integer userId;
    private Integer categoryId;
    private String title;
    private String description;
    private BigDecimal price;
    private BigDecimal originalPrice;
    /** JSON 数组 → List；为 null 时输出 null */
    private List<String> images;
    private String condition;
    private String location;
    private String status;
    private String rejectReason;
    private Integer views;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private UserBrief user;
    private CategoryBrief category;

    @Data
    @AllArgsConstructor
    public static class UserBrief {
        private Integer id;
        private String username;
        private String nickname;
        private String avatar;
    }

    @Data
    @AllArgsConstructor
    public static class CategoryBrief {
        private Integer id;
        private String name;
        private String icon;
    }
}
