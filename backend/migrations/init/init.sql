-- =============================================================================
-- PIMS MySQL 初始化脚本
-- 由 backend/migrations/ 下的 goose 迁移文件整合而成（净最终状态）。
-- 整合时已应用各迁移的累积效果：departments.parent 恢复为可空 + 自引用外键，
-- item_categories/warehouses/items 的 name 唯一约束，orders 的 order_type/status
-- 采购出入库流程，order_events 的步骤枚举（含 ORDER_DELETED）。
--
-- roles 表额外按需求插入 5 个内置角色。
-- 顺序按外键依赖排列：roles -> departments -> users -> item_categories ->
-- warehouses -> items -> orders -> order_events。
-- =============================================================================

-- 若需要脚本自建库，取消下面两行注释（默认假设库已由部署方创建）。
CREATE DATABASE IF NOT EXISTS `pims` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pims`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- roles：角色
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `order_events`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `items`;
DROP TABLE IF EXISTS `warehouses`;
DROP TABLE IF EXISTS `item_categories`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `departments`;
DROP TABLE IF EXISTS `roles`;

CREATE TABLE `roles` (
    `id`          bigint PRIMARY KEY AUTO_INCREMENT,
    `name`        varchar(50)  NOT NULL,
    `code`        varchar(50)  NOT NULL COMMENT 'admin/purchaser/warehouse/auditor/applicant',
    `description` varchar(255) DEFAULT NULL,
    `created_at`  datetime     DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE KEY `uk_roles_code` (`code`)
);

-- 内置角色（id 与后端角色枚举对应，勿改）
INSERT INTO `roles` (`id`, `name`, `code`, `description`) VALUES
    (5, '申请人',    'applicant', '负责提交申请'),
    (4, '审计员',    'auditor',   '负责审计核对'),
    (3, '仓库管理员', 'warehouse', '负责仓库管理'),
    (2, '采购员',    'purchaser', '负责采购业务'),
    (1, '管理员',    'admin',     '系统管理员角色');

-- -----------------------------------------------------------------------------
-- departments：部门（树形，parent 自引用，NULL 表示顶级）
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- users：用户
-- -----------------------------------------------------------------------------
CREATE TABLE `users` (
    `id`            bigint PRIMARY KEY AUTO_INCREMENT,
    `username`      varchar(50)  NOT NULL,
    `password_hash` varchar(255) NOT NULL,
    `real_name`     varchar(50)  DEFAULT NULL,
    `phone`         varchar(20)  DEFAULT NULL,
    `role_id`       bigint       NOT NULL,
    `department_id` bigint       DEFAULT NULL,
    `status`        tinyint      NOT NULL DEFAULT 1 COMMENT '1正常 0禁用',
    `created_at`    datetime     DEFAULT (CURRENT_TIMESTAMP),
    `updated_at`    datetime     DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE KEY `uk_users_username` (`username`),
    KEY `idx_users_role_id` (`role_id`),
    KEY `idx_users_department_id` (`department_id`),
    CONSTRAINT `fk_users_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_users_department_id` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

-- -----------------------------------------------------------------------------
-- item_categories：物品分类（树形，parent 自引用，NULL 表示顶级）
-- -----------------------------------------------------------------------------
CREATE TABLE `item_categories` (
    `id`          bigint PRIMARY KEY AUTO_INCREMENT,
    `name`        varchar(255) NOT NULL,
    `description` varchar(255) DEFAULT NULL,
    `parent`      bigint       DEFAULT NULL COMMENT '父分类ID，NULL表示顶级分类',
    `created_at`  datetime     DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE KEY `uk_item_categories_name` (`name`),
    KEY `idx_item_categories_parent` (`parent`),
    CONSTRAINT `fk_item_categories_parent` FOREIGN KEY (`parent`) REFERENCES `item_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

-- -----------------------------------------------------------------------------
-- warehouses：仓库
-- -----------------------------------------------------------------------------
CREATE TABLE `warehouses` (
    `id`          bigint PRIMARY KEY AUTO_INCREMENT,
    `name`        varchar(255) NOT NULL,
    `description` varchar(255) DEFAULT NULL,
    `create_at`   datetime     DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE KEY `uk_warehouses_name` (`name`)
);

