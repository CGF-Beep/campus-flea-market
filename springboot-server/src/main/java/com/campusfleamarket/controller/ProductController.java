package com.campusfleamarket.controller;

import com.campusfleamarket.common.ApiResponse;
import com.campusfleamarket.service.ProductService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 商品接口（第 1 阶段仅列表，无鉴权）：
 * GET /api/products
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    /**
     * 商品列表（分页+搜索+筛选），参数与原 Express 完全一致：
     * page, pageSize, keyword, categoryId, condition, sortBy, minPrice, maxPrice
     */
    @GetMapping("/products")
    public ResponseEntity<ApiResponse<?>> list(HttpServletRequest request) {
        int page = parsePositiveInt(request.getParameter("page"), 1);
        int pageSize = parsePositiveInt(request.getParameter("pageSize"), 10);

        ProductService.ProductListResult result = productService.list(
                page,
                pageSize,
                request.getParameter("keyword"),
                request.getParameter("categoryId"),
                request.getParameter("condition"),
                request.getParameter("sortBy"),
                request.getParameter("minPrice"),
                request.getParameter("maxPrice"));
        return ResponseEntity.status(result.status()).body(result.body());
    }

    /**
     * 对齐 parseInt(x) || default 的语义：
     * 缺失/非数字/0 → 默认值；负数 → 原样保留（对应 JS 中 0 为 falsy、负数 truthy 的行为）。
     */
    private int parsePositiveInt(String raw, int def) {
        if (raw == null || raw.isEmpty()) return def;
        try {
            int v = Integer.parseInt(raw);
            return v == 0 ? def : v;
        } catch (NumberFormatException e) {
            return def;
        }
    }
}
