ALTER TABLE `park_companies` MODIFY COLUMN `contactPhone` varchar(128);--> statement-breakpoint
ALTER TABLE `park_companies` ADD `creditCode` varchar(64);--> statement-breakpoint
ALTER TABLE `park_companies` ADD `legalPerson` varchar(64);--> statement-breakpoint
ALTER TABLE `park_companies` ADD `companyStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `park_companies` ADD `companyScale` varchar(32);--> statement-breakpoint
ALTER TABLE `park_companies` ADD `paidCapital` varchar(64);--> statement-breakpoint
ALTER TABLE `park_companies` ADD `province` varchar(32);--> statement-breakpoint
ALTER TABLE `park_companies` ADD `city` varchar(32);--> statement-breakpoint
ALTER TABLE `park_companies` ADD `district` varchar(32);--> statement-breakpoint
ALTER TABLE `park_companies` ADD `address` text;--> statement-breakpoint
ALTER TABLE `park_companies` ADD `dataSource` varchar(32);