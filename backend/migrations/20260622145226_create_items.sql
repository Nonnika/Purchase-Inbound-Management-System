-- +goose Up
CREATE TABLE `items` (
    `id`               bigint PRIMARY KEY AUTO_INCREMENT,
    `name`             varchar(20) NOT NULL,
    `category_id`      bigint DEFAULT NULL,
    `price`            decimal(10, 2) DEFAULT NULL COMMENT '单价',
    `item_inventory`   bigint DEFAULT NULL,
    `frozen_inventory` bigint DEFAULT NULL COMMENT '冻结数目 <= 全部库存',
    `warehouse_id`     bigint DEFAULT NULL COMMENT '仓库 id',
    `warning_level`    bigint DEFAULT NULL COMMENT '货物的最小可接受库存',
    `created_at`       datetime DEFAULT (CURRENT_TIMESTAMP),
    `updated_at`       datetime DEFAULT (CURRENT_TIMESTAMP),
    KEY `idx_items_category_id` (`category_id`),
    KEY `idx_items_warehouse_id` (`warehouse_id`),
    CONSTRAINT `fk_items_category_id` FOREIGN KEY (`category_id`) REFERENCES `item_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_items_warehouse_id` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `chk_items_inventory` CHECK (`frozen_inventory` IS NULL OR `item_inventory` IS NULL OR `frozen_inventory` <= `item_inventory`)
);

-- +goose Down
DROP TABLE IF EXISTS `items`;
