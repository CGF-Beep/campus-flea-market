package com.campusfleamarket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.campusfleamarket.common.ApiResponse;
import com.campusfleamarket.entity.Category;
import com.campusfleamarket.mapper.CategoryMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 分类服务，对照 controllers/categoryController.js。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryMapper categoryMapper;

    /**
     * 分类列表：status=1，按 sort ASC、id ASC（对应 Category.findAll）。
     */
    public CategoryResult list() {
        try {
            List<Category> categories = categoryMapper.selectList(
                    new LambdaQueryWrapper<Category>()
                            .eq(Category::getStatus, 1)
                            .orderByAsc(Category::getSort)
                            .orderByAsc(Category::getId));
            return CategoryResult.of(200, ApiResponse.success(categories));
        } catch (Exception e) {
            log.error("获取分类失败:", e);
            return CategoryResult.of(500, ApiResponse.error("获取分类失败", 500));
        }
    }

    /**
     * 创建分类（管理员）。
     */
    public CategoryResult create(Map<String, Object> body) {
        try {
            String name = body.get("name") == null ? null : String.valueOf(body.get("name"));
            if (name == null || name.isEmpty()) {
                return CategoryResult.of(400, ApiResponse.error("分类名称不能为空"));
            }

            Object rawSort = body.get("sort");
            int sort = rawSort == null ? 0 : (int) Double.parseDouble(String.valueOf(rawSort));

            LocalDateTime now = LocalDateTime.now();
            Category category = new Category();
            category.setName(name);
            category.setIcon(body.get("icon") == null ? null : String.valueOf(body.get("icon")));
            category.setSort(sort);
            category.setStatus(1);
            category.setCreatedAt(now);
            category.setUpdatedAt(now);
            categoryMapper.insert(category);

            return CategoryResult.of(200, ApiResponse.success(category, "创建成功"));
        } catch (Exception e) {
            log.error("创建分类失败:", e);
            return CategoryResult.of(500, ApiResponse.error("创建分类失败", 500));
        }
    }

    /**
     * 更新分类（管理员），仅更新请求体中出现的字段。
     */
    public CategoryResult update(Integer id, Map<String, Object> body) {
        try {
            Category category = categoryMapper.selectById(id);
            if (category == null) {
                return CategoryResult.of(404, ApiResponse.error("分类不存在"));
            }

            UpdateWrapper<Category> uw = new UpdateWrapper<>();
            uw.eq("id", id);
            if (body.containsKey("name")) uw.set("name", body.get("name"));
            if (body.containsKey("icon")) uw.set("icon", body.get("icon"));
            if (body.containsKey("sort")) uw.set("sort", body.get("sort"));
            if (body.containsKey("status")) uw.set("status", body.get("status"));
            if (!uw.getSqlSet().isEmpty()) {
                uw.set("updated_at", LocalDateTime.now());
                categoryMapper.update(null, uw);
            }

            Category updated = categoryMapper.selectById(id);
            return CategoryResult.of(200, ApiResponse.success(updated, "更新成功"));
        } catch (Exception e) {
            log.error("更新分类失败:", e);
            return CategoryResult.of(500, ApiResponse.error("更新分类失败", 500));
        }
    }

    /**
     * 删除分类（管理员），物理删除（对应 category.destroy）。
     */
    public CategoryResult remove(Integer id) {
        try {
            Category category = categoryMapper.selectById(id);
            if (category == null) {
                return CategoryResult.of(404, ApiResponse.error("分类不存在"));
            }
            categoryMapper.deleteById(id);
            return CategoryResult.of(200, ApiResponse.success(null, "删除成功"));
        } catch (Exception e) {
            log.error("删除分类失败:", e);
            return CategoryResult.of(500, ApiResponse.error("删除分类失败", 500));
        }
    }

    /** 分类接口统一返回：HTTP 状态码 + 响应体 */
    public record CategoryResult(int status, ApiResponse<?> body) {
        static CategoryResult of(int status, ApiResponse<?> body) {
            return new CategoryResult(status, body);
        }
    }
}
