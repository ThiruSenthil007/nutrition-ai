# 🥗 NutriAI — Everyday Nutrition Support

NutriAI is an intelligent food nutrition analyzer and wellness companion powered by Google Gemini multimodal vision AI.

## ✨ Features

- 📸 **AI Food Recognition & Nutrition Scanner**: Upload or capture food photos to instantly identify dishes, portion weights, and macro breakdown (Calories, Protein, Carbs, Fats, Fiber) calibrated against ICMR-NIN & USDA nutritional standards.
- 🎯 **Daily Goals & Progress Tracking**: Monitor calorie budget, macronutrient targets, and hydration.
- 💬 **AI Nutrition Coach**: Personalized dietary advice tailored to health conditions (diabetes, blood pressure, cholesterol).
- 📱 **Responsive Mobile-first Design**: Clean, accessible UI built with Tailwind CSS and Radix UI.

## 🚀 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, TanStack Query, Radix UI, Framer Motion
- **Backend**: Express, tRPC, Drizzle ORM
- **AI**: Google Gemini Multimodal Vision API (`gemini-3.5-flash-lite`)
- **Deployment**: Vercel Serverless Architecture

## 🛠️ Local Development

```bash
# Install dependencies
pnpm install

# Start development server
node .\node_modules\tsx\dist\cli.mjs watch server/_core/index.ts
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
