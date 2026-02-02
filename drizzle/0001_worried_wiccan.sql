CREATE TABLE `company_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`companyInfo` text,
	`reportContent` text,
	`parkAnalysis` text,
	`status` enum('pending','searching','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`dataSource` enum('web','tianyancha','qichacha') NOT NULL DEFAULT 'web',
	`wordFileUrl` text,
	`pdfFileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_source_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceType` enum('web','tianyancha','qichacha') NOT NULL,
	`apiKey` varchar(255),
	`apiSecret` varchar(255),
	`baseUrl` varchar(255),
	`isEnabled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `data_source_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `data_source_config_sourceType_unique` UNIQUE(`sourceType`)
);
--> statement-breakpoint
CREATE TABLE `park_companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`industry` varchar(128),
	`businessScope` text,
	`registeredCapital` varchar(64),
	`establishedDate` varchar(32),
	`contactPerson` varchar(64),
	`contactPhone` varchar(32),
	`contactEmail` varchar(128),
	`officeArea` varchar(64),
	`employeeCount` int,
	`tags` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `park_companies_id` PRIMARY KEY(`id`)
);
