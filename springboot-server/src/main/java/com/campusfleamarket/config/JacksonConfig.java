package com.campusfleamarket.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 全局 JSON 序列化配置，严格对齐原 Express 输出格式：
 *
 * 1. 时间：Sequelize 将 DATETIME 按 +08:00 读取后序列化为 UTC ISO 字符串，
 *    例如 2026-08-28 15:00:00（北京时间）→ "2026-08-28T07:00:00.000Z"
 *    （固定 3 位毫秒 + 大写字 Z，不用 Spring 默认格式）
 * 2. 价格：mysql2 驱动将 DECIMAL 返回为字符串（如 "15.00"），
 *    JSON 中必须是字符串而非数字。
 */
@Configuration
public class JacksonConfig {

    private static final DateTimeFormatter UTC_MS = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    private static final ZoneId BEIJING = ZoneId.of("Asia/Shanghai");

    @Bean
    public com.fasterxml.jackson.databind.Module campusFleaJacksonModule() {
        SimpleModule module = new SimpleModule("campusFleaMarketSerializers");

        // LocalDateTime（数据库墙上时间按北京时间解释）→ UTC ISO 毫秒串
        module.addSerializer(LocalDateTime.class, new JsonSerializer<LocalDateTime>() {
            @Override
            public void serialize(LocalDateTime value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
                if (value == null) {
                    gen.writeNull();
                    return;
                }
                ZonedDateTime utc = value.atZone(BEIJING).withZoneSameInstant(ZoneId.of("UTC"));
                gen.writeString(UTC_MS.format(utc));
            }
        });

        // BigDecimal（价格）→ 保留两位小数的字符串，如 199.00
        module.addSerializer(BigDecimal.class, new JsonSerializer<BigDecimal>() {
            @Override
            public void serialize(BigDecimal value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
                if (value == null) {
                    gen.writeNull();
                    return;
                }
                gen.writeString(value.setScale(2).toPlainString());
            }
        });

        return module;
    }
}
