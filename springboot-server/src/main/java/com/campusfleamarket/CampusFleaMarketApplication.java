package com.campusfleamarket;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.campusfleamarket.mapper")
public class CampusFleaMarketApplication {

    public static void main(String[] args) {
        SpringApplication.run(CampusFleaMarketApplication.class, args);
    }
}
