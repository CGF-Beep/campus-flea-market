package com.campusfleamarket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 商品分类表 categories。
 */
@Data
@TableName("categories")
public class Category {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private String name;

    private String icon;

    private Integer sort;

    /** 1-启用 0-禁用 */
    private Integer status;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
