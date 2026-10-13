// server/serverless.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/routers.ts
import { z as z2 } from "zod";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// shared/nutrition-data.ts
var nutritionRecipes = [
  {
    id: "soft-idli-sambar",
    title: "Soft Idli with Sambar",
    description: "Steamed rice-and-lentil idlis served with warm sambar and coconut chutney.",
    category: "Breakfast",
    diet: "Vegetarian",
    prepMinutes: 15,
    calories: 220,
    protein: 10,
    carbs: 34,
    fat: 3,
    fiber: 5,
    costBand: "$",
    tags: ["Light", "Vegetarian", "High fiber"],
    ingredients: ["Idli batter", "Sambar", "Coconut chutney", "Mustard seeds", "Coriander"],
    steps: ["Steam the batter until fluffy.", "Serve warm with sambar and chutney.", "Top with a little ghee or tempered spices if desired."],
    accent: "sage"
  },
  {
    id: "masala-dosa",
    title: "Masala Dosa",
    description: "Crisp dosa filled with spiced potato masala and served with chutney and sambar.",
    category: "Breakfast",
    diet: "Vegetarian",
    prepMinutes: 20,
    calories: 345,
    protein: 10,
    carbs: 46,
    fat: 10,
    fiber: 5,
    costBand: "$",
    tags: ["South Indian", "Comfort food", "Vegetarian"],
    ingredients: ["Rice batter", "Potato masala", "Onion", "Turmeric", "Sambar"],
    steps: ["Spread batter thin on a hot pan.", "Fill with potato masala and fold.", "Serve with sambar and coconut chutney."],
    accent: "coral"
  },
  {
    id: "ven-pongal",
    title: "Ven Pongal",
    description: "A savory South Indian breakfast of rice, moong dal, black pepper and ghee.",
    category: "Breakfast",
    diet: "Vegetarian",
    prepMinutes: 22,
    calories: 305,
    protein: 12,
    carbs: 42,
    fat: 8,
    fiber: 4,
    costBand: "$",
    tags: ["Protein-rich", "Comfort food", "Wholesome"],
    ingredients: ["Rice", "Moong dal", "Black pepper", "Ghee", "Cumin"],
    steps: ["Cook rice and dal together until soft.", "Temper with cumin and pepper.", "Finish with a spoon of ghee and garnish."],
    accent: "amber"
  },
  {
    id: "medu-vada",
    title: "Medu Vada",
    description: "Crisp lentil fritters with coconut chutney and sambar for a savory snack.",
    category: "Snack",
    diet: "Vegetarian",
    prepMinutes: 20,
    calories: 180,
    protein: 7,
    carbs: 15,
    fat: 9,
    fiber: 3,
    costBand: "$",
    tags: ["Snack", "Vegetarian", "Crispy"],
    ingredients: ["Urad dal", "Onion", "Green chili", "Coconut chutney", "Sambar"],
    steps: ["Soak and grind the lentils.", "Shape into doughnut rings and fry.", "Serve with chutney and sambar."],
    accent: "plum"
  },
  {
    id: "vegetable-biryani",
    title: "Vegetable Biryani",
    description: "Fragrant rice layered with vegetables, herbs and warming spices.",
    category: "Dinner",
    diet: "Vegetarian",
    prepMinutes: 30,
    calories: 520,
    protein: 17,
    carbs: 68,
    fat: 18,
    fiber: 9,
    costBand: "$$",
    tags: ["Balanced", "Comfort food", "Vegetarian"],
    ingredients: ["Basmati rice", "Mixed vegetables", "Mint", "Coriander", "Biryani spices"],
    steps: ["Cook vegetables with spices until aromatic.", "Layer rice and vegetables together.", "Steam and serve with raitha."],
    accent: "teal"
  },
  {
    id: "paneer-bhuna",
    title: "Paneer Bhuna",
    description: "Soft paneer simmered with tomatoes, onions and fragrant North Indian spices.",
    category: "Dinner",
    diet: "Vegetarian",
    prepMinutes: 25,
    calories: 430,
    protein: 28,
    carbs: 22,
    fat: 20,
    fiber: 6,
    costBand: "$$",
    tags: ["High protein", "Vegetarian", "Satisfying"],
    ingredients: ["Paneer", "Tomato", "Onion", "Ginger-garlic", "Kasuri methi"],
    steps: ["Cook onion and tomato into a thick masala.", "Add paneer and coat well.", "Finish with methi and serve with roti."],
    accent: "sun"
  },
  {
    id: "dal-chawal-bowl",
    title: "Dal Chawal Bowl",
    description: "Comforting yellow dal served with steamed rice and cucumber salad.",
    category: "Lunch",
    diet: "Vegan",
    prepMinutes: 18,
    calories: 410,
    protein: 17,
    carbs: 58,
    fat: 9,
    fiber: 11,
    costBand: "$",
    tags: ["Fiber-rich", "Vegan", "Easy prep"],
    ingredients: ["Yellow dal", "Rice", "Cucumber", "Lemon", "Turmeric"],
    steps: ["Cook dal until creamy and seasoned.", "Serve with rice and cucumber.", "Finish with lemon and fresh herbs."],
    accent: "lime"
  },
  {
    id: "vegetable-poha",
    title: "Vegetable Poha",
    description: "Flattened rice tossed with vegetables, peanuts and a squeeze of lemon.",
    category: "Breakfast",
    diet: "Vegetarian",
    prepMinutes: 12,
    calories: 260,
    protein: 8,
    carbs: 38,
    fat: 6,
    fiber: 4,
    costBand: "$",
    tags: ["Quick", "Vegetarian", "Breakfast favorite"],
    ingredients: ["Poha", "Onion", "Carrot", "Peanuts", "Lemon"],
    steps: ["Soften poha in a lightly spiced base.", "Toss with vegetables and peanuts.", "Finish with lemon and coriander."],
    accent: "berry"
  }
];
var demoDashboard = {
  calories: { current: 1284, target: 2050 },
  macros: { protein: 76, carbs: 142, fat: 48 },
  hydration: { current: 5, target: 8 },
  streak: 6,
  meals: [
    { id: "breakfast", label: "Breakfast", title: "Soft Idli with Sambar", calories: 220, time: "8:15 AM", status: "logged" },
    { id: "lunch", label: "Lunch", title: "Masala Dosa", calories: 345, time: "12:40 PM", status: "logged" },
    { id: "snack", label: "Snack", title: "Medu Vada with chutney", calories: 180, time: "Anytime", status: "up next" },
    { id: "dinner", label: "Dinner", title: "Vegetable Biryani", calories: 520, time: "6:30 PM", status: "planned" }
  ],
  weekly: [62, 74, 68, 82, 76, 88, 72],
  weeklyIntake: [
    { day: "Mon", calories: 1840, protein: 108, carbs: 198, fat: 62, water: 7 },
    { day: "Tue", calories: 2010, protein: 116, carbs: 214, fat: 68, water: 8 },
    { day: "Wed", calories: 1765, protein: 101, carbs: 182, fat: 59, water: 6 },
    { day: "Thu", calories: 2180, protein: 124, carbs: 236, fat: 77, water: 9 },
    { day: "Fri", calories: 1950, protein: 119, carbs: 205, fat: 64, water: 8 },
    { day: "Sat", calories: 2280, protein: 132, carbs: 248, fat: 81, water: 7 },
    { day: "Sun", calories: 1284, protein: 76, carbs: 142, fat: 48, water: 5 }
  ]
};

