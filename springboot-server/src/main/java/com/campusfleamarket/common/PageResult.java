package com.campusfleamarket.common;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 分页结果，对应原 utils/response.js 的 paginate()。
 * data 结构：{ list, total, page, pageSize, totalPages }
 */
@Data
@AllArgsConstructor
public class PageResult<T> {

    private java.util.List<T> list;
    private long total;
    private long page;
    private long pageSize;
    /** 总页数；与原逻辑一致：pageSize 为 0 时原 Node 端 Math.ceil(total/0) 序列化为 null */
    private Long totalPages;

    public static <T> PageResult<T> of(java.util.List<T> list, long total, long page, long pageSize) {
        Long totalPages = pageSize == 0 ? null : (total + pageSize - 1) / pageSize;
        return new PageResult<>(list, total, page, pageSize, totalPages);
    }
}
