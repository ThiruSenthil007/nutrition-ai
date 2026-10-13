import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  dateOfBirth: varchar("dateOfBirth", { length: 10 }),
  age: int("age"),
  goalCalories: int("goalCalories").default(2050),
  goalProtein: int("goalProtein").default(120),
  goalCarbs: int("goalCarbs").default(220),
  goalFat: int("goalFat").default(70),
  hydrationGoal: int("hydrationGoal").default(8),
  heightCm: int("heightCm"),
  currentWeightKg: int("currentWeightKg"),
  targetWeightKg: int("targetWeightKg"),
  healthConditions: varchar("healthConditions", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const otpChallenges = mysqlTable("otpChallenges", {
  id: int("id").autoincrement().primaryKey(),
  identifier: varchar("identifier", { length: 320 }).notNull(),
  mode: varchar("mode", { length: 16 }).notNull(),
  payload: text("payload"),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  attempts: int("attempts").default(0).notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const nutritionRecipes = mysqlTable("nutritionRecipes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 48 }).notNull(),
  diet: varchar("diet", { length: 48 }).notNull(),
  prepMinutes: int("prepMinutes").notNull(),
  calories: int("calories").notNull(),
  protein: int("protein").notNull(),
  carbs: int("carbs").notNull(),
  fat: int("fat").notNull(),
  fiber: int("fiber").notNull(),
  costBand: varchar("costBand", { length: 8 }).notNull(),
  tags: text("tags").notNull(),
  ingredients: text("ingredients").notNull(),
  steps: text("steps").notNull(),
  accent: varchar("accent", { length: 24 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const mealLogs = mysqlTable("mealLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  recipeId: varchar("recipeId", { length: 64 }),
  mealType: varchar("mealType", { length: 32 }).notNull(),
  calories: int("calories").notNull(),
  protein: int("protein").notNull(),
  carbs: int("carbs").notNull(),
  fat: int("fat").notNull(),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
});

export const mealAnalyses = mysqlTable("mealAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  dishName: varchar("dishName", { length: 160 }).notNull(),
  servedGrams: int("servedGrams").notNull(),
  consumedGrams: int("consumedGrams").notNull(),
  caloriesServed: int("caloriesServed").notNull(),
  caloriesConsumed: int("caloriesConsumed").notNull(),
  wastePercent: int("wastePercent").notNull(),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
});

export const weightHistory = mysqlTable("weightHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  weightKg: int("weightKg").notNull(),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
});

export const scanHistory = mysqlTable("scanHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  fileName: varchar("fileName", { length: 180 }).notNull(),
  imageKey: varchar("imageKey", { length: 255 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }).notNull(),
  dishName: varchar("dishName", { length: 160 }).notNull(),
  confidence: int("confidence").notNull(),
  calories: int("calories").notNull(),
  protein: int("protein").notNull(),
  carbs: int("carbs").notNull(),
  fat: int("fat").notNull(),
  fiber: int("fiber").notNull(),
  detectedObjects: text("detectedObjects").notNull(),
  note: text("note").notNull(),
  cookingContext: mysqlEnum("cookingContext", ["homemade", "restaurant", "mess", "packaged"]).default("homemade").notNull(),
  recipeVariant: varchar("recipeVariant", { length: 180 }).default("").notNull(),
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
});

export const scanFeedback = mysqlTable("scanFeedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  scanId: int("scanId"),
  predictedDish: varchar("predictedDish", { length: 160 }).notNull(),
  correctedDish: varchar("correctedDish", { length: 160 }).notNull(),
  predictedCalories: int("predictedCalories").notNull(),
  correctedCalories: int("correctedCalories").notNull(),
  feedbackType: mysqlEnum("feedbackType", ["verified", "corrected"]).notNull(),
  cookingContext: mysqlEnum("feedbackCookingContext", ["homemade", "restaurant", "mess", "packaged"]).default("homemade").notNull(),
  recipeVariant: varchar("feedbackRecipeVariant", { length: 180 }).default("").notNull(),
  correctionNotes: text("correctionNotes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type NutritionRecipe = typeof nutritionRecipes.$inferSelect;
export type MealLog = typeof mealLogs.$inferSelect;
export type MealAnalysis = typeof mealAnalyses.$inferSelect;
export type WeightHistory = typeof weightHistory.$inferSelect;
export type ScanHistory = typeof scanHistory.$inferSelect;
export type ScanFeedback = typeof scanFeedback.$inferSelect;
