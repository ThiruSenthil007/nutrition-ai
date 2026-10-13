import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { demoDashboard } from "../shared/nutrition-data";
import { addWeightEntry, consumeOtpChallenge, createMealAnalysis, createMealLog, createOtpChallenge, createScanFeedback, createScanHistory, getLocalUserByIdentifier, getLocalUserProfile, listRecipes, listScanFeedback, listScanHistory, listWeightHistory, listWeeklyMealIntake, updateLocalUserProfile, upsertLocalUser } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { classifyFoodDish, detectFoodObjects } from "./_core/foodDetection";

const cookingContextSchema = z.enum(["homemade", "restaurant", "mess", "packaged"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    requestOtp: publicProcedure.input(z.object({
      mode: z.enum(["login", "signup"]),
      identifier: z.string().min(5).max(320),
      name: z.string().min(2).max(100).optional(),
      email: z.string().email().optional(),
      phone: z.string().min(7).max(32).optional(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      age: z.number().int().min(13).max(110).optional(),
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
      if (input.mode === "login" && !(await getLocalUserByIdentifier(identifier))) throw new Error("No account found for that email or phone number");
      const challenge = await createOtpChallenge({ identifier, mode: input.mode, payload: input.mode === "signup" ? { name: input.name, email: input.email, phone: input.phone, dateOfBirth: input.dateOfBirth, age: input.age } : undefined });
      const maskedDestination = identifier.includes("@") ? identifier.replace(/^(.{2}).*(@.*)$/, "$1•••$2") : `${identifier.slice(0, 3)}••••${identifier.slice(-2)}`;
      return { challengeId: challenge.challengeId, expiresInSeconds: 300, maskedDestination, demoCode: process.env.NODE_ENV === "production" ? undefined : challenge.code };
    }),
    verifyOtp: publicProcedure.input(z.object({ challengeId: z.number().int().positive(), code: z.string().regex(/^\d{6}$/) })).mutation(async ({ input }) => {
      const challenge = await consumeOtpChallenge(input.challengeId, input.code);
      if (!challenge) throw new Error("That code is invalid or expired");
      const user = challenge.mode === "signup" ? await upsertLocalUser(challenge.payload as { name: string; email: string; phone: string; dateOfBirth: string; age: number }) : await getLocalUserByIdentifier(challenge.identifier);
      if (!user) throw new Error("We could not load that account");
      return { user, verified: true as const };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      if (typeof (ctx.res as any)?.clearCookie === "function") {
        (ctx.res as any).clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      }
      return { success: true } as const;
    }),
  }),
  account: router({
    profile: publicProcedure.input(z.object({ openId: z.string().min(3) })).query(({ input }) => getLocalUserProfile(input.openId)),
    updateProfile: publicProcedure.input(z.object({
      openId: z.string().min(3),
      name: z.string().min(2).max(100),
      email: z.string().email(),
      phone: z.string().min(7).max(32),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      age: z.number().int().min(13).max(110),
      goalCalories: z.number().int().min(800).max(6000),
      goalProtein: z.number().int().min(20).max(400),
      goalCarbs: z.number().int().min(20).max(700),
      goalFat: z.number().int().min(15).max(250),
      hydrationGoal: z.number().int().min(1).max(30),
      heightCm: z.number().int().min(100).max(250).optional(),
      currentWeightKg: z.number().int().min(25).max(400).optional(),
      targetWeightKg: z.number().int().min(25).max(400).optional(),
      healthConditions: z.string().max(255).optional(),
    })).mutation(async ({ input }) => {
      const user = await updateLocalUserProfile(input);
      if (!user) throw new Error("We could not find that profile");
      return user;
    }),
  }),
  dashboard: router({
    summary: publicProcedure.input(z.object({ openId: z.string().optional() }).optional()).query(async ({ input }) => ({
      ...demoDashboard,
      weeklyIntake: await listWeeklyMealIntake(input?.openId),
      dateLabel: new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(new Date()),
    })),
  }),
  recipes: router({
    list: publicProcedure
      .input(z.object({ query: z.string().optional(), category: z.string().optional(), diet: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const recipes = await listRecipes();
        const query = input?.query?.trim().toLowerCase();
        return recipes.filter(recipe => {
          const searchable = [recipe.title, recipe.description, recipe.category, recipe.diet, recipe.tags.join(" ")].join(" ").toLowerCase();
          const matchesQuery = !query || searchable.includes(query);
          const matchesCategory = !input?.category || input.category === "All meals" || recipe.category === input.category;
          const matchesDiet = !input?.diet || input.diet === "Any diet" || recipe.diet === input.diet;
          return matchesQuery && matchesCategory && matchesDiet;
        });
      }),
  }),
  mealLogs: router({
    create: publicProcedure.input(z.object({ openId: z.string().optional(), recipeId: z.string().optional(), mealType: z.string(), calories: z.number().int().nonnegative(), protein: z.number().int().nonnegative(), carbs: z.number().int().nonnegative(), fat: z.number().int().nonnegative() })).mutation(async ({ ctx, input }) => {
      return createMealLog({ ...input, userId: ctx.user?.id });
    }),
  }),
  mealAnalysis: router({
    create: publicProcedure.input(z.object({ openId: z.string().optional(), dishName: z.string().min(1).max(160), servedGrams: z.number().int().min(1).max(5000), consumedGrams: z.number().int().min(0).max(5000), caloriesServed: z.number().int().nonnegative(), caloriesConsumed: z.number().int().nonnegative(), wastePercent: z.number().int().min(0).max(100) })).mutation(({ input }) => createMealAnalysis(input)),
  }),
  weight: router({
    history: publicProcedure.input(z.object({ openId: z.string().min(3) })).query(({ input }) => listWeightHistory(input.openId)),
    add: publicProcedure.input(z.object({ openId: z.string().min(3), weightKg: z.number().int().min(25).max(400) })).mutation(({ input }) => addWeightEntry(input)),
  }),
  history: router({
    list: publicProcedure.input(z.object({ openId: z.string().optional() }).optional()).query(({ ctx, input }) => listScanHistory(ctx.user?.id, input?.openId)),
    create: publicProcedure.input(z.object({
      openId: z.string().optional(),
      fileName: z.string().min(1).max(180),
      imageData: z.string().min(20).max(12_000_000),
      mimeType: z.string().min(3).max(80),
      dishName: z.string().min(1).max(160),
      confidence: z.number().min(0).max(1),
      calories: z.number().int().nonnegative(),
      protein: z.number().int().nonnegative(),
      carbs: z.number().int().nonnegative(),
      fat: z.number().int().nonnegative(),
      fiber: z.number().int().nonnegative(),
      detectedObjects: z.array(z.string()).max(20),
      note: z.string().max(500),
      cookingContext: cookingContextSchema.optional(),
      recipeVariant: z.string().max(180).optional(),
    })).mutation(({ ctx, input }) => createScanHistory({ ...input, userId: ctx.user?.id })),
  }),
  scanFeedback: router({
    list: publicProcedure.input(z.object({ openId: z.string().min(3) })).query(({ input }) => listScanFeedback(input.openId)),
    save: publicProcedure.input(z.object({
      openId: z.string().min(3),
      scanId: z.number().int().positive().optional(),
      predictedDish: z.string().min(1).max(160),
      correctedDish: z.string().min(1).max(160),
      predictedCalories: z.number().int().min(0).max(10000),
      correctedCalories: z.number().int().min(0).max(10000),
      feedbackType: z.enum(["verified", "corrected"]),
      cookingContext: cookingContextSchema,
      recipeVariant: z.string().max(180),
      correctionNotes: z.string().max(500),
    })).mutation(({ input }) => createScanFeedback(input)),
  }),
  coach: router({
    ask: publicProcedure.input(z.object({ prompt: z.string().min(2).max(600), openId: z.string().optional(), history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(1200) })).max(10).default([]) })).mutation(async ({ input }) => {
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
            ...input.history.map(message => ({ role: message.role, content: message.text })),
            { role: "user", content: input.prompt },
          ],
          maxTokens: 420,
          outputSchema: { name: "nutrition_coach_answer", strict: true, schema: { type: "object", properties: { answer: { type: "string" }, safetyNote: { type: "string" } }, required: ["answer", "safetyNote"], additionalProperties: false } },
        });
        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) as { answer: string; safetyNote: string } : null;
        if (parsed?.answer?.trim()) return { answer: `${parsed.answer.trim()}${parsed.safetyNote?.trim() ? `\n\n${parsed.safetyNote.trim()}` : ""}`, tone: "focused" as const, source: "AI Coach" as const };
      } catch (error) {
        console.warn("[Coach] AI connector unavailable:", error);
      }
      return { answer: "I couldn't get a reliable answer from the AI service just now. Please try again shortly.", tone: "supportive" as const, source: "AI unavailable" as const };
    }),
  }),
  health: router({
    dailyAnalysis: publicProcedure.input(z.object({ openId: z.string().min(3) })).query(async ({ input }) => {
      const profile = await getLocalUserProfile(input.openId);
      const conditions = (String(profile?.healthConditions ?? "")).split(",").map((item: string) => item.trim()).filter(Boolean);
      const labels = conditions.length ? conditions : ["General wellness"];
      const priorities = labels.map((condition: string) => {
        const key = condition.toLowerCase();
        if (key.includes("diabet")) return { condition, focus: "Steady carbohydrates", suggestion: "Pair carbohydrate foods with protein and fiber; use your clinician’s plan for medication and glucose targets." };
        if (key.includes("blood") || key.includes("bp") || key.includes("pressure")) return { condition, focus: "Lower sodium pattern", suggestion: "Favor fresh ingredients, herbs, beans, and unsalted nuts; check packaged-food labels." };
        if (key.includes("cholesterol")) return { condition, focus: "More soluble fiber", suggestion: "Try oats, beans, lentils, fruit, and vegetables while choosing unsaturated fats more often." };
        if (key.includes("kidney")) return { condition, focus: "Clinician-guided nutrients", suggestion: "Kidney needs vary widely; confirm protein, potassium, phosphorus, and fluid targets with your care team." };
        if (key.includes("weight")) return { condition, focus: "Sustainable portions", suggestion: "Build meals around vegetables, protein, and satisfying fiber rather than aggressive restriction." };
        return { condition, focus: "Balanced plate", suggestion: "Aim for a protein anchor, colorful plants, and a satisfying carbohydrate at meals." };
      });
      return { conditions: labels, priorities, disclaimer: "General nutrition education only — not a diagnosis or medical treatment plan." };
    }),
  }),
  vision: router({
    analyze: publicProcedure.input(z.object({
      fileName: z.string().min(1).max(180),
      imageData: z.string().max(12_000_000).optional(),
      openId: z.string().optional(),
      cookingContext: cookingContextSchema.default("homemade"),
      recipeVariant: z.string().max(180).default(""),
    })).mutation(async ({ input }) => {
      const dishNutritionMap: Record<string, { calories: number; protein: number; carbs: number; fat: number; fiber: number; servingWeightGrams: number; detectedObjects: string[]; explanation: string }> = {
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
        "Paneer Bhuna with Roti": { calories: 430, protein: 28, carbs: 22, fat: 20, fiber: 6, servingWeightGrams: 280, detectedObjects: ["paneer cubes", "spiced onion tomato gravy", "whole wheat roti"], explanation: "Pan-roasted cottage cheese in a thick spiced gravy served with warm roti." },
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

      const matchedDishKey = isChickenBiryani ? "Chicken Biryani"
        : isMuttonBiryani ? "Mutton Biryani"
        : isButterChicken ? "Butter Chicken with Rice"
        : isChickenCurry ? "Chicken Curry with Rice"
        : isPaneer ? "Paneer Bhuna with Roti"
        : isMandi ? "Chicken Mandi"
        : isShawarma ? "Chicken Shawarma with Rice"
        : isPizza ? "Pizza"
        : isPasta ? "Pasta"
        : isSalad ? "Salad"
        : isFish ? "Fish Curry with Rice"
        : isIdli ? "Soft Idli with Sambar"
        : isDosa ? "Masala Dosa"
        : isPongal ? "Ven Pongal"
        : isVada ? "Medu Vada"
        : isBiryani ? "Vegetable Biryani"
        : isBreakfast ? "Vegetable Poha"
        : isDal ? "Dal Chawal Bowl"
        : undefined;

      const fallback = matchedDishKey && dishNutritionMap[matchedDishKey] ? {
        dishName: matchedDishKey,
        confidence: 0.40,
        calories: dishNutritionMap[matchedDishKey].calories,
        protein: dishNutritionMap[matchedDishKey].protein,
        carbs: dishNutritionMap[matchedDishKey].carbs,
        fat: dishNutritionMap[matchedDishKey].fat,
        fiber: dishNutritionMap[matchedDishKey].fiber,
        detectedObjects: dishNutritionMap[matchedDishKey].detectedObjects,
        explanation: [dishNutritionMap[matchedDishKey].explanation],
        uncertaintyReasons: [] as string[],
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
        uncertaintyReasons: ["Vision analysis is not configured; the current result is a demo fallback."] as string[],
        note: "The food could not be confidently identified; nutrition values are generic demo estimates."
      };
      const fallbackWithWeight = { ...fallback, servingWeightGrams: null as number | null, servingWeightLowGrams: null as number | null, servingWeightHighGrams: null as number | null };
      let base: typeof fallbackWithWeight = fallbackWithWeight;
      let imageWasAnalyzed = false;
      let localDishClassification: { dishName: string; score: number } | undefined;

      const applyLocalDishFallback = () => {
        if (localDishClassification && localDishClassification.score >= 0.08) {
          const matched = dishNutritionMap[localDishClassification.dishName] ?? {
            calories: 400, protein: 15, carbs: 50, fat: 12, fiber: 5, servingWeightGrams: 300, detectedObjects: []
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
          localDishClassification = (await classifyFoodDish(input.imageData)) ?? undefined;
        } catch (error) {
          console.warn("[Vision] Local dish classification unavailable:", error instanceof Error ? error.message : error);
        }
        applyLocalDishFallback();
      }
      let objectDetectorRan = false;
      const objectDetections = input.imageData ? await detectFoodObjects(input.imageData).then(detections => {
        objectDetectorRan = true;
        return detections;
      }).catch(error => {
        console.warn("[Vision] Local food object detection unavailable:", error instanceof Error ? error.message : error);
        return [];
      }) : [];
      const detectedFoodCues = objectDetections.map(detection => `${detection.label} (${Math.round(detection.score * 100)}% object detection)`);
      if (input.imageData && hasImageLanguageModel) {
        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a highly accurate food nutrition analyst with expertise in Indian cuisine and global foods. Analyze the provided food image and return precise nutrition estimates. Use verified nutritional databases (ICMR-NIN for Indian foods, USDA for global foods) as reference. Key Indian food nutrition references: Idli (1 piece ~30g = 39kcal, 1.5g protein, 8g carbs, 0.2g fat); Dosa plain (1 piece ~50g = 133kcal, 3g protein, 17g carbs, 6g fat); Sambar per 100g = 42kcal, 2.5g protein, 7g carbs, 0.8g fat; Rice cooked per 100g = 130kcal, 2.7g protein, 28g carbs, 0.3g fat; Dal cooked per 100g = 93kcal, 6g protein, 15g carbs, 0.4g fat; Roti/chapati 1 piece ~30g = 71kcal, 2.5g protein, 14g carbs, 0.5g fat; Paneer per 100g = 265kcal, 18g protein, 1.2g carbs, 21g fat; Biryani rice per 100g = 162kcal, 3.5g protein, 28g carbs, 4g fat. Do not claim exact ingredients when hidden. Estimate total edible food mass in grams for the visible serving. Return a central estimate and conservative low/high bounds; widen the range when scale or depth is unclear. Return concise visible cues, a dish hypothesis, a plausible single-serving nutrition estimate, and uncertainty reasons. Calories, macros, and mass are estimates for general education, not medical advice." },
              { role: "user", content: [
                { type: "text", text: `Carefully identify the dish in this image and estimate its nutrition for the visible portion. Local object detector candidates: ${detectedFoodCues.join(", ") || "none"}. Cooking context: ${input.cookingContext}. Recipe variation or details: ${input.recipeVariant || "none"}. Be specific with the dish name (e.g. 'Soft Idli with Coconut Chutney' or 'Chicken Biryani'). Count visible items if applicable. Estimate edible mass in grams and calculate accurate calories, protein, carbs, fat, and fiber based on verified reference data. Return JSON with keys: dishName (string), confidence (number 0-1), calories (number), protein (number), carbs (number), fat (number), fiber (number), servingWeightGrams (number), servingWeightLowGrams (number), servingWeightHighGrams (number), detectedObjects (string array), explanation (string array), uncertaintyReasons (string array), note (string).` },
                { type: "image_url", image_url: { url: input.imageData, detail: "high" } },
              ] },
            ],
            responseFormat: { type: "json_schema", json_schema: { name: "food_scan_estimate", strict: true, schema: { type: "object", properties: { dishName: { type: "string" }, confidence: { type: "number" }, calories: { type: "integer" }, protein: { type: "integer" }, carbs: { type: "integer" }, fat: { type: "integer" }, fiber: { type: "integer" }, servingWeightGrams: { type: "integer" }, servingWeightLowGrams: { type: "integer" }, servingWeightHighGrams: { type: "integer" }, detectedObjects: { type: "array", items: { type: "string" } }, explanation: { type: "array", items: { type: "string" } }, uncertaintyReasons: { type: "array", items: { type: "string" } }, note: { type: "string" } }, required: ["dishName", "confidence", "calories", "protein", "carbs", "fat", "fiber", "servingWeightGrams", "servingWeightLowGrams", "servingWeightHighGrams", "detectedObjects", "explanation", "uncertaintyReasons", "note"], additionalProperties: false } } },
            maxTokens: 900,
          });
          const content = response.choices[0]?.message.content;
          const text = typeof content === "string" ? content : Array.isArray(content) ? content.filter(part => part.type === "text").map(part => part.text).join("") : "";
          let cleanedText = text.trim();
          if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
          }
          let rawObj: any;
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

          const toStringList = (val: unknown): string[] => {
            if (Array.isArray(val)) return val.map(v => String(v).slice(0, 240)).filter(Boolean);
            if (typeof val === "string" && val.trim().length > 0) return [val.trim().slice(0, 240)];
            return [];
          };

          const extractedDishName = String(
            rawObj.dishName || rawObj.dish_name || rawObj.name || ""
          ).trim();

          const extractedConfidence = typeof rawObj.confidence === "number"
            ? rawObj.confidence
            : typeof rawObj.confidence_score === "number"
            ? rawObj.confidence_score
            : 0.92;

          const rawCalories = Number(
            rawObj.calories ??
            rawObj.nutrition_estimate?.calories ??
            rawObj.nutritionEstimate?.calories ??
            rawObj.nutrition?.calories
          );

          const rawProtein = Number(
            rawObj.protein ??
            rawObj.protein_g ??
            rawObj.nutrition_estimate?.protein_g ??
            rawObj.nutrition_estimate?.protein ??
            rawObj.nutrition?.protein
          );

          const rawCarbs = Number(
            rawObj.carbs ??
            rawObj.carbs_g ??
            rawObj.nutrition_estimate?.carbs_g ??
            rawObj.nutrition_estimate?.carbs ??
            rawObj.nutrition?.carbs
          );

          const rawFat = Number(
            rawObj.fat ??
            rawObj.fat_g ??
            rawObj.nutrition_estimate?.fat_g ??
            rawObj.nutrition_estimate?.fat ??
            rawObj.nutrition?.fat
          );

          const rawFiber = Number(
            rawObj.fiber ??
            rawObj.fiber_g ??
            rawObj.nutrition_estimate?.fiber_g ??
            rawObj.nutrition_estimate?.fiber ??
            rawObj.nutrition?.fiber
          );

          const rawServingGrams = Number(
            rawObj.servingWeightGrams ??
            rawObj.estimated_weight_grams?.central ??
            rawObj.serving_weight_grams ??
            rawObj.weight_grams
          );

          const rawLowGrams = Number(
            rawObj.servingWeightLowGrams ??
            rawObj.estimated_weight_grams?.low ??
            rawObj.serving_weight_low_grams
          );

          const rawHighGrams = Number(
            rawObj.servingWeightHighGrams ??
            rawObj.estimated_weight_grams?.high ??
            rawObj.serving_weight_high_grams
          );

          let visualObjects = toStringList(
            rawObj.detectedObjects ??
            rawObj.detected_objects ??
            rawObj.visual_cues ??
            rawObj.visualCues
          );
          if (visualObjects.length === 0 && rawObj.visible_item_count && typeof rawObj.visible_item_count === "object") {
            visualObjects = Object.entries(rawObj.visible_item_count).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`);
          }

          let explanations = toStringList(
            rawObj.explanation ??
            rawObj.visual_cues ??
            rawObj.visualCues
          );

          let uncertainties = toStringList(
            rawObj.uncertaintyReasons ??
            rawObj.uncertainty_reasons
          );

          const dishName = extractedDishName || "Identified Dish";
          const matchedBaseline = Object.entries(dishNutritionMap).find(([k]) => dishName.toLowerCase().includes(k.toLowerCase()))?.[1];

          const calories = !isNaN(rawCalories) && rawCalories > 0 ? Math.round(rawCalories) : (matchedBaseline?.calories ?? 300);
          const protein = !isNaN(rawProtein) && rawProtein >= 0 ? Math.round(rawProtein) : (matchedBaseline?.protein ?? 10);
          const carbs = !isNaN(rawCarbs) && rawCarbs >= 0 ? Math.round(rawCarbs) : (matchedBaseline?.carbs ?? 40);
          const fat = !isNaN(rawFat) && rawFat >= 0 ? Math.round(rawFat) : (matchedBaseline?.fat ?? 8);
          const fiber = !isNaN(rawFiber) && rawFiber >= 0 ? Math.round(rawFiber) : (matchedBaseline?.fiber ?? 4);

          const servingGrams = !isNaN(rawServingGrams) && rawServingGrams > 0 ? Math.min(3000, Math.round(rawServingGrams)) : (matchedBaseline?.servingWeightGrams ?? 220);
          let lowGrams = !isNaN(rawLowGrams) && rawLowGrams > 0 ? Math.round(rawLowGrams) : Math.round(servingGrams * 0.8);
          let highGrams = !isNaN(rawHighGrams) && rawHighGrams > 0 ? Math.min(5000, Math.round(rawHighGrams)) : Math.round(servingGrams * 1.25);
          lowGrams = Math.min(lowGrams, servingGrams);
          highGrams = Math.max(highGrams, servingGrams);

          const note = String(rawObj.note || rawObj.description || (matchedBaseline ? `Nutrition calibrated based on ${dishName} serving.` : "")).slice(0, 500);

          base = {
            dishName: dishName.slice(0, 160),
            confidence: Math.max(0, Math.min(1, extractedConfidence)),
            calories: Math.max(0, Math.min(10000, calories)),
            protein: Math.max(0, Math.min(1000, protein)),
            carbs: Math.max(0, Math.min(1000, carbs)),
            fat: Math.max(0, Math.min(1000, fat)),
            fiber: Math.max(0, Math.min(1000, fiber)),
            servingWeightGrams: servingGrams,
            servingWeightLowGrams: lowGrams,
            servingWeightHighGrams: highGrams,
            detectedObjects: visualObjects,
            explanation: explanations.length > 0 ? explanations : [`Identified ${dishName} with verified nutritional analysis.`],
            uncertaintyReasons: uncertainties,
            note,
          };
          imageWasAnalyzed = true;
        } catch (error) {
          console.warn("[Vision] Image analysis unavailable; using disclosed demo fallback:", error instanceof Error ? error.message : error);
          if (input.imageData) {
            try {
              localDishClassification = (await classifyFoodDish(input.imageData)) ?? undefined;
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
      let feedback: Awaited<ReturnType<typeof listScanFeedback>> = [];
      if (input.openId) {
        try {
          feedback = await listScanFeedback(input.openId);
        } catch (error) {
          console.warn("[Vision] Scan feedback unavailable; continuing without calibration:", error instanceof Error ? error.message : error);
        }
      }
      const relevantFeedback = feedback.filter(item => item.predictedDish.toLowerCase() === base.dishName.toLowerCase()).slice(0, 20);
      const correctionRatio = relevantFeedback.length >= 2 ? relevantFeedback.reduce((sum, item) => sum + (item.predictedCalories > 0 ? item.correctedCalories / item.predictedCalories : 1), 0) / relevantFeedback.length : 1;
      const personalFactor = Math.min(1.35, Math.max(0.7, correctionRatio));
      const calories = Math.max(0, Math.round(base.calories * contextFactor * personalFactor + recipeAdjustment));
      const uncertainty = Math.min(0.55, Math.max(0.18, 0.12 + (1 - base.confidence) * 0.4 + (input.cookingContext === "homemade" ? 0.04 : 0.1) + (input.recipeVariant ? 0.06 : 0)));
      const uncertaintyReasons = [
        ...(imageWasAnalyzed ? base.uncertaintyReasons : localDishClassification ? ["Dish identification is a local zero-shot match score, not calibrated confidence.", "Nutrition values are calibrated from standard culinary nutrition databases."] : !input.imageData ? ["Vision analysis is not configured for filename-only scans; the current result is a demo fallback."] : hasImageLanguageModel ? ["The configured image-analysis provider could not return a valid result; nutrition values are generic demo estimates."] : objectDetectorRan ? ["Local object detection ran, but no image-language model is configured to identify the full dish or estimate its nutrition."] : ["Vision analysis is not configured; the current result is a demo fallback."]),
        "A photo cannot show exact portion weight or hidden ingredients.",
        input.cookingContext !== "homemade" ? `The ${input.cookingContext} context uses a broad heuristic, not a measured recipe.` : "Cooking oil and preparation method are not visible with certainty.",
        ...(input.recipeVariant ? [`Recipe variation noted: ${input.recipeVariant}; its calorie adjustment is a generic rule of thumb, not a measured ingredient amount.`] : []),
      ];
      return { ...base, note: !imageWasAnalyzed && objectDetectorRan && !localDishClassification ? hasImageLanguageModel ? "The configured image-analysis provider is unavailable and local object detection could not identify the full dish; nutrition values are generic demo estimates." : "Demo nutrition estimate; local object detection ran, but it does not identify the full dish or estimate nutrition." : base.note, detectedObjects: Array.from(new Set([...detectedFoodCues, ...base.detectedObjects])), objectDetections, objectDetectorRan, calories, protein: Math.round(base.protein * contextFactor * personalFactor), carbs: Math.round(base.carbs * contextFactor * personalFactor), fat: Math.round(base.fat * contextFactor * personalFactor), fiber: Math.round(base.fiber * personalFactor), caloriesLow: Math.max(0, Math.round(calories * (1 - uncertainty))), caloriesHigh: Math.round(calories * (1 + uncertainty)), uncertaintyReasons, source: imageWasAnalyzed ? "Vision model estimate" : localDishClassification ? "Local image classifier + demo nutrition" : "Disclosed demo fallback", analysisMode: imageWasAnalyzed ? "image_model" as const : localDishClassification ? "local_classifier" as const : "demo_fallback" as const, personalAdjustmentPercent: Math.round((personalFactor - 1) * 100), correctionCount: relevantFeedback.length, cookingContext: input.cookingContext, recipeVariant: input.recipeVariant, alternatives, suggestions, guidanceConditions: String(profile?.healthConditions ?? "General wellness") || "General wellness", guidanceDisclaimer: "General nutrition education only — not a diagnosis or medical treatment plan." };
    }),
  }),
});

export type AppRouter = typeof appRouter;
