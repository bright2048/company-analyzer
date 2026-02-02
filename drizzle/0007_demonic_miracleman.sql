CREATE TABLE `qichacha_full_data_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creditCode` varchar(64) NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`basicInfo` text,
	`shareholders` text,
	`executives` text,
	`executiveDetails` text,
	`patents` text,
	`trademarks` text,
	`copyrights` text,
	`customers` text,
	`suppliers` text,
	`annualReports` text,
	`certificates` text,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`hitCount` int NOT NULL DEFAULT 0,
	`lastHitAt` timestamp,
	CONSTRAINT `qichacha_full_data_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `qichacha_full_data_cache_creditCode_unique` UNIQUE(`creditCode`)
);
--> statement-breakpoint
CREATE TABLE `system_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configKey` varchar(64) NOT NULL,
	`configValue` varchar(255) NOT NULL,
	`description` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_config_configKey_unique` UNIQUE(`configKey`)
);
