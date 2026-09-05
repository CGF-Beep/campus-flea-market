package com.campusfleamarket.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;

/**
 * 静态资源映射，对齐 app.js：
 * - /uploads/** → 上传目录（默认复用原 Express 的 server/src/uploads，图片互通）
 * - / → 前端构建产物目录（存在时提供静态文件 + SPA 回退）
 */
@Configuration
public class WebStaticConfig implements WebMvcConfigurer {

    private final AppProperties props;

    public WebStaticConfig(AppProperties props) {
        this.props = props;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 上传目录
        File uploadDir = resolve(props.getUploadDir());
        if (uploadDir.exists()) {
            registry.addResourceHandler("/uploads/**")
                    .addResourceLocations("file:" + uploadDir.getAbsolutePath() + File.separator);
        }

        // 前端构建产物（SPA 静态文件）
        File distDir = resolve(props.getClientDistDir());
        if (new File(distDir, "index.html").exists()) {
            registry.addResourceHandler("/**")
                    .addResourceLocations("file:" + distDir.getAbsolutePath() + File.separator);
        }
    }

    private File resolve(String path) {
        File f = new File(path);
        return f.isAbsolute() ? f : new File(System.getProperty("user.dir"), path);
    }
}
