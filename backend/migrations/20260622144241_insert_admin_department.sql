-- +goose Up
SELECT 'up SQL query';
INSERT INTO departments(id,name, description)
values (1,'administrator','administrator');

INSERT INTO users(username, password_hash,role_id, department_id)
values ('administrator','$2a$14$fN1QAI621DWoMREWdjvxnuM935ytQCq8vmaZzZ2iQNTBbKbs6it9q',1,1);
-- +goose Down
SELECT 'down SQL query';
DELETE from users where username='administrator';
DELETE from departments where id=1;