CREATE TABLE `cache_warmup_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`totalCount` int NOT NULL DEFAULT 0,
	`completedCount` int NOT NULL DEFAULT 0,
	`skippedCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`status` enum('pending','processing','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`companyNames` text,
	`successList` text,
	`failedList` text,
	`errorMessage` text,
	`estimatedSavings` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `cache_warmup_tasks_id` PRIMARY KEY(`id`)
);
