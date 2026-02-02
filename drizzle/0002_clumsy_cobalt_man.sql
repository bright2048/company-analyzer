CREATE TABLE `batch_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`totalCount` int NOT NULL DEFAULT 0,
	`completedCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`companyNames` text,
	`errorMessage` text,
	`zipFileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batch_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `sms_verification_codes`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_phone_unique`;--> statement-breakpoint
ALTER TABLE `company_reports` ADD `batchTaskId` int;--> statement-breakpoint
ALTER TABLE `company_reports` DROP COLUMN `userId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `phone`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `realName`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `idCard`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `isVerified`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `verifiedAt`;