-- -----------------------------------------------------------------------------
-- items：物品
-- -----------------------------------------------------------------------------
CREATE TABLE `items` (
    `id`               bigint PRIMARY KEY AUTO_INCREMENT,
    `name`             varchar(20)    NOT NULL,
    `category_id`      bigint         DEFAULT NULL,
    `price`            decimal(10, 2) DEFAULT NULL COMMENT '单价',
    `item_inventory`   bigint         DEFAULT NULL,
    `frozen_inventory` bigint         DEFAULT NULL COMMENT '冻结数目 <= 全部库存',
    `warehouse_id`     bigint         DEFAULT NULL COMMENT '仓库 id',
    `warning_level`    bigint         DEFAULT NULL COMMENT '货物的最小可接受库存',
    `created_at`       datetime       DEFAULT (CURRENT_TIMESTAMP),
    `updated_at`       datetime       DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE KEY `uk_items_name` (`name`),
    KEY `idx_items_category_id` (`category_id`),
    KEY `idx_items_warehouse_id` (`warehouse_id`),
    CONSTRAINT `fk_items_category_id` FOREIGN KEY (`category_id`) REFERENCES `item_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_items_warehouse_id` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `chk_items_inventory` CHECK (`frozen_inventory` IS NULL OR `item_inventory` IS NULL OR `frozen_inventory` <= `item_inventory`)
);

-- -----------------------------------------------------------------------------
-- orders：订单（PURCHASE 进货 / OUTBOUND 出库）
-- -----------------------------------------------------------------------------
CREATE TABLE `orders` (
    `id`         bigint PRIMARY KEY AUTO_INCREMENT,
    `item_id`    bigint      NOT NULL,
    `user_id`    bigint      NOT NULL,
    `count`      bigint      NOT NULL,
    `order_type` varchar(32) NOT NULL DEFAULT 'PURCHASE' COMMENT 'PURCHASE进货 OUTBOUND出货',
    `status`     varchar(32) NOT NULL DEFAULT 'PURCHASE_REQUESTED' COMMENT '订单当前状态',
    `created_at` datetime    DEFAULT (CURRENT_TIMESTAMP),
    `updated_at` datetime    DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_orders_item_id` (`item_id`),
    KEY `idx_orders_user_id` (`user_id`),
    KEY `idx_orders_status` (`status`),
    KEY `idx_orders_created_at` (`created_at`),
    KEY `idx_orders_order_type` (`order_type`),
    CONSTRAINT `fk_orders_item_id` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_orders_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_orders_count` CHECK (`count` > 0),
    CONSTRAINT `chk_orders_order_type` CHECK (`order_type` IN ('PURCHASE', 'OUTBOUND'))
);

-- -----------------------------------------------------------------------------
-- order_events：订单事件链（SHA-256 哈希链）
-- -----------------------------------------------------------------------------
CREATE TABLE `order_events` (
    `id`                  bigint PRIMARY KEY AUTO_INCREMENT,
    `order_id`            bigint      NOT NULL,
    `sequence_no`         bigint      NOT NULL COMMENT '订单内事件顺序',
    `step`                varchar(32) NOT NULL COMMENT '订单步骤',
    `operator_user_id`    bigint      DEFAULT NULL COMMENT '操作人',
    `event_payload`       json        DEFAULT NULL COMMENT '步骤业务详情',
    `payload_hash`        char(64)    NOT NULL COMMENT 'event_payload 的 SHA-256',
    `previous_event_hash` char(64)    DEFAULT NULL COMMENT '同一订单上一事件哈希',
    `event_hash`          char(64)    NOT NULL COMMENT '当前事件哈希',
    `created_at`          datetime    DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE KEY `uk_order_events_order_sequence` (`order_id`, `sequence_no`),
    UNIQUE KEY `uk_order_events_event_hash` (`event_hash`),
    KEY `idx_order_events_order_id` (`order_id`),
    KEY `idx_order_events_order_step` (`order_id`, `step`),
    KEY `idx_order_events_operator_user_id` (`operator_user_id`),
    CONSTRAINT `fk_order_events_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_order_events_operator_user_id` FOREIGN KEY (`operator_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `chk_order_events_step` CHECK (`step` IN (
        'CREATED', 'PAID', 'ALLOCATED', 'SHIPPED', 'RECEIVED', 'CANCELLED', 'REFUNDED',
        'PURCHASE_REQUESTED', 'OUTBOUND_REQUESTED', 'AUDIT_APPROVED', 'AUDIT_REJECTED',
        'WAREHOUSE_RECEIVED', 'WAREHOUSE_SHIPPED', 'ORDER_DELETED'
    ))
);

-- -----------------------------------------------------------------------------
-- 初始种子数据：默认管理员部门 + 管理员账号
-- -----------------------------------------------------------------------------
INSERT INTO `departments` (`id`, `name`, `description`) VALUES
    (1, 'administrator', 'administrator');

INSERT INTO `users` (`username`, `password_hash`, `role_id`, `department_id`) VALUES
    ('admin', '$2a$14$fN1QAI621DWoMREWdjvxnuM935ytQCq8vmaZzZ2iQNTBbKbs6it9q', 1, 1);

SET FOREIGN_KEY_CHECKS = 1;
