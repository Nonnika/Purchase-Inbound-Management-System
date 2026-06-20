-- +goose Up
CREATE TABLE `users` (
                         `id` bigint PRIMARY KEY AUTO_INCREMENT,
                         `username` varchar(50) UNIQUE NOT NULL,
                         `password_hash` varchar(255) NOT NULL,
                         `real_name` varchar(50),
                         `phone` varchar(20),
                         `role_id` bigint NOT NULL,
                         `department_id` bigint,
                         `status` tinyint NOT NULL DEFAULT 1 COMMENT '1正常 0禁用',
                         `created_at` datetime DEFAULT (CURRENT_TIMESTAMP),
                         `updated_at` datetime DEFAULT (CURRENT_TIMESTAMP),
                         UNIQUE KEY `uk_users_username` (`username`),
                         KEY `idx_users_role_id` (`role_id`),
                         KEY `idx_users_department_id` (`department_id`)
);




-- +goose Down
drop table `users`