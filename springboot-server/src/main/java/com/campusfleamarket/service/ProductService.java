package com.campusfleamarket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.campusfleamarket.common.ApiResponse;
import com.campusfleamarket.common.PageResult;
import com.campusfleamarket.dto.ProductVO;
import com.campusfleamarket.entity.Category;
import com.campusfleamarket.entity.Product;
import com.campusfleamarket.entity.User;
import com.campusfleamarket.mapper.CategoryMapper;
import com.campusfleamarket.mapper.ProductMapper;
import com.campusfleamarket.mapper.UserMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 商品服务，对照 controllers/productController.js 的 list()。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductMapper productMapper;
    private final UserMapper userMapper;
    private final CategoryMapper categoryMapper;
    private final ObjectMapper objectMapper;

    /**
     * 商品列表（分页 + 搜索 + 筛选），返回结构与原 paginate() 一致。
     * 条件构造严格对应 Sequelize：
     * - status 固定 on_sale
     * - keyword → title/description LIKE %kw%
     * - categoryId / condition → 等值
     * - minPrice/maxPrice → price >= / <=
     * - sortBy: latest=createdAt DESC / price_asc / price_desc / popular=views DESC
     * 关联输出 user(id,username,nickname,avatar) + category(id,name,icon)
     */
    public ProductListResult list(int page, int pageSize, String keyword, String categoryId, String condition,
                                  String sortBy, String minPrice, String maxPrice) {
        try {
            LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(Product::getStatus, "on_sale");

            if (keyword != null && !keyword.isEmpty()) {
                wrapper.and(w -> w.like(Product::getTitle, keyword)
                        .or()
                        .like(Product::getDescription, keyword));
            }
            if (categoryId != null && !categoryId.isEmpty()) {
                try {
                    wrapper.eq(Product::getCategoryId, Integer.valueOf(categoryId));
                } catch (NumberFormatException e) {
                    // 对齐 MySQL：非数字字符串转 0 比较，匹配不到任何行（而非报 500）
                    wrapper.eq(Product::getCategoryId, 0);
                }
            }
            if (condition != null && !condition.isEmpty()) {
                wrapper.eq(Product::getCondition, condition);
            }
            if ((minPrice != null && !minPrice.isEmpty()) || (maxPrice != null && !maxPrice.isEmpty())) {
                if (minPrice != null && !minPrice.isEmpty()) {
                    wrapper.ge(Product::getPrice, BigDecimal.valueOf(Double.parseDouble(minPrice)));
                }
                if (maxPrice != null && !maxPrice.isEmpty()) {
                    wrapper.le(Product::getPrice, BigDecimal.valueOf(Double.parseDouble(maxPrice)));
                }
            }

            // 排序（对应 sortBy 各分支）
            switch (sortBy == null ? "latest" : sortBy) {
                case "price_asc" -> wrapper.orderByAsc(Product::getPrice);
                case "price_desc" -> wrapper.orderByDesc(Product::getPrice);
                case "popular" -> wrapper.orderByDesc(Product::getViews);
                default -> wrapper.orderByDesc(Product::getCreatedAt);
            }

            Page<Product> p = new Page<>(page, pageSize);
            Page<Product> result = productMapper.selectPage(p, wrapper);

            // 批量查询关联的 user / category（对应 Sequelize include，避免 N+1）
            Map<Integer, User> userMap = fetchUsers(result.getRecords());
            Map<Integer, Category> categoryMap = fetchCategories(result.getRecords());

            List<ProductVO> voList = new ArrayList<>();
            for (Product product : result.getRecords()) {
                User u = product.getUserId() == null ? null : userMap.get(product.getUserId());
                Category c = product.getCategoryId() == null ? null : categoryMap.get(product.getCategoryId());
                voList.add(toVO(product, u, c));
            }

            PageResult<ProductVO> pageResult = PageResult.of(voList, result.getTotal(), page, pageSize);
            return ProductListResult.of(200, ApiResponse.success(pageResult));
        } catch (Exception e) {
            log.error("获取商品列表失败:", e);
            return ProductListResult.of(500, ApiResponse.error("获取商品列表失败", 500));
        }
    }

    private Map<Integer, User> fetchUsers(List<Product> products) {
        List<Integer> ids = new ArrayList<>();
        for (Product p : products) {
            if (p.getUserId() != null) ids.add(p.getUserId());
        }
        if (ids.isEmpty()) return Collections.emptyMap();
        List<User> users = userMapper.selectBatchIds(ids);
        Map<Integer, User> map = new HashMap<>();
        for (User u : users) map.put(u.getId(), u);
        return map;
    }

    private Map<Integer, Category> fetchCategories(List<Product> products) {
        List<Integer> ids = new ArrayList<>();
        for (Product p : products) {
            if (p.getCategoryId() != null) ids.add(p.getCategoryId());
        }
        if (ids.isEmpty()) return Collections.emptyMap();
        List<Category> categories = categoryMapper.selectBatchIds(ids);
        Map<Integer, Category> map = new HashMap<>();
        for (Category c : categories) map.put(c.getId(), c);
        return map;
    }

    private ProductVO toVO(Product p, User u, Category c) {
        ProductVO.UserBrief userBrief = u == null ? null
                : new ProductVO.UserBrief(u.getId(), u.getUsername(), u.getNickname(), u.getAvatar());
        ProductVO.CategoryBrief categoryBrief = c == null ? null
                : new ProductVO.CategoryBrief(c.getId(), c.getName(), c.getIcon());

        return new ProductVO(
                p.getId(), p.getUserId(), p.getCategoryId(), p.getTitle(), p.getDescription(),
                p.getPrice(), p.getOriginalPrice(), parseImages(p.getImages()),
                p.getCondition(), p.getLocation(), p.getStatus(), p.getRejectReason(),
                p.getViews(), p.getCreatedAt(), p.getUpdatedAt(), userBrief, categoryBrief);
    }

    /**
     * MySQL JSON 列 → List<String>：
     * SQL NULL 或 JSON null 文本 → null；否则解析为数组。
     */
    private List<String> parseImages(String images) {
        if (images == null || images.isEmpty() || "null".equalsIgnoreCase(images.trim())) {
            return null;
        }
        try {
            return objectMapper.readValue(images, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("images 解析失败: {}", images);
            return null;
        }
    }

    /** 查询结果：HTTP 状态码 + 响应体 */
    public record ProductListResult(int status, ApiResponse<?> body) {
        static ProductListResult of(int status, ApiResponse<?> body) {
            return new ProductListResult(status, body);
        }
    }
}
