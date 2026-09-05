-- =========================================
-- 校园二手交易平台 数据库初始化脚本
-- 数据库名称：campus_flea_market
-- 字符集：utf8mb4
-- =========================================

CREATE DATABASE IF NOT EXISTS `campus_flea_market` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `campus_flea_market`;

-- ----------------------------
-- 用户表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `password` VARCHAR(100) NOT NULL COMMENT '密码（BCrypt加密）',
  `nickname` VARCHAR(50) COMMENT '昵称',
  `avatar` VARCHAR(255) DEFAULT '/uploads/default-avatar.png' COMMENT '头像',
  `phone` VARCHAR(20) COMMENT '手机号',
  `email` VARCHAR(100) COMMENT '邮箱',
  `student_id` VARCHAR(30) COMMENT '学号',
  `college` VARCHAR(100) COMMENT '学院',
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user' COMMENT '角色',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-正常 0-禁用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ----------------------------
-- 分类表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL COMMENT '分类名称',
  `icon` VARCHAR(255) COMMENT '图标',
  `sort` INT DEFAULT 0 COMMENT '排序',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类表';

-- ----------------------------
-- 商品表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL COMMENT '发布者ID',
  `category_id` INT UNSIGNED NOT NULL COMMENT '分类ID',
  `title` VARCHAR(100) NOT NULL COMMENT '标题',
  `description` TEXT COMMENT '描述',
  `price` DECIMAL(10,2) NOT NULL COMMENT '售价',
  `original_price` DECIMAL(10,2) COMMENT '原价',
  `images` JSON COMMENT '图片数组',
  `condition` ENUM('全新','九成新','八成新','七成新及以下') NOT NULL DEFAULT '九成新' COMMENT '成色',
  `location` VARCHAR(100) COMMENT '交易地点',
  `status` ENUM('pending','on_sale','sold','rejected','removed') NOT NULL DEFAULT 'pending' COMMENT '状态',
  `reject_reason` VARCHAR(255) COMMENT '拒绝原因',
  `views` INT UNSIGNED DEFAULT 0 COMMENT '浏览量',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

-- ----------------------------
-- 订单表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(32) NOT NULL COMMENT '订单编号',
  `product_id` INT UNSIGNED NOT NULL,
  `buyer_id` INT UNSIGNED NOT NULL,
  `seller_id` INT UNSIGNED NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `status` ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
  `remark` VARCHAR(255),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_buyer` (`buyer_id`),
  KEY `idx_seller` (`seller_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- ----------------------------
-- 消息表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `messages` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `from_user_id` INT UNSIGNED NOT NULL,
  `to_user_id` INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED,
  `content` TEXT NOT NULL,
  `image` VARCHAR(255) DEFAULT NULL COMMENT '图片URL（图片消息）',
  `is_read` TINYINT DEFAULT 0 COMMENT '是否已读',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_from_user` (`from_user_id`),
  KEY `idx_to_user` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表';

-- ----------------------------
-- 收藏表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `favorites` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_product` (`user_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';

-- ----------------------------
-- 轮播图表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `banners` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(100) NOT NULL,
  `image` VARCHAR(255) NOT NULL,
  `link` VARCHAR(255),
  `sort` INT DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='轮播图表';

-- ----------------------------
-- 初始数据
-- ----------------------------

-- 管理员账号（密码：admin123）
INSERT INTO `users` (`username`, `password`, `nickname`, `role`, `status`) VALUES
('admin', '$2a$10$X9bGz5JqY3rGhYqY0GqGqOeYqYqYqYqYqYqYqYqYqYqYqYqYqYqYq', '系统管理员', 'admin', 1);

-- 测试用户（密码：123456）
INSERT INTO `users` (`username`, `password`, `nickname`, `phone`, `student_id`, `college`, `role`, `status`) VALUES
('student', '$2a$10$X9bGz5JqY3rGhYqY0GqGqOeYqYqYqYqYqYqYqYqYqYqYqYqYqYqYq', '张同学', '13800138000', '2026001', '软件技术学院', 'user', 1);

-- 分类数据
INSERT INTO `categories` (`name`, `icon`, `sort`) VALUES
('数码电子', 'Monitor', 1),
('书籍教材', 'Reading', 2),
('生活用品', 'Box', 3),
('服饰鞋包', 'ShoppingBag', 4),
('运动健身', 'Basketball', 5),
('美妆护肤', 'Brush', 6),
('乐器', 'Microphone', 7),
('其他', 'More', 99);

-- 轮播图
INSERT INTO `banners` (`title`, `image`, `sort`, `status`) VALUES
('校园二手交易平台', '/uploads/banner1.png', 1, 1),
('闲置物品轻松交易', '/uploads/banner2.png', 2, 1),
('安全便捷的校园交易', '/uploads/banner3.png', 3, 1);
