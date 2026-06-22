-- +goose Up
ALTER TABLE `orders`
    ADD COLUMN `status` varchar(32) NOT NULL DEFAULT 'CREATED' COMMENT '订单当前状态' AFTER `count`,
    ADD COLUMN `updated_at` datetime DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`,
    ADD KEY `idx_orders_status` (`status`),
    ADD KEY `idx_orders_created_at` (`created_at`);

-- +goose Down
ALTER TABLE `orders`
    DROP KEY `idx_orders_created_at`,
    DROP KEY `idx_orders_status`,
    DROP COLUMN `updated_at`,
    DROP COLUMN `status`;
