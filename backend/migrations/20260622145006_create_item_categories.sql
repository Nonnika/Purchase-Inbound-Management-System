-- +goose Up
CREATE TABLE `item_categories` (
    `id`          bigint PRIMARY KEY AUTO_INCREMENT,
    `description` varchar(255) DEFAULT NULL,
    `parent`      bigint       DEFAULT NULL COMMENT '父分类ID，NULL表示顶级分类',
    `created_at`  datetime     DEFAULT (CURRENT_TIMESTAMP),
    KEY `idx_item_categories_parent` (`parent`),
    CONSTRAINT `fk_item_categories_parent` FOREIGN KEY (`parent`) REFERENCES `item_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

-- +goose Down
DROP TABLE IF EXISTS `item_categories`;
