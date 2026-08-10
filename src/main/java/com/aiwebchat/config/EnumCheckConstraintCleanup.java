package com.aiwebchat.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

/**
 * H2 + Hibernate 在 ddl-auto=update 模式下，建表时会为 @Enumerated(STRING) 字段
 * 生成 CHECK (col IN (...)) 约束，枚举值后续扩展时约束不会自动更新，
 * 导致插入新枚举值抛 [Value not permitted for column ...]。
 *
 * 启动时检测并删除 message 表上 content_type 列的 CHECK 约束，使新枚举值 AUDIO 可写入。
 * 该 Runner 幂等：无约束时直接跳过。
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class EnumCheckConstraintCleanup {

    @Bean
    ApplicationRunner cleanupEnumCheckConstraints(JdbcTemplate jdbc) {
        return args -> {
            dropChecksOnColumn(jdbc, "MESSAGE", "CONTENT_TYPE");
            dropChecksOnColumn(jdbc, "MESSAGE", "TYPE");
        };
    }

    private void dropChecksOnColumn(JdbcTemplate jdbc, String table, String column) {
        try {
            List<String> names = jdbc.queryForList(
                    "SELECT cc.CONSTRAINT_NAME FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc " +
                            "JOIN INFORMATION_SCHEMA.CONSTRAINTS c " +
                            "  ON cc.CONSTRAINT_NAME = c.CONSTRAINT_NAME " +
                            "  AND cc.CONSTRAINT_SCHEMA = c.CONSTRAINT_SCHEMA " +
                            "WHERE c.TABLE_NAME = ? AND UPPER(cc.CHECK_CLAUSE) LIKE ?",
                    String.class,
                    table.toUpperCase(), "%" + column.toUpperCase() + "%");
            if (names.isEmpty()) {
                return;
            }
            for (String name : names) {
                jdbc.execute("ALTER TABLE " + table.toLowerCase() + " DROP CONSTRAINT IF EXISTS \"" + name + "\"");
                log.info("Dropped CHECK constraint on {}.{}: {}", table, column, name);
            }
        } catch (Exception e) {
            log.warn("Skip CHECK constraint cleanup on {}.{}: {}", table, column, e.getMessage());
        }
    }
}
