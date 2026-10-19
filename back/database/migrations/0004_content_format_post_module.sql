ALTER TABLE `notes` ADD `format` text DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes_posts` ADD `format` text DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes_posts` ADD `module_slug` text;--> statement-breakpoint
-- Everything written before this migration is plain text; markdown is the default only for new entries.
UPDATE `notes` SET `format` = 'text';--> statement-breakpoint
UPDATE `notes_posts` SET `format` = 'text';--> statement-breakpoint
-- A module post used to be `content = {"type":"module","props":{"id":"<slug>"}}`. The module now lives in its
-- own column and the text part is left empty.
UPDATE `notes_posts` SET `module_slug` = json_extract(`content`, '$.props.id'), `content` = '""' WHERE json_valid(`content`) AND json_extract(`content`, '$.type') = 'module' AND json_type(`content`, '$.props.id') = 'text';