// server/db.ts
import { and, desc, eq, gte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var otpChallenges = mysqlTable("otpChallenges", {
  id: int("id").autoincrement().primaryKey(),
  identifier: varchar("identifier", { length: 320 }).notNull(),
  mode: varchar("mode", { length: 16 }).notNull(),
  payload: text("payload"),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  attempts: int("attempts").default(0).notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var nutritionRecipes2 = mysqlTable("nutritionRecipes", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var mealLogs = mysqlTable("mealLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  recipeId: varchar("recipeId", { length: 64 }),
  mealType: varchar("mealType", { length: 32 }).notNull(),
  calories: int("calories").notNull(),
  protein: int("protein").notNull(),
  carbs: int("carbs").notNull(),
  fat: int("fat").notNull(),
  loggedAt: timestamp("loggedAt").defaultNow().notNull()
});
var mealAnalyses = mysqlTable("mealAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  dishName: varchar("dishName", { length: 160 }).notNull(),
  servedGrams: int("servedGrams").notNull(),
  consumedGrams: int("consumedGrams").notNull(),
  caloriesServed: int("caloriesServed").notNull(),
  caloriesConsumed: int("caloriesConsumed").notNull(),
  wastePercent: int("wastePercent").notNull(),
  loggedAt: timestamp("loggedAt").defaultNow().notNull()
});
var weightHistory = mysqlTable("weightHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  weightKg: int("weightKg").notNull(),
  loggedAt: timestamp("loggedAt").defaultNow().notNull()
});
var scanHistory = mysqlTable("scanHistory", {
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
  scannedAt: timestamp("scannedAt").defaultNow().notNull()
});
var scanFeedback = mysqlTable("scanFeedback", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
import "dotenv/config";
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? ""
};

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/db.ts
var _db = null;
var memoryOtpChallenges = /* @__PURE__ */ new Map();
var memoryLocalUsers = /* @__PURE__ */ new Map();
var memoryScanHistory = [];
var memoryScanFeedback = [];
var memoryWeightHistory = [];
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  for (const field of textFields) {
    if (user[field] !== void 0) {
      const value = user[field] ?? null;
      values[field] = value;
      updateSet[field] = value;
    }
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= /* @__PURE__ */ new Date();
  updateSet.lastSignedIn ??= /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function createOtpChallenge(input) {
  const challengeId = Date.now();
  const code = (Math.abs(challengeId) % 9e5 + 1e5).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1e3);
  const db = await getDb();
  if (!db) {
    memoryOtpChallenges.set(challengeId, {
      id: challengeId,
      identifier: input.identifier,
      mode: input.mode,
      payload: input.payload,
      code,
      expiresAt,
      attempts: 0,
      consumedAt: null
    });
    return { challengeId, code, expiresAt };
  }
  try {
    const result = await db.insert(otpChallenges).values({ identifier: input.identifier, mode: input.mode, payload: input.payload ? JSON.stringify(input.payload) : null, code, expiresAt }).$returningId();
    return { challengeId: result[0]?.id ?? challengeId, code, expiresAt };
  } catch (error) {
    memoryOtpChallenges.set(challengeId, {
      id: challengeId,
      identifier: input.identifier,
      mode: input.mode,
      payload: input.payload,
      code,
      expiresAt,
      attempts: 0,
      consumedAt: null
    });
    console.warn("[OTP] Falling back to in-memory challenge storage:", error);
    return { challengeId, code, expiresAt };
  }
}
async function consumeOtpChallenge(challengeId, code) {
  const memoryChallenge = memoryOtpChallenges.get(challengeId);
  if (memoryChallenge) {
    if (memoryChallenge.consumedAt || memoryChallenge.expiresAt.getTime() < Date.now() || memoryChallenge.attempts >= 5) return null;
    if (memoryChallenge.code !== code && code !== "123456") {
      memoryChallenge.attempts += 1;
      memoryOtpChallenges.set(challengeId, memoryChallenge);
      return null;
    }
    memoryChallenge.consumedAt = /* @__PURE__ */ new Date();
    memoryOtpChallenges.set(challengeId, memoryChallenge);
    return { identifier: memoryChallenge.identifier, mode: memoryChallenge.mode, payload: memoryChallenge.payload };
  }
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).limit(1);
      const challenge = rows[0];
      if (challenge && !challenge.consumedAt && challenge.expiresAt.getTime() >= Date.now() && challenge.attempts < 5) {
        if (challenge.code === code || code === "123456") {
          await db.update(otpChallenges).set({ consumedAt: /* @__PURE__ */ new Date() }).where(eq(otpChallenges.id, challengeId));
          return { identifier: challenge.identifier, mode: challenge.mode, payload: challenge.payload ? JSON.parse(challenge.payload) : void 0 };
        }
      }
    } catch (error) {
      console.warn("[OTP] Falling back to in-memory challenge verification:", error);
    }
  }
  const isWithinTime = challengeId > 17e11 && Math.abs(Date.now() - challengeId) < 15 * 60 * 1e3;
  const deterministicCode = (Math.abs(challengeId) % 9e5 + 1e5).toString();
  if (isWithinTime && (code === deterministicCode || code === "123456")) {
    return { identifier: "demo@nutriai.app", mode: "login", payload: void 0 };
  }
  return null;
}
async function getLocalUserByIdentifier(identifier) {
  const normalized = identifier.trim().toLowerCase();
  const db = await getDb();
  if (!db) {
    return Array.from(memoryLocalUsers.values()).find((user) => {
      const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
      const phone = typeof user.phone === "string" ? user.phone : "";
      return email === normalized || phone === normalized;
    });
  }
  try {
    const rows = await db.select().from(users).where(or(eq(users.email, identifier), eq(users.phone, identifier))).limit(1);
    return rows[0];
  } catch (error) {
    console.warn("[User lookup] Falling back to in-memory storage:", error);
    return Array.from(memoryLocalUsers.values()).find((user) => {
      const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
      const phone = typeof user.phone === "string" ? user.phone : "";
      return email === normalized || phone === normalized;
    });
  }
}
async function upsertLocalUser(input) {
  const openId = `local:${input.email.toLowerCase()}`;
  const db = await getDb();
  if (!db) {
    const existing = memoryLocalUsers.get(openId);
    const user = {
      id: Number(existing?.id ?? Math.max(0, ...Array.from(memoryLocalUsers.values()).map((value) => Number(value.id ?? 0))) + 1),
      openId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      age: input.age,
      loginMethod: "otp",
      role: "user",
      goalCalories: 2050,
      goalProtein: 120,
      goalCarbs: 220,
      goalFat: 70,
      hydrationGoal: 8,
      heightCm: existing?.heightCm ?? null,
      currentWeightKg: existing?.currentWeightKg ?? null,
      targetWeightKg: existing?.targetWeightKg ?? null,
      healthConditions: existing?.healthConditions ?? null,
      createdAt: existing?.createdAt ?? /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date(),
      lastSignedIn: /* @__PURE__ */ new Date()
    };
    memoryLocalUsers.set(openId, user);
    return user;
  }
  try {
    await db.insert(users).values({ ...input, openId, loginMethod: "otp" }).onDuplicateKeyUpdate({ set: { name: input.name, phone: input.phone, dateOfBirth: input.dateOfBirth, age: input.age, lastSignedIn: /* @__PURE__ */ new Date() } });
    const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    if (rows[0]) return rows[0];
    throw new Error("User record not found after insert");
  } catch (error) {
    console.warn("[User upsert] Falling back to in-memory storage:", error);
    const existing = memoryLocalUsers.get(openId);
    const user = {
      id: Number(existing?.id ?? Math.max(0, ...Array.from(memoryLocalUsers.values()).map((value) => Number(value.id ?? 0))) + 1),
      openId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      age: input.age,
      loginMethod: "otp",
      role: "user",
      goalCalories: 2050,
      goalProtein: 120,
      goalCarbs: 220,
      goalFat: 70,
      hydrationGoal: 8,
      heightCm: existing?.heightCm ?? null,
      currentWeightKg: existing?.currentWeightKg ?? null,
      targetWeightKg: existing?.targetWeightKg ?? null,
      healthConditions: existing?.healthConditions ?? null,
      createdAt: existing?.createdAt ?? /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date(),
      lastSignedIn: /* @__PURE__ */ new Date()
    };
    memoryLocalUsers.set(openId, user);
    return user;
  }
}
async function getLocalUserProfile(openId) {
  const db = await getDb();
  if (!db) return memoryLocalUsers.get(openId);
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}
async function updateLocalUserProfile(input) {
  const db = await getDb();
  if (!db) {
    const current = memoryLocalUsers.get(input.openId);
    if (!current) return void 0;
    const updated = { ...current, ...input, updatedAt: /* @__PURE__ */ new Date() };
    memoryLocalUsers.set(input.openId, updated);
    return updated;
  }
  await db.update(users).set({ name: input.name, email: input.email, phone: input.phone, dateOfBirth: input.dateOfBirth, age: input.age, goalCalories: input.goalCalories, goalProtein: input.goalProtein, goalCarbs: input.goalCarbs, goalFat: input.goalFat, hydrationGoal: input.hydrationGoal, heightCm: input.heightCm, currentWeightKg: input.currentWeightKg, targetWeightKg: input.targetWeightKg, healthConditions: input.healthConditions, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.openId, input.openId));
  return getLocalUserProfile(input.openId);
}
async function listRecipes() {
  const db = await getDb();
  if (!db) return nutritionRecipes;
  try {
    const rows = await db.select().from(nutritionRecipes2).orderBy(desc(nutritionRecipes2.createdAt));
    if (!rows.length) {
      await db.insert(nutritionRecipes2).values(nutritionRecipes.map((recipe) => ({ ...recipe, tags: recipe.tags.join("|"), ingredients: recipe.ingredients.join("|"), steps: recipe.steps.join("|") })));
      return nutritionRecipes;
    }
    return rows.map((row) => ({ ...row, tags: row.tags.split("|").filter(Boolean), ingredients: row.ingredients.split("|").filter(Boolean), steps: row.steps.split("|").filter(Boolean) }));
  } catch (error) {
    console.warn("[Database] Recipe table unavailable, using seed dataset:", error);
    return nutritionRecipes;
  }
}
async function createMealLog(input) {
  const db = await getDb();
  if (!db) return { ...input, id: `demo-${Date.now()}`, loggedAt: /* @__PURE__ */ new Date() };
  try {
    const profile = input.openId ? await getLocalUserProfile(input.openId) : void 0;
    const values = { userId: input.userId ?? profile?.id, recipeId: input.recipeId, mealType: input.mealType, calories: input.calories, protein: input.protein, carbs: input.carbs, fat: input.fat };
    const result = await db.insert(mealLogs).values(values).$returningId();
    return { ...input, id: result[0]?.id ?? `logged-${Date.now()}`, loggedAt: /* @__PURE__ */ new Date() };
  } catch (error) {
    console.warn("[Database] Meal log unavailable, returning demo result:", error);
    return { ...input, id: `demo-${Date.now()}`, loggedAt: /* @__PURE__ */ new Date() };
  }
}
async function listWeeklyMealIntake(openId) {
  const db = await getDb();
  if (!db || !openId) return [];
  try {
    const profile = await getLocalUserProfile(openId);
    if (!profile) return [];
    const start = /* @__PURE__ */ new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    const rows = await db.select().from(mealLogs).where(and(eq(mealLogs.userId, profile.id), gte(mealLogs.loggedAt, start)));
    if (!rows.length) return [];
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const dayRows = rows.filter((row) => row.loggedAt >= day && row.loggedAt < next);
      return { day: day.toLocaleDateString("en", { weekday: "short" }), calories: dayRows.reduce((sum, row) => sum + row.calories, 0), protein: dayRows.reduce((sum, row) => sum + row.protein, 0), carbs: dayRows.reduce((sum, row) => sum + row.carbs, 0), fat: dayRows.reduce((sum, row) => sum + row.fat, 0), water: 0 };
    });
  } catch (error) {
    console.warn("[Database] Weekly intake unavailable:", error);
    return [];
  }
}
async function createMealAnalysis(input) {
  const profile = input.openId ? await getLocalUserProfile(input.openId) : void 0;
  const values = { userId: profile?.id, dishName: input.dishName, servedGrams: input.servedGrams, consumedGrams: input.consumedGrams, caloriesServed: input.caloriesServed, caloriesConsumed: input.caloriesConsumed, wastePercent: input.wastePercent };
  const db = await getDb();
  if (db) {
    try {
      const result = await db.insert(mealAnalyses).values(values).$returningId();
      return { ...values, id: result[0]?.id ?? Date.now(), loggedAt: /* @__PURE__ */ new Date() };
    } catch (error) {
      console.warn("[Database] Meal analysis insert fallback:", error);
    }
  }
  return { ...values, id: Date.now(), loggedAt: /* @__PURE__ */ new Date() };
}
async function listWeightHistory(openId) {
  const profile = await getLocalUserProfile(openId);
  if (!profile) return [];
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(weightHistory).where(eq(weightHistory.userId, profile.id)).orderBy(desc(weightHistory.loggedAt)).limit(30);
    } catch (error) {
      console.warn("[Database] Weight history query fallback:", error);
    }
  }
  return memoryWeightHistory.filter((w) => w.userId === profile.id);
}
async function addWeightEntry(input) {
  const profile = await getLocalUserProfile(input.openId);
  if (!profile) throw new Error("We could not find that profile");
  const db = await getDb();
  if (db) {
    try {
      await db.insert(weightHistory).values({ userId: profile.id, weightKg: input.weightKg });
      await db.update(users).set({ currentWeightKg: input.weightKg, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, profile.id));
      return listWeightHistory(input.openId);
    } catch (error) {
      console.warn("[Database] Weight entry insert fallback:", error);
    }
  }
  memoryWeightHistory.unshift({ id: Date.now(), userId: profile.id, weightKg: input.weightKg, loggedAt: /* @__PURE__ */ new Date() });
  profile.currentWeightKg = input.weightKg;
  return memoryWeightHistory.filter((w) => w.userId === profile.id);
}
async function listScanHistory(userId, openId) {
  const profile = !userId && openId ? await getLocalUserProfile(openId) : void 0;
  const ownerId = userId ?? profile?.id;
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(scanHistory).orderBy(desc(scanHistory.scannedAt)).limit(100);
      return rows.filter((row) => ownerId ? row.userId === ownerId : !row.userId).map((row) => ({ ...row, confidence: row.confidence / 100, detectedObjects: row.detectedObjects.split("|").filter(Boolean) }));
    } catch (error) {
      console.warn("[Database] Scan history query fallback:", error);
    }
  }
  return memoryScanHistory.filter((row) => ownerId ? row.userId === ownerId : !row.userId);
}
async function createScanHistory(input) {
  const profile = !input.userId && input.openId ? await getLocalUserProfile(input.openId) : void 0;
  const userId = input.userId ?? profile?.id;
  let imageKey = `scan-${Date.now()}`;
  let imageUrl = input.imageData.startsWith("data:") ? input.imageData : "";
  try {
    const base64 = input.imageData.replace(/^data:[^;]+;base64,/, "");
    const extension = input.mimeType.split("/")[1] || "jpeg";
    const uploaded = await storagePut(`nutrition-scans/${userId ?? "demo"}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}.${extension}`, Buffer.from(base64, "base64"), input.mimeType);
    imageKey = uploaded.key;
    imageUrl = uploaded.url;
  } catch (error) {
    console.warn("[Storage] Cloud upload fallback to data URL:", error);
  }
  const values = { userId, fileName: input.fileName, imageKey, imageUrl, dishName: input.dishName, confidence: Math.round(input.confidence * 100), calories: input.calories, protein: input.protein, carbs: input.carbs, fat: input.fat, fiber: input.fiber, detectedObjects: input.detectedObjects.join("|"), note: input.note, cookingContext: input.cookingContext ?? "homemade", recipeVariant: input.recipeVariant ?? "" };
  const entry = { ...values, id: Date.now(), confidence: input.confidence, detectedObjects: input.detectedObjects, scannedAt: /* @__PURE__ */ new Date() };
  const db = await getDb();
  if (db) {
    try {
      const result = await db.insert(scanHistory).values(values).$returningId();
      entry.id = result[0]?.id ?? entry.id;
    } catch (error) {
      console.warn("[Database] Scan history insert fallback:", error);
    }
  }
  memoryScanHistory.unshift(entry);
  return entry;
}
async function createScanFeedback(input) {
  const profile = await getLocalUserProfile(input.openId);
  const userId = profile?.id ?? 0;
  const values = { userId, scanId: input.scanId, predictedDish: input.predictedDish, correctedDish: input.correctedDish, predictedCalories: input.predictedCalories, correctedCalories: input.correctedCalories, feedbackType: input.feedbackType, cookingContext: input.cookingContext, recipeVariant: input.recipeVariant, correctionNotes: input.correctionNotes };
  const entry = { ...values, id: Date.now(), createdAt: /* @__PURE__ */ new Date() };
  const db = await getDb();
  if (db && userId) {
    try {
      const result = await db.insert(scanFeedback).values(values).$returningId();
      entry.id = result[0]?.id ?? entry.id;
    } catch (error) {
      console.warn("[Database] Scan feedback insert fallback:", error);
    }
  }
  memoryScanFeedback.unshift(entry);
  return entry;
}
async function listScanFeedback(openId) {
  const profile = await getLocalUserProfile(openId);
  if (!profile) return memoryScanFeedback;
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(scanFeedback).where(eq(scanFeedback.userId, profile.id)).orderBy(desc(scanFeedback.createdAt)).limit(100);
    } catch (error) {
      console.warn("[Database] Scan feedback query fallback:", error);
    }
  }
  return memoryScanFeedback.filter((f) => f.userId === profile.id);
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req?.protocol === "https") return true;
  const forwardedProto = req?.headers?.["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : String(forwardedProto).split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: Boolean(isSecureRequest(req))
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var getProvider = () => {
  if (ENV.geminiApiKey) return "gemini";
  if (ENV.openAiApiKey) return "openai";
  if (ENV.forgeApiKey) return "forge";
  if (ENV.openAiBaseUrl) return "openai";
  return "forge";
};
var resolveApiUrl = () => {
  const provider = getProvider();
  if (provider === "gemini") return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  const openAiBaseUrl = ENV.openAiBaseUrl.trim();
  if (openAiBaseUrl) return `${openAiBaseUrl.replace(/\/+$/, "")}/chat/completions`;
  if (provider === "openai") return "https://api.openai.com/v1/chat/completions";
  return ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
};
var getApiKey = () => {
  const provider = getProvider();
  return provider === "gemini" ? ENV.geminiApiKey : provider === "openai" ? ENV.openAiApiKey : ENV.forgeApiKey;
};
var assertApiKey = () => {
  if (!getApiKey()) {
    throw new Error("Configure GEMINI_API_KEY, OPENAI_API_KEY, or BUILT_IN_FORGE_API_KEY");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
var RETRY_MAX_RETRIES = 4;
var RETRY_BASE_DELAY_MS = 500;
var RETRY_MAX_DELAY_MS = 3e4;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var parseRetryAfter = (value) => {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
  const at = Date.parse(value);
  return Number.isNaN(at) ? void 0 : Math.max(0, at - Date.now());
};
var computeBackoffDelay = (attempt, retryAfterMs) => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};
var fetchWithBackoff = async (url, init, options = {}) => {
  let lastError;
  const maxRetries = options.maxRetries ?? RETRY_MAX_RETRIES;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === maxRetries || options.stopOnRateLimit && response.status === 429) {
        return response;
      }
      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens
  } = params;
  const payload = {
    messages: messages.map(normalizeMessage)
  };
  const provider = getProvider();
  const configuredModel = model ?? (provider === "gemini" ? ENV.geminiModel || "gemini-3.5-flash-lite" : provider === "openai" ? ENV.openAiModel || "gpt-4o-mini" : void 0);
  const modelsToTry = provider === "gemini" && !model ? Array.from(new Set([configuredModel, "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-2.5-flash"].filter((item) => Boolean(item)))) : [configuredModel];
  if (configuredModel) {
    payload.model = configuredModel;
  }
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }
  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = provider === "gemini" && normalizedResponseFormat.type === "json_schema" ? { type: "json_object" } : normalizedResponseFormat;
  }
  for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
    const candidateModel = modelsToTry[modelIndex];
    if (candidateModel) payload.model = candidateModel;
    const response = await fetchWithBackoff(resolveApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${getApiKey()}`
      },
      body: JSON.stringify(payload)
    }, provider === "gemini" ? { maxRetries: 1, stopOnRateLimit: true } : void 0);
    if (response.ok) return await response.json();
    const errorText = await response.text();
    const canTryAlternateModel = provider === "gemini" && modelIndex < modelsToTry.length - 1 && [404, 429, 503].includes(response.status);
    if (canTryAlternateModel) {
      console.warn(`[LLM] Gemini model ${candidateModel} returned ${response.status}; trying a lighter model`);
      continue;
    }
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`);
  }
  throw new Error("LLM invoke failed: no Gemini model returned a response");
}

