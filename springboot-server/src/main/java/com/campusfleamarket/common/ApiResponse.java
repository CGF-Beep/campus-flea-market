package com.campusfleamarket.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 统一响应体，对应原 utils/response.js 的 success()/error()。
 *
 * 注意：原 401/403 鉴权失败响应为 {code, message}（无 data 字段），
 * 与业务错误响应 {code, message, data:null} 不同，故鉴权失败单独构造，
 * 不通过本类输出。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {

    private int code;
    private String message;
    private T data;

    /** 对应 success(data, message) */
    public static <T> ApiResponse<T> success(T data, String message) {
        return new ApiResponse<>(200, message, data);
    }

    /** 对应 success(data) 默认文案「操作成功」 */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "操作成功", data);
    }

    /** 对应 error(message)，业务错误码默认 400 */
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(400, message, null);
    }

    /** 对应 error(message, code) */
    public static <T> ApiResponse<T> error(String message, int code) {
        return new ApiResponse<>(code, message, null);
    }
}
