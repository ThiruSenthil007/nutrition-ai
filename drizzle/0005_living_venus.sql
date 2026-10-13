CREATE TABLE `mealAnalyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`dishName` varchar(160) NOT NULL,
	`servedGrams` int NOT NULL,
	`consumedGrams` int NOT NULL,
	`caloriesServed` int NOT NULL,
	`caloriesConsumed` int NOT NULL,
	`wastePercent` int NOT NULL,
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mealAnalyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weightHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`weightKg` int NOT NULL,
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weightHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `heightCm` int;--> statement-breakpoint
ALTER TABLE `users` ADD `currentWeightKg` int;--> statement-breakpoint
ALTER TABLE `users` ADD `targetWeightKg` int;