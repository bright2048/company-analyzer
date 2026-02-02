CREATE TABLE `api_call_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiType` varchar(64) NOT NULL,
	`apiName` varchar(128) NOT NULL,
	`status` enum('success','failed') NOT NULL DEFAULT 'success',
	`cost` varchar(32),
	`companyName` varchar(255),
	`reportId` int,
	`requestParams` text,
	`responseSummary` text,
	`errorMessage` text,
	`calledAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_call_stats_id` PRIMARY KEY(`id`)
);
