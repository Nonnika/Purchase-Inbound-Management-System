-- +goose Up
ALTER TABLE `item_categories`
    ADD COLUMN `name` varchar(255) NOT NULL AFTER `id`,
    ADD UNIQUE KEY `uk_item_categories_name` (`name`);

ALTER TABLE `warehouses`
    ADD UNIQUE KEY `uk_warehouses_name` (`name`);

ALTER TABLE `items`
    ADD UNIQUE KEY `uk_items_name` (`name`);

-- +goose Down
ALTER TABLE `items`
    DROP INDEX `uk_items_name`;

ALTER TABLE `warehouses`
    DROP INDEX `uk_warehouses_name`;

ALTER TABLE `item_categories`
    DROP INDEX `uk_item_categories_name`,
    DROP COLUMN `name`;
