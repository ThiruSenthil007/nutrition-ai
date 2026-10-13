CREATE TABLE `scanHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`fileName` varchar(180) NOT NULL,
	`imageKey` varchar(255) NOT NULL,
	`imageUrl` varchar(500) NOT NULL,
	`dishName` varchar(160) NOT NULL,
	`confidence` int NOT NULL,
	`calories` int NOT NULL,
	`protein` int NOT NULL,
	`carbs` int NOT NULL,
	`fat` int NOT NULL,
	`fiber` int NOT NULL,
	`detectedObjects` text NOT NULL,
	`note` text NOT NULL,
	`scannedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scanHistory_id` PRIMARY KEY(`id`)
);
