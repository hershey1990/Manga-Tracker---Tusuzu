CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `import_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`source_file` text NOT NULL,
	`raw_title` text NOT NULL,
	`normalized_title` text NOT NULL,
	`series_id` text,
	`outcome` text DEFAULT 'new' NOT NULL,
	`message` text,
	`payload` text,
	FOREIGN KEY (`job_id`) REFERENCES `import_job`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `import_entry_job_idx` ON `import_entry` (`job_id`);--> statement-breakpoint
CREATE TABLE `import_job` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'preview' NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`imported` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`report` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `import_job_user_idx` ON `import_job` (`user_id`);--> statement-breakpoint
CREATE TABLE `library_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`series_id` text NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`total_units_override` integer,
	`score` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`notes` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_entry_user_series_idx` ON `library_entry` (`user_id`,`series_id`);--> statement-breakpoint
CREATE INDEX `library_entry_user_status_idx` ON `library_entry` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `library_entry_user_updated_idx` ON `library_entry` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `provider_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `series` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`normalized_title` text NOT NULL,
	`title_romaji` text,
	`title_native` text,
	`description` text,
	`cover_image` text,
	`publication_status` text,
	`year` integer,
	`total_units` integer,
	`genres` text,
	`source_url` text,
	`provider` text,
	`provider_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `series_normalized_title_idx` ON `series` (`normalized_title`);--> statement-breakpoint
CREATE UNIQUE INDEX `series_provider_unique_idx` ON `series` (`provider`,`provider_id`);--> statement-breakpoint
CREATE TABLE `series_alias` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `series_alias_unique_idx` ON `series_alias` (`series_id`,`normalized_alias`);--> statement-breakpoint
CREATE INDEX `series_alias_normalized_idx` ON `series_alias` (`normalized_alias`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);