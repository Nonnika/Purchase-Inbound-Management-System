-- +goose Up
CREATE TABLE `orders` (
    `id`         bigint PRIMARY KEY AUTO_INCREMENT,
    `item_id`    bigint NOT NULL,
    `user_id`    bigint NOT NULL,
    `count`      bigint NOT NULL,
    `created_at` datetime DEFAULT (CURRENT_TIMESTAMP),
    KEY `idx_orders_item_id` (`item_id`),
    KEY `idx_orders_user_id` (`user_id`),
    CONSTRAINT `fk_orders_item_id` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_orders_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_orders_count` CHECK (`count` > 0)
);

-- +goose Down
DROP TABLE IF EXISTS `orders`;
