-- +goose Up
ALTER TABLE `orders`
    ADD COLUMN `order_type` varchar(32) NOT NULL DEFAULT 'PURCHASE' COMMENT 'PURCHASE进货 OUTBOUND出货' AFTER `count`,
    ADD KEY `idx_orders_order_type` (`order_type`),
    ADD CONSTRAINT `chk_orders_order_type` CHECK (`order_type` IN ('PURCHASE', 'OUTBOUND'));

UPDATE `orders`
SET `status` = CASE
    WHEN `status` = 'CREATED' THEN 'PURCHASE_REQUESTED'
    WHEN `status` IN ('PAID', 'ALLOCATED') THEN 'AUDIT_APPROVED'
    WHEN `status` IN ('SHIPPED', 'RECEIVED') THEN 'WAREHOUSE_RECEIVED'
    WHEN `status` IN ('CANCELLED', 'REFUNDED') THEN 'AUDIT_REJECTED'
    ELSE `status`
END;

ALTER TABLE `orders`
    MODIFY COLUMN `status` varchar(32) NOT NULL DEFAULT 'PURCHASE_REQUESTED' COMMENT '订单当前状态';

ALTER TABLE `order_events`
    DROP CHECK `chk_order_events_step`;

ALTER TABLE `order_events`
    ADD CONSTRAINT `chk_order_events_step` CHECK (`step` IN ('CREATED', 'PAID', 'ALLOCATED', 'SHIPPED', 'RECEIVED', 'CANCELLED', 'REFUNDED', 'PURCHASE_REQUESTED', 'OUTBOUND_REQUESTED', 'AUDIT_APPROVED', 'AUDIT_REJECTED', 'WAREHOUSE_RECEIVED', 'WAREHOUSE_SHIPPED', 'ORDER_DELETED'));

-- +goose Down
ALTER TABLE `order_events`
    DROP CHECK `chk_order_events_step`;

UPDATE `order_events`
SET `step` = CASE
    WHEN `step` IN ('PURCHASE_REQUESTED', 'OUTBOUND_REQUESTED') THEN 'CREATED'
    WHEN `step` = 'AUDIT_APPROVED' THEN 'PAID'
    WHEN `step` = 'AUDIT_REJECTED' THEN 'CANCELLED'
    WHEN `step` = 'WAREHOUSE_RECEIVED' THEN 'RECEIVED'
    WHEN `step` = 'WAREHOUSE_SHIPPED' THEN 'SHIPPED'
    ELSE `step`
END;

ALTER TABLE `order_events`
    ADD CONSTRAINT `chk_order_events_step` CHECK (`step` IN ('CREATED', 'PAID', 'ALLOCATED', 'SHIPPED', 'RECEIVED', 'CANCELLED', 'REFUNDED'));

UPDATE `orders`
SET `status` = CASE
    WHEN `status` IN ('PURCHASE_REQUESTED', 'OUTBOUND_REQUESTED') THEN 'CREATED'
    WHEN `status` = 'AUDIT_APPROVED' THEN 'PAID'
    WHEN `status` = 'AUDIT_REJECTED' THEN 'CANCELLED'
    WHEN `status` = 'WAREHOUSE_RECEIVED' THEN 'RECEIVED'
    WHEN `status` = 'WAREHOUSE_SHIPPED' THEN 'SHIPPED'
    ELSE `status`
END;

ALTER TABLE `orders`
    MODIFY COLUMN `status` varchar(32) NOT NULL DEFAULT 'CREATED' COMMENT '订单当前状态',
    DROP CHECK `chk_orders_order_type`,
    DROP KEY `idx_orders_order_type`,
    DROP COLUMN `order_type`;