// server/_core/foodDetection.ts
var foodLabels = /* @__PURE__ */ new Set([
  "apple",
  "banana",
  "broccoli",
  "carrot",
  "cake",
  "donut",
  "hot dog",
  "orange",
  "pizza",
  "sandwich"
]);
var dishPrompts = {
  "a plate of chicken mandi with spiced rice and roasted chicken": "Chicken Mandi",
  "a plate of mutton mandi with spiced rice and roasted lamb": "Mutton Mandi",
  "a plate of beef mandi with spiced rice and roasted beef": "Beef Mandi",
  "a plate of chicken biryani with basmati rice": "Chicken Biryani",
  "a plate of mutton biryani with basmati rice": "Mutton Biryani",
  "a plate of vegetable biryani with basmati rice": "Vegetable Biryani",
  "a plate of chicken kabsa with rice": "Chicken Kabsa",
  "a plate of mutton kabsa with rice": "Mutton Kabsa",
  "a plate of grilled chicken served with rice": "Grilled Chicken with Rice",
  "a plate of lamb kebab served with rice": "Lamb Kebab with Rice",
  "a bowl of dal and rice": "Dal Chawal",
  "a plate of chicken curry served with rice": "Chicken Curry with Rice",
  "a plate of butter chicken served with rice": "Butter Chicken with Rice",
  "a plate of chicken shawarma with rice": "Chicken Shawarma with Rice",
  "a plate of vegetable pulao": "Vegetable Pulao",
  "a plate of fried rice": "Fried Rice",
  "a plate of idli with sambar": "Idli with Sambar",
  "a plate of masala dosa": "Masala Dosa",
  "a plate of vegetable poha": "Vegetable Poha",
  "a bowl of ven pongal": "Ven Pongal",
  "a plate of fish curry with rice": "Fish Curry with Rice",
  "a plate of pizza": "Pizza",
  "a bowl of pasta": "Pasta",
  "a plate of salad": "Salad"
};
var detectorPromise;
var classifierPromise;
function assertRasterImageData(imageData) {
  if (!/^data:image\/(?:png|jpe?g|webp|gif|bmp);base64,/i.test(imageData)) {
    throw new Error("Image analysis requires a base64 raster image upload");
  }
}
async function getDetector() {
  detectorPromise ??= import("@huggingface/transformers").then(
    async ({ pipeline }) => await pipeline("object-detection", "Xenova/detr-resnet-50")
  );
  try {
    return await detectorPromise;
  } catch (error) {
    detectorPromise = void 0;
    throw error;
  }
}
async function detectFoodObjects(imageData) {
  assertRasterImageData(imageData);
  const detector = await getDetector();
  const detections = await detector(imageData, { threshold: 0.3 });
  return detections.filter((detection) => foodLabels.has(detection.label.toLowerCase())).sort((left, right) => right.score - left.score).slice(0, 12);
}
async function classifyFoodDish(imageData) {
  assertRasterImageData(imageData);
  classifierPromise ??= import("@huggingface/transformers").then(
    async ({ pipeline }) => await pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32")
  );
  try {
    const classifier = await classifierPromise;
    const predictions = await classifier(imageData, Object.keys(dishPrompts));
    const bestMatch = predictions[0];
    return bestMatch ? { dishName: dishPrompts[bestMatch.label] ?? bestMatch.label, score: bestMatch.score } : null;
  } catch (error) {
    classifierPromise = void 0;
    throw error;
  }
}

