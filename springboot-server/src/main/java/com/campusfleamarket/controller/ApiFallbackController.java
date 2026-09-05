package com.campusfleamarket.controller;

import com.campusfleamarket.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * API 404 兜底，对应 app.js 的 404 处理：
 * 未匹配到任何接口的 /api/** 请求 → 404 { code:404, message:'接口不存在', data:null }
 * （精确路径映射优先级更高，不影响已实现接口）
 */
@RestController
public class ApiFallbackController {

    @RequestMapping("/api/**")
    public ResponseEntity<ApiResponse<Void>> notFound() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiResponse<>(404, "接口不存在", null));
    }
}
