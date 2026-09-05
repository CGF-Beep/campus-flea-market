package com.campusfleamarket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 商品表 products（字段与 database/init.sql 完全一致）。
 * JSON 列 images 在 MySQL 中以文本存储，实体用 String 承接，输出时再转数组。
 */
@Data
@TableName("products")
public class Product {

    @TableId(type = IdType.AUTO)
    private Integer id;

    @TableField("user_id")
    private Integer userId;

    @TableField("category_id")
    private Integer categoryId;

    private String title;

    private String description;

    private BigDecimal price;

    @TableField("original_price")
    private BigDecimal originalPrice;

    /** MySQL JSON 列，实体中为原始文本，如 ["/uploads/a.jpg"] */
    private String images;

    /** condition 为 MySQL 保留字，必须加反引号 */
    @TableField("`condition`")
    private String condition;

    private String location;

    private String status;

    @TableField("reject_reason")
    private String rejectReason;

    private Integer views;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
