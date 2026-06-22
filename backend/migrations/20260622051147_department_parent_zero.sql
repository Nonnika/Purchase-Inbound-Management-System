-- +goose Up
ALTER TABLE `departments`
    DROP FOREIGN KEY `fk_departments_parent`;

UPDATE `departments`
SET `parent` = 0
WHERE `parent` IS NULL;

ALTER TABLE `departments`
    MODIFY COLUMN `parent` bigint NOT NULL DEFAULT 0 COMMENT '父部门ID，0表示顶级部门';

-- +goose Down
ALTER TABLE `departments`
    MODIFY COLUMN `parent` bigint DEFAULT NULL COMMENT '父部门ID，NULL表示顶级部门';

UPDATE `departments`
SET `parent` = NULL
WHERE `parent` = 0;

ALTER TABLE `departments`
    ADD CONSTRAINT `fk_departments_parent`
    FOREIGN KEY (`parent`) REFERENCES `departments` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
