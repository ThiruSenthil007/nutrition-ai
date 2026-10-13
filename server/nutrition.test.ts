import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const ctx: TrpcContext = {
  user: null,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("nutrition procedures", () => {
  it("filters recipes by diet", async () => {
    const caller = appRouter.createCaller(ctx);
    const recipes = await caller.recipes.list({ diet: "Vegan" });
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes.every(recipe => recipe.diet === "Vegan")).toBe(true);
  });

  it("does not substitute generic advice when the AI provider is unavailable", async () => {
    const origKey = ENV.geminiApiKey;
    ENV.geminiApiKey = "";
    try {
      const caller = appRouter.createCaller(ctx);
      const result = await caller.coach.ask({ prompt: "How can I get more protein?" });
      expect(result.source).toBe("AI unavailable");
      expect(result.answer).toContain("reliable answer");
    } finally {
      ENV.geminiApiKey = origKey;
    }
  });

  it("answers when a saved profile cannot be loaded", async () => {
    const origKey = ENV.geminiApiKey;
    ENV.geminiApiKey = "";
    try {
      const caller = appRouter.createCaller(ctx);
      const result = await caller.coach.ask({ prompt: "What should I eat next?", openId: "coach-missing-profile" });
      expect(result.source).toBe("AI unavailable");
      expect(result.answer).toContain("reliable answer");
    } finally {
      ENV.geminiApiKey = origKey;
    }
  });

  it("does not invent a dinner answer when AI is unavailable", async () => {
    const origKey = ENV.geminiApiKey;
    ENV.geminiApiKey = "";
    try {
      const caller = appRouter.createCaller(ctx);
      const result = await caller.coach.ask({ prompt: "I want dinner food" });
      expect(result.source).toBe("AI unavailable");
      expect(result.answer).toContain("reliable answer");
    } finally {
      ENV.geminiApiKey = origKey;
    }
  });

  it("uses the live AI coach when AI provider is configured", async () => {
    if (!ENV.geminiApiKey) return;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.coach.ask({ prompt: "Suggest a healthy Indian breakfast." });
    expect(result.source).toBe("AI Coach");
    expect(result.answer.length).toBeGreaterThan(10);
  });

  it("discloses the demo fallback and returns an uncertainty range for an Indian food image", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.vision.analyze({ fileName: "masala-dosa.jpg" });
    expect(result.dishName).toBe("Masala Dosa");
    expect(result.analysisMode).toBe("demo_fallback");
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.servingWeightGrams).toBeNull();
    expect(result.servingWeightLowGrams).toBeNull();
    expect(result.servingWeightHighGrams).toBeNull();
    expect(result.caloriesLow).toBeLessThan(result.calories);
    expect(result.caloriesHigh).toBeGreaterThan(result.calories);
    expect(result.detectedObjects.some(cue => cue.toLowerCase().includes("dosa") || cue.toLowerCase().includes("sambar") || cue.toLowerCase().includes("potato"))).toBe(true);
    expect(result.uncertaintyReasons[0]).toContain("Vision analysis is not configured");
  });

  it("completes a scan when optional profile data is unavailable", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.vision.analyze({ fileName: "meal.jpg", openId: "scan-missing-profile" });
    expect(result.dishName).toBe("Meal not confidently identified");
    expect(result.calories).toBeGreaterThan(0);
  });

  it("adjusts estimates for stated restaurant and recipe context", async () => {
    const caller = appRouter.createCaller(ctx);
    const home = await caller.vision.analyze({ fileName: "masala-dosa.jpg" });
    const restaurant = await caller.vision.analyze({ fileName: "masala-dosa.jpg", cookingContext: "restaurant", recipeVariant: "extra oil" });
    expect(restaurant.calories).toBeGreaterThan(home.calories);
    expect(restaurant.uncertaintyReasons.some(reason => reason.includes("extra oil"))).toBe(true);
  });

  it("requires the requested profile fields before sending a signup OTP", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auth.requestOtp({ mode: "signup", identifier: "alex@example.com" })).rejects.toThrow();
  });

  it("returns a demo OTP code and verifies it in demo mode", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "";

    try {
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.requestOtp({
        mode: "signup",
        identifier: "thiru@gmail.com",
        name: "Thiru",
        email: "thiru@gmail.com",
        phone: "8072827862",
        dateOfBirth: "2007-01-05",
        age: 19,
      });

      expect(result.demoCode).toMatch(/^\d{6}$/);
      expect(result.challengeId).toBeGreaterThan(0);

      const verified = await caller.auth.verifyOtp({
        challengeId: result.challengeId,
        code: result.demoCode!,
      });

      expect(verified.verified).toBe(true);
      expect(verified.user.email).toBe("thiru@gmail.com");
    } finally {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("rejects unsafe profile goal ranges", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.account.updateProfile({ openId: "local:test", name: "Test User", email: "test@example.com", phone: "+15550000000", dateOfBirth: "1990-01-01", age: 35, goalCalories: 200, goalProtein: 120, goalCarbs: 220, goalFat: 70, hydrationGoal: 8 })).rejects.toThrow();
  });

  it("does not fabricate weekly intake without a signed-in meal history", async () => {
    const caller = appRouter.createCaller(ctx);
    const summary = await caller.dashboard.summary();
    expect(summary.weeklyIntake).toHaveLength(0);
  });
});
