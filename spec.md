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
- `created_at` - created_at
- `updated_at` - updated_at

# Workspaces
По умолчанию первое пространство `default`

## Таблица
Таблица `workspaces`

- `id` - autoincrement
- `user_id` - id user
- `name` - name
- `props` - json
- `created_at` - created_at
- `updated_at` - updated_at

# Categories
Таблица `categories`
- `id` - autoincrement
- `user_id` - id user
- `workspace_id` - relation belongs to `workspaces` possible is null
- `name`- name
- `props` - json default {}
- `created_at` - created_at
- `updated_at` - updated_at

# Notes

- `id` - autoincrement
- `user_id` - id user
- `category_id` - relation belongs to `categories` possible is null
- `workspace_id` - relation belongs to `workspaces` possible is null
- `title` - title
- `content` - content | json
- `tags` - array of tags
- `props` - json default {}
- `created_at` - created_at
- `updated_at` - updated_at

## Notes posts

Таблица `notes_posts`
- `id` - autoincrement
- `note_id` - relation belongs to `notes`
- `content` - content | json
- `tags` - array of tag
- `props` - json default {}
- `created_at` - created_at

