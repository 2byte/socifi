# Введение
Приложение для создания и работы с личным пространством.

# Users
## Таблица
Таблица `users`
- `id` - autoincrement
- `email` - email is possible null
- `login` - login
- `password` - password
- `name` - name

# Workspaces
По умолчанию первое пространство `default`

## Таблица
Таблица `workspaces`

- `id` - autoincrement
- `user_id` - id user
- `name` - name
- `props` - json

# Categories
Таблица `categories`
- `id` - autoincrement
- `user_id` - id user
- `workspace_id` - relation belongs to `workspaces` possible is null

# Notes

- `id` - autoincrement
- `user_id` - id user
- `category_id` - relation belongs to `categories` possible is null
- `workspace_id` - relation belongs to `workspaces` possible is null
- `title` - title
- `content` - content | json
- `tags` - array of tags
- `props` - json default {}