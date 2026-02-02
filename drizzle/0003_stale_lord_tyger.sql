CREATE TABLE `company_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creditCode` varchar(64) NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`legalPerson` varchar(64),
	`status` varchar(32),
	`establishDate` varchar(32),
	`registeredCapital` varchar(64),
	`address` text,
	`businessScope` text,
	`dataSource` varchar(32) DEFAULT 'qichacha',
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_cache_creditCode_unique` UNIQUE(`creditCode`)
);
--> statement-breakpoint
CREATE TABLE `company_search_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(128) NOT NULL,
	`creditCodes` text NOT NULL,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `company_search_cache_id` PRIMARY KEY(`id`)
);
