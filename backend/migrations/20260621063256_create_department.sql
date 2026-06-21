-- +goose Up
CREATE TABLE `departments` (
    `id`          bigint PRIMARY KEY AUTO_INCREMENT,
    `name`        varchar(20)  NOT NULL COMMENT '部门名称',
    `description` varchar(256) DEFAULT NULL COMMENT '部门描述',
    `parent`      bigint       DEFAULT NULL COMMENT '父部门ID，NULL表示顶级部门',
    `created_at`  datetime     DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE KEY `uk_departments_name` (`name`),
    KEY `idx_departments_parent` (`parent`),
    CONSTRAINT `fk_departments_parent` FOREIGN KEY (`parent`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 为 users 表添加 department_id 的外键约束（如果之前未添加）
ALTER TABLE `users`
    ADD CONSTRAINT `fk_users_department_id`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- +goose Down
ALTER TABLE `users`
    DROP FOREIGN KEY `fk_users_department_id`;

DROP TABLE IF EXISTS `departments`;