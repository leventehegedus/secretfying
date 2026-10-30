CREATE TABLE `alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`route_key` text NOT NULL,
	`depart_date` text NOT NULL,
	`return_date` text,
	`amount` real NOT NULL,
	`sent_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alerts_lookup` ON `alerts` (`route_key`,`depart_date`,`return_date`,`sent_at`);--> statement-breakpoint
CREATE TABLE `deals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`watch_id` integer NOT NULL,
	`route_key` text NOT NULL,
	`key` text NOT NULL,
	`depart_date` text NOT NULL,
	`return_date` text,
	`status` text NOT NULL,
	`reasons` text NOT NULL,
	`discount_pct` real,
	`below_max_pct` real,
	`amount` real NOT NULL,
	`source` text NOT NULL,
	`stats` text,
	`detected_at` text NOT NULL,
	`verified_at` text,
	`verify_note` text,
	FOREIGN KEY (`watch_id`) REFERENCES `watches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deals_key_unique` ON `deals` (`key`);--> statement-breakpoint
CREATE INDEX `deals_watch` ON `deals` (`watch_id`,`status`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`is_cached` integer NOT NULL,
	`observed_at` text NOT NULL,
	`observed_day` text NOT NULL,
	`key` text NOT NULL,
	`expires_at` text,
	`currency` text NOT NULL,
	`amount` real NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`depart_date` text NOT NULL,
	`return_date` text,
	`stops` integer NOT NULL,
	`deep_link` text,
	`market` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `observations_key_unique` ON `observations` (`key`);--> statement-breakpoint
CREATE INDEX `observations_route` ON `observations` (`origin`,`destination`,`observed_at`);--> statement-breakpoint
CREATE TABLE `provider_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`json` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_cache_key_unique` ON `provider_cache` (`key`);--> statement-breakpoint
CREATE TABLE `quota_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`kind` text NOT NULL,
	`at` text NOT NULL,
	`day` text NOT NULL,
	`month` text NOT NULL,
	`status` text NOT NULL,
	`run_id` integer
);
--> statement-breakpoint
CREATE INDEX `quota_day` ON `quota_ledger` (`provider`,`day`);--> statement-breakpoint
CREATE INDEX `quota_month` ON `quota_ledger` (`provider`,`month`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`summary` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`months_ahead` integer NOT NULL,
	`depart_from` text,
	`depart_to` text,
	`min_stay` integer,
	`max_stay` integer,
	`trip_type` text NOT NULL,
	`max_stops` integer NOT NULL,
	`max_price` real,
	`active` integer NOT NULL,
	`created_at` text NOT NULL
);