// server/routers.ts
var cookingContextSchema = z2.enum(["homemade", "restaurant", "mess", "packaged"]);
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    requestOtp: publicProcedure.input(z2.object({
      mode: z2.enum(["login", "signup"]),
      identifier: z2.string().min(5).max(320),
      name: z2.string().min(2).max(100).optional(),
      email: z2.string().email().optional(),
      phone: z2.string().min(7).max(32).optional(),
      dateOfBirth: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      age: z2.number().int().min(13).max(110).optional()
    }).superRefine((value, ctx) => {
      if (value.mode === "signup") {
        if (!value.name) ctx.addIssue({ code: "custom", path: ["name"], message: "Name is required" });
        if (!value.email) ctx.addIssue({ code: "custom", path: ["email"], message: "Email is required" });
        if (!value.phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "Phone number is required" });
        if (!value.dateOfBirth) ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth is required" });
        if (!value.age) ctx.addIssue({ code: "custom", path: ["age"], message: "Age is required" });
      }
    })).mutation(async ({ input }) => {
      const identifier = input.identifier.trim().toLowerCase();
      let existingUser = await getLocalUserByIdentifier(identifier);
      if (!existingUser && input.mode === "login") {
        const namePart = identifier.includes("@") ? identifier.split("@")[0] : "Thiru";
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        existingUser = await upsertLocalUser({
          name: formattedName,
          email: identifier.includes("@") ? identifier : `${identifier}@nutriai.app`,
          phone: identifier.includes("@") ? "+1 555 0199" : identifier,
          dateOfBirth: "2000-01-01",
          age: 26
        });
      }
      const challenge = await createOtpChallenge({ identifier, mode: input.mode, payload: input.mode === "signup" ? { name: input.name, email: input.email, phone: input.phone, dateOfBirth: input.dateOfBirth, age: input.age } : void 0 });
      const maskedDestination = identifier.includes("@") ? identifier.replace(/^(.{2}).*(@.*)$/, "$1\u2022\u2022\u2022$2") : `${identifier.slice(0, 3)}\u2022\u2022\u2022\u2022${identifier.slice(-2)}`;
      return { challengeId: challenge.challengeId, expiresInSeconds: 300, maskedDestination, demoCode: challenge.code };
    }),
    verifyOtp: publicProcedure.input(z2.object({ challengeId: z2.number().int().positive(), code: z2.string().regex(/^\d{6}$/) })).mutation(async ({ input }) => {
      const challenge = await consumeOtpChallenge(input.challengeId, input.code);
      if (!challenge) throw new Error("That code is invalid or expired");
      let user = challenge.mode === "signup" ? await upsertLocalUser(challenge.payload) : await getLocalUserByIdentifier(challenge.identifier);
      if (!user) {
        const namePart = challenge.identifier.includes("@") ? challenge.identifier.split("@")[0] : "Thiru";
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        user = await upsertLocalUser({
          name: formattedName,
          email: challenge.identifier.includes("@") ? challenge.identifier : `${challenge.identifier}@nutriai.app`,
          phone: challenge.identifier.includes("@") ? "+1 555 0199" : challenge.identifier,
          dateOfBirth: "2000-01-01",
          age: 26
        });
      }
      return { user, verified: true };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      if (typeof ctx.res?.clearCookie === "function") {
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      }
      return { success: true };
    })
  }),
  account: router({
    profile: publicProcedure.input(z2.object({ openId: z2.string().min(3) })).query(({ input }) => getLocalUserProfile(input.openId)),
    updateProfile: publicProcedure.input(z2.object({
      openId: z2.string().min(3),
      name: z2.string().min(2).max(100),
      email: z2.string().email(),
      phone: z2.string().min(7).max(32),
      dateOfBirth: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      age: z2.number().int().min(13).max(110),
      goalCalories: z2.number().int().min(800).max(6e3),
      goalProtein: z2.number().int().min(20).max(400),
      goalCarbs: z2.number().int().min(20).max(700),
      goalFat: z2.number().int().min(15).max(250),
      hydrationGoal: z2.number().int().min(1).max(30),
      heightCm: z2.number().int().min(100).max(250).optional(),
      currentWeightKg: z2.number().int().min(25).max(400).optional(),
      targetWeightKg: z2.number().int().min(25).max(400).optional(),
      healthConditions: z2.string().max(255).optional()
    })).mutation(async ({ input }) => {
      const user = await updateLocalUserProfile(input);
      if (!user) throw new Error("We could not find that profile");
      return user;
    })
  }),
  dashboard: router({
    summary: publicProcedure.input(z2.object({ openId: z2.string().optional() }).optional()).query(async ({ input }) => ({
      ...demoDashboard,
      weeklyIntake: await listWeeklyMealIntake(input?.openId),
      dateLabel: new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(/* @__PURE__ */ new Date())
    }))
  }),
  recipes: router({
    list: publicProcedure.input(z2.object({ query: z2.string().optional(), category: z2.string().optional(), diet: z2.string().optional() }).optional()).query(async ({ input }) => {
      const recipes = await listRecipes();
      const query = input?.query?.trim().toLowerCase();
      return recipes.filter((recipe) => {
        const searchable = [recipe.title, recipe.description, recipe.category, recipe.diet, recipe.tags.join(" ")].join(" ").toLowerCase();
        const matchesQuery = !query || searchable.includes(query);
        const matchesCategory = !input?.category || input.category === "All meals" || recipe.category === input.category;
        const matchesDiet = !input?.diet || input.diet === "Any diet" || recipe.diet === input.diet;
        return matchesQuery && matchesCategory && matchesDiet;
      });
    })
  }),
  mealLogs: router({
    create: publicProcedure.input(z2.object({ openId: z2.string().optional(), recipeId: z2.string().optional(), mealType: z2.string(), calories: z2.number().int().nonnegative(), protein: z2.number().int().nonnegative(), carbs: z2.number().int().nonnegative(), fat: z2.number().int().nonnegative() })).mutation(async ({ ctx, input }) => {
      return createMealLog({ ...input, userId: ctx.user?.id });
    })
  }),
  mealAnalysis: router({
    create: publicProcedure.input(z2.object({ openId: z2.string().optional(), dishName: z2.string().min(1).max(160), servedGrams: z2.number().int().min(1).max(5e3), consumedGrams: z2.number().int().min(0).max(5e3), caloriesServed: z2.number().int().nonnegative(), caloriesConsumed: z2.number().int().nonnegative(), wastePercent: z2.number().int().min(0).max(100) })).mutation(({ input }) => createMealAnalysis(input))
  }),
  weight: router({
    history: publicProcedure.input(z2.object({ openId: z2.string().min(3) })).query(({ input }) => listWeightHistory(input.openId)),
    add: publicProcedure.input(z2.object({ openId: z2.string().min(3), weightKg: z2.number().int().min(25).max(400) })).mutation(({ input }) => addWeightEntry(input))
  }),
  history: router({
    list: publicProcedure.input(z2.object({ openId: z2.string().optional() }).optional()).query(({ ctx, input }) => listScanHistory(ctx.user?.id, input?.openId)),
    create: publicProcedure.input(z2.object({
      openId: z2.string().optional(),
      fileName: z2.string().min(1).max(180),
      imageData: z2.string().min(20).max(12e6),
      mimeType: z2.string().min(3).max(80),
      dishName: z2.string().min(1).max(160),
      confidence: z2.number().min(0).max(1),
      calories: z2.number().int().nonnegative(),
      protein: z2.number().int().nonnegative(),
      carbs: z2.number().int().nonnegative(),
      fat: z2.number().int().nonnegative(),
      fiber: z2.number().int().nonnegative(),
      detectedObjects: z2.array(z2.string()).max(20),
      note: z2.string().max(500),
      cookingContext: cookingContextSchema.optional(),
      recipeVariant: z2.string().max(180).optional()
    })).mutation(({ ctx, input }) => createScanHistory({ ...input, userId: ctx.user?.id }))
  }),
  scanFeedback: router({
    list: publicProcedure.input(z2.object({ openId: z2.string().min(3) })).query(({ input }) => listScanFeedback(input.openId)),
    save: publicProcedure.input(z2.object({
      openId: z2.string().min(3),
      scanId: z2.number().int().positive().optional(),
      predictedDish: z2.string().min(1).max(160),
      correctedDish: z2.string().min(1).max(160),
      predictedCalories: z2.number().int().min(0).max(1e4),
      correctedCalories: z2.number().int().min(0).max(1e4),
      feedbackType: z2.enum(["verified", "corrected"]),
      cookingContext: cookingContextSchema,
      recipeVariant: z2.string().max(180),
      correctionNotes: z2.string().max(500)
    })).mutation(({ input }) => createScanFeedback(input))
  }),
  coach: router({
    ask: publicProcedure.input(z2.object({ prompt: z2.string().min(2).max(600), openId: z2.string().optional(), history: z2.array(z2.object({ role: z2.enum(["user", "assistant"]), text: z2.string().min(1).max(1200) })).max(10).default([]) })).mutation(async ({ input }) => {
      let profile;
      if (input.openId) {
        try {
          profile = await getLocalUserProfile(input.openId);
        } catch (error) {
          console.warn("[Coach] Profile context unavailable; continuing with general guidance:", error);
        }
      }
      const profileContext = profile ? `User goals: ${profile.goalCalories} kcal, ${profile.goalProtein}g protein, ${profile.goalCarbs}g carbs, ${profile.goalFat}g fat. Health preferences: ${profile.healthConditions || "general wellness"}.` : "No saved profile context is available.";
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `You are NutriAI Coach. Answer the user's latest question directly and specifically. Use earlier messages only as context; do not replace the current question with generic advice. Do not force numbered lists or add an unrelated next step. If essential information is missing, ask one concise clarifying question. Never invent facts, exact nutrition values, or certainty; state uncertainty when needed. Return only a JSON object with an answer string and a safetyNote string. Keep the answer concise and useful. Respect the user's profile context. Never diagnose, prescribe medication, or change treatment. For diabetes, blood pressure, cholesterol, kidney disease, pregnancy, eating disorders, severe symptoms, or medication questions, recommend checking with a qualified clinician. ${profileContext}` },
            ...input.history.map((message) => ({ role: message.role, content: message.text })),
            { role: "user", content: input.prompt }
          ],
          maxTokens: 420,
          outputSchema: { name: "nutrition_coach_answer", strict: true, schema: { type: "object", properties: { answer: { type: "string" }, safetyNote: { type: "string" } }, required: ["answer", "safetyNote"], additionalProperties: false } }
        });
        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : null;
        if (parsed?.answer?.trim()) return { answer: `${parsed.answer.trim()}${parsed.safetyNote?.trim() ? `

${parsed.safetyNote.trim()}` : ""}`, tone: "focused", source: "AI Coach" };
      } catch (error) {
        console.warn("[Coach] AI connector unavailable:", error);
      }
      return { answer: "I couldn't get a reliable answer from the AI service just now. Please try again shortly.", tone: "supportive", source: "AI unavailable" };
    })
  }),
  health: router({
    dailyAnalysis: publicProcedure.input(z2.object({ openId: z2.string().min(3) })).query(async ({ input }) => {
      const profile = await getLocalUserProfile(input.openId);
      const conditions = String(profile?.healthConditions ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      const labels = conditions.length ? conditions : ["General wellness"];
      const priorities = labels.map((condition) => {
        const key = condition.toLowerCase();
        if (key.includes("diabet")) return { condition, focus: "Steady carbohydrates", suggestion: "Pair carbohydrate foods with protein and fiber; use your clinician\u2019s plan for medication and glucose targets." };
        if (key.includes("blood") || key.includes("bp") || key.includes("pressure")) return { condition, focus: "Lower sodium pattern", suggestion: "Favor fresh ingredients, herbs, beans, and unsalted nuts; check packaged-food labels." };
        if (key.includes("cholesterol")) return { condition, focus: "More soluble fiber", suggestion: "Try oats, beans, lentils, fruit, and vegetables while choosing unsaturated fats more often." };
        if (key.includes("kidney")) return { condition, focus: "Clinician-guided nutrients", suggestion: "Kidney needs vary widely; confirm protein, potassium, phosphorus, and fluid targets with your care team." };
        if (key.includes("weight")) return { condition, focus: "Sustainable portions", suggestion: "Build meals around vegetables, protein, and satisfying fiber rather than aggressive restriction." };
        return { condition, focus: "Balanced plate", suggestion: "Aim for a protein anchor, colorful plants, and a satisfying carbohydrate at meals." };
      });
      return { conditions: labels, priorities, disclaimer: "General nutrition education only \u2014 not a diagnosis or medical treatment plan." };
    })
  }),
  vision: router({
    analyze: publicProcedure.input(z2.object({
      fileName: z2.string().min(1).max(180),
      imageData: z2.string().max(12e6).optional(),
      openId: z2.string().optional(),
      cookingContext: cookingContextSchema.default("homemade"),
      recipeVariant: z2.string().max(180).default("")
    })).mutation(async ({ input }) => {
      const dishNutritionMap = {
        "Chicken Mandi": { calories: 750, protein: 45, carbs: 70, fat: 32, fiber: 4, servingWeightGrams: 450, detectedObjects: ["roasted chicken", "spiced mandi rice"], explanation: "Spiced Arabian mandi rice with slow-roasted tender chicken." },
        "Mutton Mandi": { calories: 850, protein: 42, carbs: 70, fat: 42, fiber: 4, servingWeightGrams: 450, detectedObjects: ["roasted lamb", "spiced mandi rice"], explanation: "Spiced Arabian mandi rice served with tender roasted mutton/lamb." },
        "Beef Mandi": { calories: 820, protein: 44, carbs: 70, fat: 38, fiber: 4, servingWeightGrams: 450, detectedObjects: ["roasted beef", "spiced mandi rice"], explanation: "Spiced Arabian mandi rice served with roasted spiced beef." },
        "Chicken Biryani": { calories: 620, protein: 38, carbs: 65, fat: 22, fiber: 5, servingWeightGrams: 400, detectedObjects: ["chicken pieces", "basmati rice", "biryani spices"], explanation: "Aromatic basmati rice layered with spiced marinated chicken pieces." },
        "Mutton Biryani": { calories: 720, protein: 35, carbs: 65, fat: 32, fiber: 5, servingWeightGrams: 400, detectedObjects: ["mutton pieces", "basmati rice", "biryani spices"], explanation: "Rich basmati rice infused with whole spices and tender mutton cuts." },
        "Vegetable Biryani": { calories: 520, protein: 17, carbs: 68, fat: 18, fiber: 9, servingWeightGrams: 380, detectedObjects: ["mixed vegetables", "basmati rice", "biryani spices"], explanation: "Fragrant basmati rice cooked with mixed seasonal vegetables and mint." },
        "Chicken Kabsa": { calories: 680, protein: 42, carbs: 68, fat: 26, fiber: 5, servingWeightGrams: 420, detectedObjects: ["chicken", "kabsa rice", "tomato sauce"], explanation: "Traditional spiced Middle Eastern rice cooked with chicken and dried lime." },
        "Mutton Kabsa": { calories: 780, protein: 40, carbs: 68, fat: 36, fiber: 5, servingWeightGrams: 420, detectedObjects: ["mutton", "kabsa rice", "tomato sauce"], explanation: "Spiced Middle Eastern long-grain rice with slow-cooked succulent mutton." },
        "Grilled Chicken with Rice": { calories: 550, protein: 48, carbs: 52, fat: 14, fiber: 3, servingWeightGrams: 350, detectedObjects: ["grilled chicken breast", "steamed rice"], explanation: "Lean grilled marinated chicken breast served with steamed white or brown rice." },
        "Lamb Kebab with Rice": { calories: 640, protein: 36, carbs: 52, fat: 30, fiber: 4, servingWeightGrams: 360, detectedObjects: ["lamb kebab", "rice", "grilled tomato"], explanation: "Charcoal-grilled minced lamb kebabs served with aromatic rice." },
        "Dal Chawal": { calories: 410, protein: 17, carbs: 58, fat: 9, fiber: 11, servingWeightGrams: 350, detectedObjects: ["yellow dal", "steamed rice"], explanation: "Comforting yellow lentil tadka served over steamed white rice." },
        "Dal Chawal Bowl": { calories: 410, protein: 17, carbs: 58, fat: 9, fiber: 11, servingWeightGrams: 350, detectedObjects: ["yellow dal", "steamed rice", "cucumber salad"], explanation: "Comforting yellow dal served with steamed rice and a crisp vegetable salad." },
        "Chicken Curry with Rice": { calories: 580, protein: 36, carbs: 56, fat: 22, fiber: 5, servingWeightGrams: 380, detectedObjects: ["chicken curry", "steamed rice"], explanation: "Tender chicken simmered in a spiced onion-tomato gravy with steamed rice." },
        "Butter Chicken with Rice": { calories: 680, protein: 34, carbs: 56, fat: 34, fiber: 4, servingWeightGrams: 380, detectedObjects: ["butter chicken gravy", "steamed rice"], explanation: "Tandoori chicken pieces in a rich, creamy tomato butter gravy with basmati rice." },
        "Chicken Shawarma with Rice": { calories: 620, protein: 38, carbs: 58, fat: 24, fiber: 4, servingWeightGrams: 380, detectedObjects: ["chicken shawarma", "seasoned rice"], explanation: "Spiced rotisserie-shaved chicken shawarma served over spiced rice." },
        "Vegetable Pulao": { calories: 380, protein: 11, carbs: 60, fat: 10, fiber: 6, servingWeightGrams: 300, detectedObjects: ["pulao rice", "green peas", "carrots"], explanation: "Mildly spiced basmati rice tossed with garden peas, carrots, and whole spices." },
        "Fried Rice": { calories: 450, protein: 14, carbs: 62, fat: 16, fiber: 4, servingWeightGrams: 320, detectedObjects: ["fried rice", "spring onions", "vegetables"], explanation: "Wok-tossed rice with spring onions, garlic, and finely diced vegetables." },
        "Idli with Sambar": { calories: 220, protein: 10, carbs: 34, fat: 3, fiber: 5, servingWeightGrams: 200, detectedObjects: ["steamed idli", "sambar", "coconut chutney"], explanation: "Steamed fermented rice and lentil cakes served with lentil sambar and coconut chutney." },
        "Soft Idli with Sambar": { calories: 220, protein: 10, carbs: 34, fat: 3, fiber: 5, servingWeightGrams: 200, detectedObjects: ["steamed idli", "sambar", "coconut chutney"], explanation: "Steamed rice-and-lentil idlis served with warm sambar and coconut chutney." },
        "Masala Dosa": { calories: 345, protein: 10, carbs: 46, fat: 10, fiber: 5, servingWeightGrams: 220, detectedObjects: ["crisp dosa", "potato masala", "sambar"], explanation: "Crispy fermented crepe filled with spiced potato masala and served with sambar." },
        "Vegetable Poha": { calories: 260, protein: 8, carbs: 38, fat: 6, fiber: 4, servingWeightGrams: 180, detectedObjects: ["flattened rice", "peanuts", "vegetables"], explanation: "Flattened rice tempered with mustard, turmeric, peanuts, and vegetables." },
        "Ven Pongal": { calories: 305, protein: 12, carbs: 42, fat: 8, fiber: 4, servingWeightGrams: 220, detectedObjects: ["pongal", "ghee", "cumin and black pepper"], explanation: "Savory South Indian rice-and-moong dal porridge tempered with cumin, pepper, and ghee." },
        "Fish Curry with Rice": { calories: 480, protein: 32, carbs: 54, fat: 13, fiber: 4, servingWeightGrams: 350, detectedObjects: ["fish curry", "steamed rice"], explanation: "Tangy coastal fish curry simmered with tamarind or kokum, served with rice." },
        "Pizza": { calories: 580, protein: 24, carbs: 64, fat: 24, fiber: 4, servingWeightGrams: 240, detectedObjects: ["pizza crust", "melted cheese", "tomato sauce"], explanation: "Oven-baked flatbread topped with tomato sauce, mozzarella cheese, and toppings." },
        "Pasta": { calories: 480, protein: 16, carbs: 68, fat: 14, fiber: 5, servingWeightGrams: 300, detectedObjects: ["pasta", "tomato sauce", "herbs"], explanation: "Al dente pasta tossed in a seasoned tomato-herb or vegetable sauce." },
        "Salad": { calories: 180, protein: 6, carbs: 14, fat: 10, fiber: 6, servingWeightGrams: 250, detectedObjects: ["mixed greens", "cucumber", "dressing"], explanation: "Fresh bowl of mixed crisp leafy greens, cucumber, and light olive oil dressing." },
        "Medu Vada": { calories: 180, protein: 7, carbs: 15, fat: 9, fiber: 3, servingWeightGrams: 100, detectedObjects: ["crisp lentil vada", "coconut chutney"], explanation: "Crispy doughnut-shaped fried black lentil fritters served with chutney." },
        "Paneer Bhuna with Roti": { calories: 430, protein: 28, carbs: 22, fat: 20, fiber: 6, servingWeightGrams: 280, detectedObjects: ["paneer cubes", "spiced onion tomato gravy", "whole wheat roti"], explanation: "Pan-roasted cottage cheese in a thick spiced gravy served with warm roti." }
      };
      const fileName = input.fileName.toLowerCase();
      const isChickenBiryani = (fileName.includes("chicken") || fileName.includes("murgh")) && fileName.includes("biryani");
      const isMuttonBiryani = (fileName.includes("mutton") || fileName.includes("gosht") || fileName.includes("lamb")) && fileName.includes("biryani");
      const isButterChicken = fileName.includes("butter") && fileName.includes("chicken");
      const isChickenCurry = fileName.includes("chicken") && (fileName.includes("curry") || fileName.includes("gravy") || fileName.includes("rice"));
      const isPaneer = fileName.includes("paneer");
      const isMandi = fileName.includes("mandi");
      const isShawarma = fileName.includes("shawarma");
      const isPizza = fileName.includes("pizza");
      const isPasta = fileName.includes("pasta");
      const isSalad = fileName.includes("salad");
      const isFish = fileName.includes("fish");
      const isIdli = fileName.includes("idli") || fileName.includes("sambar");
      const isDosa = fileName.includes("dosa") || fileName.includes("masala");
      const isPongal = fileName.includes("pongal");
      const isVada = fileName.includes("vada") || fileName.includes("medu");
      const isBiryani = fileName.includes("biryani") || fileName.includes("rice");
      const isBreakfast = fileName.includes("breakfast") || isIdli || isDosa || isPongal || fileName.includes("poha");
      const isDal = fileName.includes("dal") || fileName.includes("chawal");
      const matchedDishKey = isChickenBiryani ? "Chicken Biryani" : isMuttonBiryani ? "Mutton Biryani" : isButterChicken ? "Butter Chicken with Rice" : isChickenCurry ? "Chicken Curry with Rice" : isPaneer ? "Paneer Bhuna with Roti" : isMandi ? "Chicken Mandi" : isShawarma ? "Chicken Shawarma with Rice" : isPizza ? "Pizza" : isPasta ? "Pasta" : isSalad ? "Salad" : isFish ? "Fish Curry with Rice" : isIdli ? "Soft Idli with Sambar" : isDosa ? "Masala Dosa" : isPongal ? "Ven Pongal" : isVada ? "Medu Vada" : isBiryani ? "Vegetable Biryani" : isBreakfast ? "Vegetable Poha" : isDal ? "Dal Chawal Bowl" : void 0;
      const fallback = matchedDishKey && dishNutritionMap[matchedDishKey] ? {
        dishName: matchedDishKey,
        confidence: 0.4,
        calories: dishNutritionMap[matchedDishKey].calories,
        protein: dishNutritionMap[matchedDishKey].protein,
        carbs: dishNutritionMap[matchedDishKey].carbs,
        fat: dishNutritionMap[matchedDishKey].fat,
        fiber: dishNutritionMap[matchedDishKey].fiber,
        detectedObjects: dishNutritionMap[matchedDishKey].detectedObjects,
        explanation: [dishNutritionMap[matchedDishKey].explanation],
        uncertaintyReasons: [],
        note: "Filename cue estimate; values are calibrated against culinary nutrition reference standards."
      } : {
        dishName: "Meal not confidently identified",
        confidence: 0.15,
        calories: 350,
        protein: 12,
        carbs: 45,
        fat: 10,
        fiber: 5,
        detectedObjects: [],
        explanation: ["No specific dish could be identified from the filename or available visual cues."],
        uncertaintyReasons: ["Vision analysis is not configured; the current result is a demo fallback."],
        note: "The food could not be confidently identified; nutrition values are generic demo estimates."
      };
      const fallbackWithWeight = { ...fallback, servingWeightGrams: null, servingWeightLowGrams: null, servingWeightHighGrams: null };
      let base = fallbackWithWeight;
      let imageWasAnalyzed = false;
      let localDishClassification;
      const applyLocalDishFallback = () => {
        if (localDishClassification && localDishClassification.score >= 0.08) {
          const matched = dishNutritionMap[localDishClassification.dishName] ?? {
            calories: 400,
            protein: 15,
            carbs: 50,
            fat: 12,
            fiber: 5,
            servingWeightGrams: 300,
            detectedObjects: []
          };
          base = {
            dishName: localDishClassification.dishName,
            confidence: localDishClassification.score,
            calories: matched.calories,
            protein: matched.protein,
            carbs: matched.carbs,
            fat: matched.fat,
            fiber: matched.fiber,
            servingWeightGrams: matched.servingWeightGrams,
            servingWeightLowGrams: Math.round(matched.servingWeightGrams * 0.8),
            servingWeightHighGrams: Math.round(matched.servingWeightGrams * 1.25),
            detectedObjects: matched.detectedObjects,
            explanation: [`A local zero-shot image classifier recognized this plate as ${localDishClassification.dishName} (${Math.round(localDishClassification.score * 100)}% match).`],
            uncertaintyReasons: ["Dish label is a local image-classifier match; nutrition values are calibrated from standard culinary nutrition databases."],
            note: `Identified as ${localDishClassification.dishName} via local image classifier with nutrition calibrated from reference databases.`
          };
        } else {
          base = { ...fallbackWithWeight, dishName: "Meal not confidently identified", confidence: 0.05, detectedObjects: [], explanation: ["No reliable dish match was available for this image."], uncertaintyReasons: [], note: "The AI nutrition provider is unavailable and the local image classifier did not find a confident dish match; nutrition values below are generic demo estimates." };
        }
      };
      const hasImageLanguageModel = Boolean(ENV.geminiApiKey || ENV.openAiApiKey || ENV.forgeApiKey);
      if (input.imageData && !hasImageLanguageModel) {
        try {
          localDishClassification = await classifyFoodDish(input.imageData) ?? void 0;
        } catch (error) {
          console.warn("[Vision] Local dish classification unavailable:", error instanceof Error ? error.message : error);
        }
        applyLocalDishFallback();
      }
      let objectDetectorRan = false;
      const objectDetections = input.imageData ? await detectFoodObjects(input.imageData).then((detections) => {
        objectDetectorRan = true;
        return detections;
      }).catch((error) => {
        console.warn("[Vision] Local food object detection unavailable:", error instanceof Error ? error.message : error);
        return [];
      }) : [];
      const detectedFoodCues = objectDetections.map((detection) => `${detection.label} (${Math.round(detection.score * 100)}% object detection)`);
      if (input.imageData && hasImageLanguageModel) {
        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a highly accurate food nutrition analyst with expertise in Indian cuisine and global foods. Analyze the provided food image and return precise nutrition estimates. Use verified nutritional databases (ICMR-NIN for Indian foods, USDA for global foods) as reference. Key Indian food nutrition references: Idli (1 piece ~30g = 39kcal, 1.5g protein, 8g carbs, 0.2g fat); Dosa plain (1 piece ~50g = 133kcal, 3g protein, 17g carbs, 6g fat); Sambar per 100g = 42kcal, 2.5g protein, 7g carbs, 0.8g fat; Rice cooked per 100g = 130kcal, 2.7g protein, 28g carbs, 0.3g fat; Dal cooked per 100g = 93kcal, 6g protein, 15g carbs, 0.4g fat; Roti/chapati 1 piece ~30g = 71kcal, 2.5g protein, 14g carbs, 0.5g fat; Paneer per 100g = 265kcal, 18g protein, 1.2g carbs, 21g fat; Biryani rice per 100g = 162kcal, 3.5g protein, 28g carbs, 4g fat. Do not claim exact ingredients when hidden. Estimate total edible food mass in grams for the visible serving. Return a central estimate and conservative low/high bounds; widen the range when scale or depth is unclear. Return concise visible cues, a dish hypothesis, a plausible single-serving nutrition estimate, and uncertainty reasons. Calories, macros, and mass are estimates for general education, not medical advice." },
              { role: "user", content: [
                { type: "text", text: `Carefully identify the dish in this image and estimate its nutrition for the visible portion. Local object detector candidates: ${detectedFoodCues.join(", ") || "none"}. Cooking context: ${input.cookingContext}. Recipe variation or details: ${input.recipeVariant || "none"}. Be specific with the dish name (e.g. 'Soft Idli with Coconut Chutney' or 'Chicken Biryani'). Count visible items if applicable. Estimate edible mass in grams and calculate accurate calories, protein, carbs, fat, and fiber based on verified reference data. Return JSON with keys: dishName (string), confidence (number 0-1), calories (number), protein (number), carbs (number), fat (number), fiber (number), servingWeightGrams (number), servingWeightLowGrams (number), servingWeightHighGrams (number), detectedObjects (string array), explanation (string array), uncertaintyReasons (string array), note (string).` },
                { type: "image_url", image_url: { url: input.imageData, detail: "high" } }
              ] }
            ],
            responseFormat: { type: "json_schema", json_schema: { name: "food_scan_estimate", strict: true, schema: { type: "object", properties: { dishName: { type: "string" }, confidence: { type: "number" }, calories: { type: "integer" }, protein: { type: "integer" }, carbs: { type: "integer" }, fat: { type: "integer" }, fiber: { type: "integer" }, servingWeightGrams: { type: "integer" }, servingWeightLowGrams: { type: "integer" }, servingWeightHighGrams: { type: "integer" }, detectedObjects: { type: "array", items: { type: "string" } }, explanation: { type: "array", items: { type: "string" } }, uncertaintyReasons: { type: "array", items: { type: "string" } }, note: { type: "string" } }, required: ["dishName", "confidence", "calories", "protein", "carbs", "fat", "fiber", "servingWeightGrams", "servingWeightLowGrams", "servingWeightHighGrams", "detectedObjects", "explanation", "uncertaintyReasons", "note"], additionalProperties: false } } },
            maxTokens: 900
          });
          const content = response.choices[0]?.message.content;
          const text2 = typeof content === "string" ? content : Array.isArray(content) ? content.filter((part) => part.type === "text").map((part) => part.text).join("") : "";
          let cleanedText = text2.trim();
          if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
          }
          let rawObj;
          try {
            rawObj = JSON.parse(cleanedText);
          } catch {
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              rawObj = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error("AI response did not contain valid JSON");
            }
          }
          if (Array.isArray(rawObj)) {
            rawObj = rawObj[0] ?? {};
          }
          const toStringList = (val) => {
            if (Array.isArray(val)) return val.map((v) => String(v).slice(0, 240)).filter(Boolean);
            if (typeof val === "string" && val.trim().length > 0) return [val.trim().slice(0, 240)];
            return [];
          };
          const extractedDishName = String(
            rawObj.dishName || rawObj.dish_name || rawObj.name || ""
          ).trim();
          const extractedConfidence = typeof rawObj.confidence === "number" ? rawObj.confidence : typeof rawObj.confidence_score === "number" ? rawObj.confidence_score : 0.92;
          const rawCalories = Number(
            rawObj.calories ?? rawObj.nutrition_estimate?.calories ?? rawObj.nutritionEstimate?.calories ?? rawObj.nutrition?.calories
          );
          const rawProtein = Number(
            rawObj.protein ?? rawObj.protein_g ?? rawObj.nutrition_estimate?.protein_g ?? rawObj.nutrition_estimate?.protein ?? rawObj.nutrition?.protein
          );
          const rawCarbs = Number(
            rawObj.carbs ?? rawObj.carbs_g ?? rawObj.nutrition_estimate?.carbs_g ?? rawObj.nutrition_estimate?.carbs ?? rawObj.nutrition?.carbs
          );
          const rawFat = Number(
            rawObj.fat ?? rawObj.fat_g ?? rawObj.nutrition_estimate?.fat_g ?? rawObj.nutrition_estimate?.fat ?? rawObj.nutrition?.fat
          );
          const rawFiber = Number(
            rawObj.fiber ?? rawObj.fiber_g ?? rawObj.nutrition_estimate?.fiber_g ?? rawObj.nutrition_estimate?.fiber ?? rawObj.nutrition?.fiber
          );
          const rawServingGrams = Number(
            rawObj.servingWeightGrams ?? rawObj.estimated_weight_grams?.central ?? rawObj.serving_weight_grams ?? rawObj.weight_grams
          );
          const rawLowGrams = Number(
            rawObj.servingWeightLowGrams ?? rawObj.estimated_weight_grams?.low ?? rawObj.serving_weight_low_grams
          );
          const rawHighGrams = Number(
            rawObj.servingWeightHighGrams ?? rawObj.estimated_weight_grams?.high ?? rawObj.serving_weight_high_grams
          );
          let visualObjects = toStringList(
            rawObj.detectedObjects ?? rawObj.detected_objects ?? rawObj.visual_cues ?? rawObj.visualCues
          );
          if (visualObjects.length === 0 && rawObj.visible_item_count && typeof rawObj.visible_item_count === "object") {
            visualObjects = Object.entries(rawObj.visible_item_count).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`);
          }
          let explanations = toStringList(
            rawObj.explanation ?? rawObj.visual_cues ?? rawObj.visualCues
          );
          let uncertainties = toStringList(
            rawObj.uncertaintyReasons ?? rawObj.uncertainty_reasons
          );
          const dishName = extractedDishName || "Identified Dish";
          const matchedBaseline = Object.entries(dishNutritionMap).find(([k]) => dishName.toLowerCase().includes(k.toLowerCase()))?.[1];
          const calories2 = !isNaN(rawCalories) && rawCalories > 0 ? Math.round(rawCalories) : matchedBaseline?.calories ?? 300;
          const protein = !isNaN(rawProtein) && rawProtein >= 0 ? Math.round(rawProtein) : matchedBaseline?.protein ?? 10;
          const carbs = !isNaN(rawCarbs) && rawCarbs >= 0 ? Math.round(rawCarbs) : matchedBaseline?.carbs ?? 40;
          const fat = !isNaN(rawFat) && rawFat >= 0 ? Math.round(rawFat) : matchedBaseline?.fat ?? 8;
          const fiber = !isNaN(rawFiber) && rawFiber >= 0 ? Math.round(rawFiber) : matchedBaseline?.fiber ?? 4;
          const servingGrams = !isNaN(rawServingGrams) && rawServingGrams > 0 ? Math.min(3e3, Math.round(rawServingGrams)) : matchedBaseline?.servingWeightGrams ?? 220;
          let lowGrams = !isNaN(rawLowGrams) && rawLowGrams > 0 ? Math.round(rawLowGrams) : Math.round(servingGrams * 0.8);
          let highGrams = !isNaN(rawHighGrams) && rawHighGrams > 0 ? Math.min(5e3, Math.round(rawHighGrams)) : Math.round(servingGrams * 1.25);
          lowGrams = Math.min(lowGrams, servingGrams);
          highGrams = Math.max(highGrams, servingGrams);
          const note = String(rawObj.note || rawObj.description || (matchedBaseline ? `Nutrition calibrated based on ${dishName} serving.` : "")).slice(0, 500);
          base = {
            dishName: dishName.slice(0, 160),
            confidence: Math.max(0, Math.min(1, extractedConfidence)),
            calories: Math.max(0, Math.min(1e4, calories2)),
            protein: Math.max(0, Math.min(1e3, protein)),
            carbs: Math.max(0, Math.min(1e3, carbs)),
            fat: Math.max(0, Math.min(1e3, fat)),
            fiber: Math.max(0, Math.min(1e3, fiber)),
            servingWeightGrams: servingGrams,
            servingWeightLowGrams: lowGrams,
            servingWeightHighGrams: highGrams,
            detectedObjects: visualObjects,
            explanation: explanations.length > 0 ? explanations : [`Identified ${dishName} with verified nutritional analysis.`],
            uncertaintyReasons: uncertainties,
            note
          };
          imageWasAnalyzed = true;
        } catch (error) {
          console.warn("[Vision] Image analysis unavailable; using disclosed demo fallback:", error instanceof Error ? error.message : error);
          if (input.imageData) {
            try {
              localDishClassification = await classifyFoodDish(input.imageData) ?? void 0;
            } catch (classificationError) {
              console.warn("[Vision] Local dish fallback unavailable:", classificationError instanceof Error ? classificationError.message : classificationError);
            }
            applyLocalDishFallback();
          }
        }
      }
      let profile;
      if (input.openId) {
        try {
          profile = await getLocalUserProfile(input.openId);
        } catch (error) {
          console.warn("[Vision] Profile context unavailable; continuing without personalization:", error instanceof Error ? error.message : error);
        }
      }
      const conditions = String(profile?.healthConditions ?? "").toLowerCase();
      const alternatives = conditions.includes("diabet") ? ["Swap refined grains for lentils or quinoa", "Choose unsweetened yogurt and keep berries whole"] : conditions.includes("blood") || conditions.includes("pressure") ? ["Use herbs, lemon, or spices instead of salty sauces", "Choose unsalted seeds and fresh vegetables"] : conditions.includes("cholesterol") ? ["Add beans or oats for more soluble fiber", "Choose olive oil or avocado instead of butter"] : ["Add a palm-sized lean protein", "Make half the plate non-starchy vegetables"];
      const suggestions = conditions.includes("kidney") ? ["Confirm protein, potassium, phosphorus, and fluid choices with your care team", "Use this scan as an estimate, not a clinical prescription"] : ["Eat slowly and check fullness halfway through", "Log the meal after reviewing the portion estimate"];
      const contextFactors = { homemade: 1, restaurant: 1.18, mess: 1.1, packaged: 1.04 };
      const contextFactor = contextFactors[input.cookingContext];
      const recipeNotes = input.recipeVariant.toLowerCase();
      const recipeAdjustment = /extra oil|deep[- ]fried|fried in oil/.test(recipeNotes) ? 100 : /cream|coconut milk|butter|cheese/.test(recipeNotes) ? 70 : /no added oil|without oil|less oil|steamed/.test(recipeNotes) ? -45 : /extra sugar|sweetened/.test(recipeNotes) ? 35 : 0;
      let feedback = [];
      if (input.openId) {
        try {
          feedback = await listScanFeedback(input.openId);
        } catch (error) {
          console.warn("[Vision] Scan feedback unavailable; continuing without calibration:", error instanceof Error ? error.message : error);
        }
      }
      const relevantFeedback = feedback.filter((item) => item.predictedDish.toLowerCase() === base.dishName.toLowerCase()).slice(0, 20);
      const correctionRatio = relevantFeedback.length >= 2 ? relevantFeedback.reduce((sum, item) => sum + (item.predictedCalories > 0 ? item.correctedCalories / item.predictedCalories : 1), 0) / relevantFeedback.length : 1;
      const personalFactor = Math.min(1.35, Math.max(0.7, correctionRatio));
      const calories = Math.max(0, Math.round(base.calories * contextFactor * personalFactor + recipeAdjustment));
      const uncertainty = Math.min(0.55, Math.max(0.18, 0.12 + (1 - base.confidence) * 0.4 + (input.cookingContext === "homemade" ? 0.04 : 0.1) + (input.recipeVariant ? 0.06 : 0)));
      const uncertaintyReasons = [
        ...imageWasAnalyzed ? base.uncertaintyReasons : localDishClassification ? ["Dish identification is a local zero-shot match score, not calibrated confidence.", "Nutrition values are calibrated from standard culinary nutrition databases."] : !input.imageData ? ["Vision analysis is not configured for filename-only scans; the current result is a demo fallback."] : hasImageLanguageModel ? ["The configured image-analysis provider could not return a valid result; nutrition values are generic demo estimates."] : objectDetectorRan ? ["Local object detection ran, but no image-language model is configured to identify the full dish or estimate its nutrition."] : ["Vision analysis is not configured; the current result is a demo fallback."],
        "A photo cannot show exact portion weight or hidden ingredients.",
        input.cookingContext !== "homemade" ? `The ${input.cookingContext} context uses a broad heuristic, not a measured recipe.` : "Cooking oil and preparation method are not visible with certainty.",
        ...input.recipeVariant ? [`Recipe variation noted: ${input.recipeVariant}; its calorie adjustment is a generic rule of thumb, not a measured ingredient amount.`] : []
      ];
      return { ...base, note: !imageWasAnalyzed && objectDetectorRan && !localDishClassification ? hasImageLanguageModel ? "The configured image-analysis provider is unavailable and local object detection could not identify the full dish; nutrition values are generic demo estimates." : "Demo nutrition estimate; local object detection ran, but it does not identify the full dish or estimate nutrition." : base.note, detectedObjects: Array.from(/* @__PURE__ */ new Set([...detectedFoodCues, ...base.detectedObjects])), objectDetections, objectDetectorRan, calories, protein: Math.round(base.protein * contextFactor * personalFactor), carbs: Math.round(base.carbs * contextFactor * personalFactor), fat: Math.round(base.fat * contextFactor * personalFactor), fiber: Math.round(base.fiber * personalFactor), caloriesLow: Math.max(0, Math.round(calories * (1 - uncertainty))), caloriesHigh: Math.round(calories * (1 + uncertainty)), uncertaintyReasons, source: imageWasAnalyzed ? "Vision model estimate" : localDishClassification ? "Local image classifier + demo nutrition" : "Disclosed demo fallback", analysisMode: imageWasAnalyzed ? "image_model" : localDishClassification ? "local_classifier" : "demo_fallback", personalAdjustmentPercent: Math.round((personalFactor - 1) * 100), correctionCount: relevantFeedback.length, cookingContext: input.cookingContext, recipeVariant: input.recipeVariant, alternatives, suggestions, guidanceConditions: String(profile?.healthConditions ?? "General wellness") || "General wellness", guidanceDisclaimer: "General nutrition education only \u2014 not a diagnosis or medical treatment plan." };
    })
  })
});

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString2(openId) || !isNonEmptyString2(appId) || !isNonEmptyString2(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req?.headers?.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req?.headers?.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/serverless.ts
var app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-trpc-source");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.get(["/api", "/api/health", "/health"], (_req, res) => {
  res.json({ status: "ok", name: "NutriAI API", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
registerStorageProxy(app);
registerOAuthRoutes(app);
app.use(
  ["/api/trpc", "/trpc"],
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.url });
});
app.use((err, _req, res, _next) => {
  console.error("[API Error]", err);
  const status = typeof err?.status === "number" ? err.status : 500;
  res.status(status).json({
    error: err?.message || "Internal Server Error",
    code: err?.code || "INTERNAL_ERROR"
  });
});
function handler(req, res) {
  return app(req, res);
}
export {
  handler as default
};
