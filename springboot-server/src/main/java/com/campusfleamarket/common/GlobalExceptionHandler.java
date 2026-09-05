package com.campusfleamarket.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局兜底异常处理。
 * 对应原 app.js 的全局错误中间件：不透出内部错误详情。
 * （各 Controller 内已按原 Express 逻辑 try/catch，此处仅兜底未捕获异常）
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("服务器错误:", e);
        // 对应 app.js 中 res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse<>(500, "服务器内部错误", null));
    }
}
