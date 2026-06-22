-- +goose Up
CREATE TABLE `roles` (
    `id`          bigint PRIMARY KEY AUTO_INCREMENT,
    `name`        varchar(50)  NOT NULL,
    `code`        varchar(50)  NOT NULL COMMENT 'admin/purchaser/warehouse/auditor/applicant',
    `description` varchar(255) DEFAULT NULL,
    `created_at`  datetime     DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE KEY `uk_roles_code` (`code`)
);

ALTER TABLE `users`
    ADD CONSTRAINT `fk_users_role_id`
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- +goose Down
ALTER TABLE `users`
    DROP FOREIGN KEY `fk_users_role_id`;

DROP TABLE IF EXISTS `roles`;
