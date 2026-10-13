CREATE TABLE `mealLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`recipeId` varchar(64),
	`mealType` varchar(32) NOT NULL,
	`calories` int NOT NULL,
	`protein` int NOT NULL,
	`carbs` int NOT NULL,
	`fat` int NOT NULL,
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mealLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutritionRecipes` (
	`id` varchar(64) NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(48) NOT NULL,
	`diet` varchar(48) NOT NULL,
	`prepMinutes` int NOT NULL,
	`calories` int NOT NULL,
	`protein` int NOT NULL,
	`carbs` int NOT NULL,
	`fat` int NOT NULL,
	`fiber` int NOT NULL,
	`costBand` varchar(8) NOT NULL,
	`tags` text NOT NULL,
	`ingredients` text NOT NULL,
	`steps` text NOT NULL,
	`accent` varchar(24) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nutritionRecipes_id` PRIMARY KEY(`id`)
);
