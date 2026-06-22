-- +goose Up
CREATE TABLE `order_events` (
    `id`                  bigint PRIMARY KEY AUTO_INCREMENT,
    `order_id`            bigint NOT NULL,
    `sequence_no`         bigint NOT NULL COMMENT '订单内事件顺序',
    `step`                varchar(32) NOT NULL COMMENT '订单步骤',
    `operator_user_id`    bigint DEFAULT NULL COMMENT '操作人',
    `event_payload`       json DEFAULT NULL COMMENT '步骤业务详情',
    `payload_hash`        char(64) NOT NULL COMMENT 'event_payload 的 SHA-256',
    `previous_event_hash` char(64) DEFAULT NULL COMMENT '同一订单上一事件哈希',
    `event_hash`          char(64) NOT NULL COMMENT '当前事件哈希',
    `created_at`          datetime DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE KEY `uk_order_events_order_sequence` (`order_id`, `sequence_no`),
    UNIQUE KEY `uk_order_events_event_hash` (`event_hash`),
    KEY `idx_order_events_order_id` (`order_id`),
    KEY `idx_order_events_order_step` (`order_id`, `step`),
    KEY `idx_order_events_operator_user_id` (`operator_user_id`),
    CONSTRAINT `fk_order_events_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_order_events_operator_user_id` FOREIGN KEY (`operator_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `chk_order_events_step` CHECK (`step` IN ('CREATED', 'PAID', 'ALLOCATED', 'SHIPPED', 'RECEIVED', 'CANCELLED', 'REFUNDED'))
);

-- +goose Down
DROP TABLE IF EXISTS `order_events`;
