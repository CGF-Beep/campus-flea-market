package com.campusfleamarket.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 健康检查，对应 app.js：
 * GET /health → { status:'ok', message:'校园二手交易平台服务运行中' }
 * （注意：无 code/data 字段，与原实现一致）
 */
@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, String> health() {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("status", "ok");
        body.put("message", "校园二手交易平台服务运行中");
        return body;
    }
}
