package com.campusfleamarket.controller;

import com.campusfleamarket.common.ApiResponse;
import com.campusfleamarket.security.RequireAdmin;
import com.campusfleamarket.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 分类接口，对应 routes/index.js 分类路由：
 * GET    /api/categories          （无鉴权）
 * POST   /api/categories          （@RequireAdmin）
 * PUT    /api/categories/:id      （@RequireAdmin）
 * DELETE /api/categories/:id      （@RequireAdmin）
 */
@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<?>> list() {
        CategoryService.CategoryResult result = categoryService.list();
        return ResponseEntity.status(result.status()).body(result.body());
    }

    @PostMapping
    @RequireAdmin
    public ResponseEntity<ApiResponse<?>> create(@RequestBody(required = false) Map<String, Object> body) {
        CategoryService.CategoryResult result = categoryService.create(body == null ? Map.of() : body);
        return ResponseEntity.status(result.status()).body(result.body());
    }

    @PutMapping("/{id}")
    @RequireAdmin
    public ResponseEntity<ApiResponse<?>> update(@PathVariable Integer id,
                                                 @RequestBody(required = false) Map<String, Object> body) {
        CategoryService.CategoryResult result = categoryService.update(id, body == null ? Map.of() : body);
        return ResponseEntity.status(result.status()).body(result.body());
    }

    @DeleteMapping("/{id}")
    @RequireAdmin
    public ResponseEntity<ApiResponse<?>> remove(@PathVariable Integer id) {
        CategoryService.CategoryResult result = categoryService.remove(id);
        return ResponseEntity.status(result.status()).body(result.body());
    }
}
