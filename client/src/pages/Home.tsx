import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Compass,
  Droplets,
  Flame,
  History as HistoryIcon,
  Leaf,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Send,
  ScanLine,
  Save,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";

type View = "today" | "discover" | "plan" | "tasks" | "coach" | "scan" | "history";
type CoachMessage = { role: "user" | "assistant"; text: string };
type ClientProfile = { openId?: string; name?: string | null; email?: string | null; currentWeightKg?: number | null; targetWeightKg?: number | null; currentWeight?: number | null; targetWeight?: number | null; };

async function prepareScanImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Image processing is unavailable in this browser");
  }
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.82, 0.7, 0.58]) {
    const imageData = canvas.toDataURL("image/jpeg", quality);
    if (imageData.length <= 11_500_000) return imageData;
  }
  throw new Error("This image is too large to scan. Try a smaller photo.");
}

function getStoredUser(): ClientProfile | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem("nutrition-ai-user") || "null"); } catch { return null; }
}

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "scan", label: "Scan food", icon: ScanLine },
  { id: "history", label: "History", icon: HistoryIcon },
  { id: "plan", label: "My plan", icon: CalendarDays },
  { id: "tasks", label: "Tasks", icon: Check },
  { id: "coach", label: "Coach", icon: MessageCircle },
];

function MetricCard({ label, value, detail, icon: Icon, accent, progress }: { label: string; value: string; detail: string; icon: typeof Flame; accent: string; progress?: number }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${accent}`}><Icon size={18} strokeWidth={2.2} /></div>
      <div>
        <p className="eyebrow">{label}</p>
        <p className="metric-value">{value}</p>
        <p className="metric-detail">{detail}</p>
        {progress !== undefined && <div className="metric-progress"><span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>}
      </div>
    </div>
  );
}

function RecipeCard({ recipe, onLog }: { recipe: any; onLog: (recipe: any) => void }) {
  return (
    <article className={`recipe-card accent-${recipe.accent}`}>
      <div className="recipe-art"><Leaf size={32} strokeWidth={1.5} /><span>{recipe.category}</span></div>
      <div className="recipe-body">
        <div className="recipe-topline"><span className="recipe-diet">{recipe.diet}</span><span className="recipe-time"><Clock3 size={13} /> {recipe.prepMinutes} min</span></div>
        <h3>{recipe.title}</h3>
        <p>{recipe.description}</p>
        <div className="recipe-meta"><span>{recipe.calories} kcal</span><span>{recipe.protein}g protein</span><span>{recipe.costBand}</span></div>
        <Button className="recipe-action" onClick={() => onLog(recipe)}><Plus size={16} /> Add to today</Button>
      </div>
    </article>
  );
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [currentUser] = useState<ClientProfile | null>(() => getStoredUser());
  const displayName = currentUser?.name || "Maya Johnson";
  const [activeView, setActiveView] = useState<View>("today");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All meals");
  const [diet, setDiet] = useState("Any diet");
  const [coachPrompt, setCoachPrompt] = useState("");
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanFileName, setScanFileName] = useState("");
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanHistoryId, setScanHistoryId] = useState<number | undefined>();
  const [cookingContext, setCookingContext] = useState<"homemade" | "restaurant" | "mess" | "packaged">("homemade");
  const [recipeVariant, setRecipeVariant] = useState("");
  const [messages, setMessages] = useState<CoachMessage[]>([{ role: "assistant", text: "Hi Maya — I’m here to help you make today feel a little easier. Ask me about your meals, protein, or what to cook next." }]);

  const dashboard = trpc.dashboard.summary.useQuery({ openId: currentUser?.openId });
  const recipeInput = useMemo(() => ({ query: search || undefined, category: category === "All meals" ? undefined : category, diet: diet === "Any diet" ? undefined : diet }), [search, category, diet]);
  const recipes = trpc.recipes.list.useQuery(recipeInput);
  const scanHistory = trpc.history.list.useQuery({ openId: currentUser?.openId });
  const scanFeedback = trpc.scanFeedback.list.useQuery({ openId: currentUser?.openId ?? "" }, { enabled: Boolean(currentUser?.openId) });
  const profile = trpc.account.profile.useQuery({ openId: currentUser?.openId ?? "" }, { enabled: Boolean(currentUser?.openId) });
  const utils = trpc.useUtils();
  const logMeal = trpc.mealLogs.create.useMutation({
    onSuccess: () => {
      toast.success("Added to today", { description: "Your dashboard has been updated." });
      utils.dashboard.summary.invalidate();
    },
    onError: () => toast.error("Could not add that meal", { description: "Please try again." }),
  });
  const coach = trpc.coach.ask.useMutation({
    onSuccess: result => setMessages(current => [...current, { role: "assistant", text: result.answer }]),
    onError: error => toast.error("Coach is taking a breath", { description: error.message || "Check the AI provider configuration and try again." }),
  });
  const historySave = trpc.history.create.useMutation({
    onSuccess: saved => { setScanHistoryId(saved.id); utils.history.list.invalidate(); },
    onError: () => toast.error("Scan saved locally only", { description: "Storage is unavailable, but you can still review this result." }),
  });
  const vision = trpc.vision.analyze.useMutation({
    onError: error => toast.error("Scan could not be completed", { description: error.message || "Check the image and try again." }),
  });

  const data = dashboard.data;
  const recipeList = recipes.data ?? [];
  const navigate = (view: View) => { setActiveView(view); setMobileNavOpen(false); };
  const logRecipe = (recipe: any) => logMeal.mutate({ openId: currentUser?.openId, recipeId: recipe.id, mealType: recipe.category.toLowerCase(), calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat });
  const sendCoach = (prompt = coachPrompt) => {
    const clean = prompt.trim();
    if (!clean || coach.isPending) return;
    setMessages(current => [...current, { role: "user", text: clean }]);
    setCoachPrompt("");
    coach.mutate({ prompt: clean, openId: currentUser?.openId, history: messages.slice(-10) });
  };
  const handleScanFile = (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image is too large", { description: "Choose an image under 10 MB." });
      return;
    }
    setScanFile(file);
    setScanFileName(file.name);
    setScanResult(null);
    setScanHistoryId(undefined);
    const reader = new FileReader();
    reader.onload = async () => {
      setScanPreview(String(reader.result));
      try {
        const imageData = await prepareScanImage(file);
        vision.mutate({ fileName: file.name, imageData, openId: currentUser?.openId, cookingContext, recipeVariant }, {
          onSuccess: result => {
            setScanResult(result);
            historySave.mutate({ openId: currentUser?.openId, fileName: file.name, imageData, mimeType: "image/jpeg", ...result, cookingContext, recipeVariant });
            toast.success("Scan complete", { description: `${result.dishName} was added to your scan history.` });
          },
        });
      } catch (error) {
        toast.error("Scan could not be completed", { description: error instanceof Error ? error.message : "Try another food image." });
      }
    };
    reader.onerror = () => toast.error("Scan could not be completed", { description: "The image file could not be read." });
    reader.readAsDataURL(file);
  };

  const handleUseCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera access is not available", { description: "Use a browser that supports webcam capture, or upload a photo instead." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      const canvas = document.createElement("canvas");
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Unable to create a camera snapshot.");
      }

      context.drawImage(video, 0, 0, width, height);
      stream.getTracks().forEach(track => track.stop());

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) {
        throw new Error("No camera image was captured.");
      }

      const file = new File([blob], `camera-scan-${Date.now()}.jpg`, { type: "image/jpeg" });
      handleScanFile(file);
    } catch (error) {
      console.error("Camera capture failed", error);
      toast.error("Camera capture failed", { description: "Please allow camera access or choose an image from your device." });
    }
  };

  return (
    <div className="nutrition-app">
      <aside className={`app-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="brand-lockup"><img className="brand-logo" src="/image.png" alt="NutriVision AI" /></div>
        <button className="sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={20} /></button>
        <button className="profile-mini clickable" onClick={() => { window.location.href = "/settings"; }}><div className="avatar avatar-lg">{displayName.slice(0, 1).toUpperCase()}</div><div><strong>{displayName}</strong><span>Consistency mode</span></div><span className="status-dot" /></button>
        <nav className="primary-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${activeView === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}><Icon size={18} /><span>{item.label}</span>{item.id === "coach" && <span className="nav-dot" />}</button>;
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip"><div className="tip-icon"><Sparkles size={17} /></div><strong>Small steps compound.</strong><p>Your 6-day streak is proof you’re building something sustainable.</p><button onClick={() => navigate("plan")}>View my rhythm <ArrowUpRight size={14} /></button></div>
        <div className="sidebar-footer"><div className="leaf-badge"><Leaf size={14} /> Balanced by design</div><span>v1.0 beta</span></div>
      </aside>
      {mobileNavOpen && <button className="mobile-overlay" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}

      <main className="app-main">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{navItems.find(item => item.id === activeView)?.label}</strong></div><div className="topbar-actions"><span className="sync-status"><span className="status-dot" /> All changes saved</span><button className="theme-toggle" onClick={() => toggleTheme?.()} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button><a className="signin-link" href={currentUser ? "/settings" : "/login"}>{currentUser ? displayName.split(" ")[0] : "Sign in"}</a><button className="notification-button" aria-label="Notifications"><span>2</span>◌</button><a href={currentUser ? "/settings" : "/login"} className="avatar avatar-link">{displayName.slice(0, 1).toUpperCase()}</a></div></header>

        <div className="page-wrap">
          {activeView === "today" && <TodayView data={data} profile={profile.data} recipes={recipeList} onNavigate={navigate} onLog={logRecipe} userName={displayName} />}
          {activeView === "discover" && <DiscoverView recipes={recipeList} search={search} setSearch={setSearch} category={category} setCategory={setCategory} diet={diet} setDiet={setDiet} onLog={logRecipe} />}
          {activeView === "scan" && <><ScanView preview={scanPreview} fileName={scanFileName} result={scanResult} pending={vision.isPending || historySave.isPending} onFile={handleScanFile} onUseCamera={handleUseCamera} onNavigate={navigate} onLog={logRecipe} /><ScanEnhancements result={scanResult} openId={currentUser?.openId} historyId={scanHistoryId} feedback={scanFeedback.data ?? []} cookingContext={cookingContext} setCookingContext={setCookingContext} recipeVariant={recipeVariant} setRecipeVariant={setRecipeVariant} onRescan={() => scanFile && handleScanFile(scanFile)} onFeedbackSaved={() => scanFeedback.refetch()} /></>}
          {activeView === "history" && <HistoryView entries={scanHistory.data ?? []} onNavigate={navigate} />}
          {activeView === "plan" && <PlanView data={data} recipes={recipeList} onLog={logRecipe} />}
          {activeView === "tasks" && <TasksView profile={profile.data} onNavigate={navigate} onLog={logRecipe} recipes={recipeList} />}
          {activeView === "coach" && <CoachView messages={messages} prompt={coachPrompt} setPrompt={setCoachPrompt} onSend={sendCoach} pending={coach.isPending} />}
        </div>
      </main>
    </div>
  );
}

type CookingContext = "homemade" | "restaurant" | "mess" | "packaged";

function ScanEnhancements({ result, openId, historyId, feedback, cookingContext, setCookingContext, recipeVariant, setRecipeVariant, onRescan, onFeedbackSaved }: { result: any; openId?: string; historyId?: number; feedback: any[]; cookingContext: CookingContext; setCookingContext: (value: CookingContext) => void; recipeVariant: string; setRecipeVariant: (value: string) => void; onRescan: () => void; onFeedbackSaved: () => void }) {
  const [oilReduction, setOilReduction] = useState(0);
  const [portionPercent, setPortionPercent] = useState(100);
  const [ingredientSwap, setIngredientSwap] = useState("none");
  const [correctedDish, setCorrectedDish] = useState("");
  const [correctedCalories, setCorrectedCalories] = useState("");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const feedbackMutation = trpc.scanFeedback.save.useMutation({
    onSuccess: () => { setFeedbackSaved(true); onFeedbackSaved(); toast.success("Feedback saved", { description: "Your correction will calibrate your future estimates." }); },
    onError: error => toast.error("Feedback could not be saved", { description: error.message }),
  });
  useEffect(() => {
    setCorrectedDish(result?.dishName ?? "");
    setCorrectedCalories(result ? String(result.calories) : "");
    setCorrectionNotes("");
    setFeedbackSaved(false);
    setOilReduction(0);
    setPortionPercent(100);
    setIngredientSwap("none");
  }, [result]);

  const swaps: Record<string, { label: string; calories: number; protein: number; carbs: number; fat: number; fiber: number }> = {
    none: { label: "No ingredient change", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    tofu: { label: "Swap a rich protein for tofu (assumption)", calories: -70, protein: -3, carbs: 1, fat: -6, fiber: 1 },
    vegetables: { label: "Add a serving of non-starchy vegetables", calories: 35, protein: 2, carbs: 7, fat: 0, fiber: 3 },
    legumes: { label: "Add a serving of beans or lentils", calories: 90, protein: 6, carbs: 15, fat: 1, fiber: 5 },
  };
  const swap = swaps[ingredientSwap];
  const portionFactor = portionPercent / 100;
  const simulatedCalories = result ? Math.max(0, Math.round((result.calories - oilReduction * 9 + swap.calories) * portionFactor)) : 0;
  const lowMargin = result ? Math.max(0, result.calories - result.caloriesLow) : 0;
  const highMargin = result ? Math.max(0, result.caloriesHigh - result.calories) : 0;
  const simulatedLow = Math.max(0, Math.round(simulatedCalories - lowMargin * portionFactor));
  const simulatedHigh = Math.round(simulatedCalories + highMargin * portionFactor);
  const simulatedProtein = result ? Math.max(0, Math.round((result.protein + swap.protein) * portionFactor)) : 0;
  const simulatedCarbs = result ? Math.max(0, Math.round((result.carbs + swap.carbs) * portionFactor)) : 0;
  const simulatedFat = result ? Math.max(0, Math.round((result.fat - oilReduction + swap.fat) * portionFactor)) : 0;
  const simulatedFiber = result ? Math.max(0, Math.round((result.fiber + swap.fiber) * portionFactor)) : 0;
  const corrections = feedback.filter(item => item.feedbackType === "corrected");
  const commonErrors = Array.from(corrections.reduce((groups: Map<string, { count: number; corrected: string }>, item) => {
    const key = item.predictedDish;
    const current = groups.get(key) ?? { count: 0, corrected: item.correctedDish };
    groups.set(key, { count: current.count + 1, corrected: item.correctedDish });
    return groups;
  }, new Map<string, { count: number; corrected: string }>()).entries()).sort((left, right) => right[1].count - left[1].count).slice(0, 4);

  const saveFeedback = (feedbackType: "verified" | "corrected") => {
    if (!result) return;
    if (!openId) { toast.error("Sign in to save personal scan feedback"); return; }
    const dish = feedbackType === "verified" ? result.dishName : correctedDish.trim();
    const calories = feedbackType === "verified" ? result.calories : Number(correctedCalories);
    if (!dish || !Number.isFinite(calories) || calories < 0) { toast.error("Enter a food name and valid calorie estimate"); return; }
    feedbackMutation.mutate({ openId, scanId: historyId, predictedDish: result.dishName, correctedDish: dish, predictedCalories: result.calories, correctedCalories: Math.round(calories), feedbackType, cookingContext, recipeVariant, correctionNotes: correctionNotes.trim() });
  };

  return <>
    <section className="scan-context-controls">
      <div><p className="eyebrow">COOKING CONTEXT</p><label>Where was it prepared?<select value={cookingContext} onChange={event => setCookingContext(event.target.value as CookingContext)}><option value="homemade">Homemade</option><option value="restaurant">Restaurant</option><option value="mess">Mess / cafeteria</option><option value="packaged">Packaged</option></select></label></div>
      <label className="scan-variant-field">Recipe variation or ingredients<Input value={recipeVariant} onChange={event => setRecipeVariant(event.target.value)} placeholder="e.g. extra oil, coconut milk, no sugar" /></label>
      <Button className="scan-recalculate" onClick={onRescan} disabled={!result}>Recalculate scan</Button>
    </section>
    {!result && <p className="scan-context-hint">Set the cooking context and recipe details before uploading, or recalculate after changing them.</p>}
    {result && <>
      <section className="scan-explanation-panel">
        <div className="scan-panel-heading"><div><p className="eyebrow">WHY THIS ESTIMATE?</p><h3>Evidence & uncertainty</h3></div><span className={`analysis-source ${result.analysisMode === "image_model" ? "source-live" : "source-demo"}`}>{result.source}</span></div>
        <div className="uncertainty-range"><div><span>Estimated energy range</span><strong>{result.caloriesLow}–{result.caloriesHigh} kcal</strong></div><div><span>Identification confidence</span><strong>{Math.round(result.confidence * 100)}%</strong></div></div>
        <p className="scan-explanation-note">{result.note}</p>
        <div className="scan-explanation-grid"><div><strong>Visible cues</strong><div className="detected-tags">{(result.detectedObjects ?? []).map((cue: string) => <span key={cue}>{cue}</span>)}</div></div><div><strong>Why it matched</strong><ul>{(result.explanation ?? []).map((reason: string) => <li key={reason}>{reason}</li>)}</ul></div></div>
        <div className="uncertainty-reasons"><strong>What makes the estimate uncertain</strong><ul>{(result.uncertaintyReasons ?? []).map((reason: string) => <li key={reason}>{reason}</li>)}</ul></div>
        {!!result.personalAdjustmentPercent && <p className="personal-calibration-note">Personal calibration: {result.personalAdjustmentPercent > 0 ? "+" : ""}{result.personalAdjustmentPercent}% based on {result.correctionCount} prior corrections.</p>}
      </section>
      <section className="scan-simulator">
        <div className="scan-panel-heading"><div><p className="eyebrow">WHAT-IF SIMULATOR</p><h3>Adjust the meal</h3></div><Sparkles size={18} /></div>
        <div className="simulator-controls">
          <label>Reduce cooking oil <strong>{oilReduction} g</strong><input type="range" min="0" max="30" step="1" value={oilReduction} onChange={event => setOilReduction(Number(event.target.value))} /></label>
          <label>Portion size <strong>{portionPercent}%</strong><input type="range" min="50" max="150" step="5" value={portionPercent} onChange={event => setPortionPercent(Number(event.target.value))} /></label>
          <label>Ingredient scenario<select value={ingredientSwap} onChange={event => setIngredientSwap(event.target.value)}>{Object.entries(swaps).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select></label>
        </div>
        <div className="simulator-result"><div><span>Scenario estimate</span><strong>{simulatedLow}–{simulatedHigh} kcal</strong></div><div className="simulator-macros"><span>{simulatedProtein}g protein</span><span>{simulatedCarbs}g carbs</span><span>{simulatedFat}g fat</span><span>{simulatedFiber}g fiber</span></div></div>
        <p className="simulator-disclaimer">Planning estimate only. Oil uses 9 kcal/g; ingredient swaps use generic serving assumptions and do not re-analyze the image.</p>
      </section>
      <section className="scan-correction-panel">
        <div className="scan-panel-heading"><div><p className="eyebrow">VERIFY · CORRECT · IMPROVE</p><h3>Was this scan right?</h3></div><span>{feedback.length} saved feedback items</span></div>
        <div className="correction-fields"><label>Correct food name<Input value={correctedDish} onChange={event => setCorrectedDish(event.target.value)} /></label><label>Corrected calories<Input type="number" min="0" max="10000" value={correctedCalories} onChange={event => setCorrectedCalories(event.target.value)} /></label></div>
        <label className="correction-notes-field">Correction notes (optional)<Input value={correctionNotes} onChange={event => setCorrectionNotes(event.target.value)} placeholder="e.g. homemade with 1 tsp oil" /></label>
        <div className="correction-actions"><Button variant="outline" disabled={feedbackMutation.isPending || feedbackSaved || !openId} onClick={() => saveFeedback("verified")}>{feedbackSaved ? "Feedback saved" : "Confirm identification"}</Button><Button className="primary-cta" disabled={feedbackMutation.isPending || feedbackSaved || !openId} onClick={() => saveFeedback("corrected")}>Save correction</Button></div>
        {!openId && <p className="scan-context-hint">Sign in to save corrections to your personal calibration history.</p>}
        <p className="simulator-disclaimer">Corrections improve your personal estimates after repeated feedback; they do not retrain the underlying vision model.</p>
      </section>
    </>}
    {openId && <section className="scan-error-dashboard"><div className="scan-panel-heading"><div><p className="eyebrow">YOUR AI ERROR DASHBOARD</p><h3>Patterns in your corrections</h3></div><span>{corrections.length} corrections</span></div>{commonErrors.length ? <div className="correction-error-list">{commonErrors.map(([food, summary]) => <div key={food}><strong>{food}</strong><span>Corrected to {summary.corrected}</span><b>{summary.count}×</b></div>)}</div> : <p className="scan-context-hint">Your corrections will reveal which foods need more careful estimates.</p>}</section>}
  </>;
}

function TodayView({ data, profile, recipes, onNavigate, onLog, userName }: { data: any; profile: any; recipes: any[]; onNavigate: (view: View) => void; onLog: (recipe: any) => void; userName: string }) {
  const calories = data?.calories ?? { current: 1284, target: 2050 };
  const macros = data?.macros ?? { protein: 76, carbs: 142, fat: 48 };
  const goals = { calories: profile?.goalCalories ?? calories.target, protein: profile?.goalProtein ?? 120, carbs: profile?.goalCarbs ?? 220, fat: profile?.goalFat ?? 70, hydration: profile?.hydrationGoal ?? data?.hydration?.target ?? 8 };
  const hydrationCurrent = data?.hydration?.current ?? 5;
  const meals = data?.meals ?? [];
  const weekly = data?.weekly ?? [62, 74, 68, 82, 76, 88, 72];
  const percent = Math.round((calories.current / goals.calories) * 100);
  const proteinPercent = Math.round((macros.protein / goals.protein) * 100);
  const carbsPercent = Math.round((macros.carbs / goals.carbs) * 100);
  const fatPercent = Math.round((macros.fat / goals.fat) * 100);
  const hydrationPercent = Math.round((hydrationCurrent / goals.hydration) * 100);
  return <>
    <section className="page-heading"><div><p className="eyebrow accent-text">{data?.dateLabel ?? "Tuesday, Sep 24"}</p><h1>Good morning, {userName.split(" ")[0]} <span className="wave">✦</span></h1><p className="subheading">A calm check-in for a more nourished day.</p></div><Button className="primary-cta" onClick={() => onNavigate("discover")}><Plus size={17} /> Log a meal</Button></section>
    <section className="hero-panel"><div className="hero-copy"><div className="hero-kicker"><Sparkles size={15} /> YOUR DAILY ANCHOR</div><h2>A steadier day starts with<br /><em>one good choice.</em></h2><p>You’re on a 6-day rhythm. Let’s keep the momentum gentle and practical.</p><button className="hero-link" onClick={() => onNavigate("plan")}>See today’s plan <ArrowUpRight size={16} /></button></div><div className="hero-orbit"><div className="orbit-ring"><div className="orbit-center"><strong>{percent}%</strong><span>of today’s<br />energy</span></div></div><div className="orbit-note"><CircleCheck size={16} /> On track</div></div><div className="hero-squiggle" /></section>
    <section className="metric-grid"><MetricCard label="Energy" value={`${calories.current.toLocaleString()} kcal`} detail={`of ${goals.calories.toLocaleString()} target`} icon={Flame} accent="orange" progress={percent} /><MetricCard label="Protein" value={`${macros.protein}g`} detail={`${Math.max(0, goals.protein - macros.protein)}g left to target`} icon={Leaf} accent="green" progress={proteinPercent} /><MetricCard label="Hydration" value={`${hydrationCurrent} / ${goals.hydration} cups`} detail={hydrationCurrent >= goals.hydration ? "Daily goal reached" : `${goals.hydration - hydrationCurrent} cups left`} icon={Droplets} accent="blue" progress={hydrationPercent} /><MetricCard label="Rhythm" value={`${data?.streak ?? 6} days`} detail="Your best: 12 days" icon={Sparkles} accent="purple" /></section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 18 }}>
      <div className="surface-card" style={{ padding: 18 }}>
        <div className="card-heading"><div><p className="eyebrow">HYDRATION CHECK</p><h2>Water rhythm</h2></div><span className="trend-pill">{hydrationCurrent}/{goals.hydration} cups</span></div>
        <div style={{ height: 12, borderRadius: 999, background: "rgba(148,163,184,0.18)", overflow: "hidden", margin: "12px 0 10px" }}><div style={{ width: `${Math.min(100, Math.max(0, hydrationPercent))}%`, height: "100%", background: "linear-gradient(90deg, #6ec9ff, #44c2a6)" }} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <small style={{ color: "#6b7280" }}>{hydrationCurrent >= goals.hydration ? "Goal reached — nice work." : `${goals.hydration - hydrationCurrent} cups left for today`}</small>
          <button className="primary-cta" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => toast.success("Hydration logged", { description: "One more glass added to your rhythm." })}>+ 1 glass</button>
        </div>
      </div>
      <div className="surface-card" style={{ padding: 18 }}>
        <div className="card-heading"><div><p className="eyebrow">QUICK ADD</p><h2>Easy Indian meals</h2></div><button className="quiet-button" onClick={() => onNavigate("discover")}>View all <ChevronRight size={15} /></button></div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {recipes.slice(0, 3).map(recipe => <button key={recipe.id} onClick={() => onLog(recipe)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, background: "rgba(15,23,42,0.03)", border: "1px solid rgba(148,163,184,0.2)", fontWeight: 600, cursor: "pointer" }}><span>{recipe.title}</span><Plus size={15} /></button>)}
        </div>
      </div>
      <div className="surface-card" style={{ padding: 18 }}>
        <div className="card-heading"><div><p className="eyebrow">SMART SWAPS</p><h2>Little wins</h2></div></div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {[
            "Swap sweet chai for unsweetened tea after lunch",
            "Add a side of sabzi to improve fiber",
            "Choose curd or buttermilk over fried snacks",
          ].map(item => <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, color: "#374151", fontSize: 14 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />{item}</div>)}
        </div>
      </div>
    </section>
    <section className="content-grid two-col"><div className="surface-card day-card"><div className="card-heading"><div><p className="eyebrow">TODAY AT A GLANCE</p><h2>Your nourishment flow</h2></div><button className="quiet-button" onClick={() => onNavigate("plan")}>View plan <ChevronRight size={15} /></button></div><div className="meal-timeline">{meals.map((meal: any, index: number) => <div className={`meal-row ${meal.status === "up next" ? "next" : ""}`} key={meal.id}><div className="meal-rail"><span className={`meal-dot ${meal.status === "logged" ? "done" : meal.status === "up next" ? "current" : ""}`}>{meal.status === "logged" && <Check size={12} />}</span>{index < meals.length - 1 && <span className="rail-line" />}</div><div className="meal-info"><div className="meal-label"><span>{meal.label}</span><small>{meal.time}</small></div><strong>{meal.title}</strong>{meal.calories > 0 ? <span className="meal-calories">{meal.calories} kcal</span> : <button className="inline-add" onClick={() => onNavigate("discover")}><Plus size={13} /> Find a snack</button>}</div>{meal.status === "logged" && <span className="logged-pill">Logged</span>}{meal.status === "planned" && <span className="planned-pill">Planned</span>}</div>)}</div></div><div className="right-stack"><div className="surface-card coach-note"><div className="note-top"><div className="sparkle-bubble"><Sparkles size={18} /></div><span className="ai-label">NUTRIAI NOTE</span><span className="note-time">Just now</span></div><h3>Your fiber is having a good day.</h3><p>With chickpeas at lunch and berries at breakfast, you’ve already made two choices your gut will thank you for.</p><button onClick={() => onNavigate("coach")}>Ask coach anything <ArrowUpRight size={15} /></button></div><div className="surface-card mini-progress"><div className="card-heading"><div><p className="eyebrow">MACRO BALANCE</p><h2>So far today</h2></div><button className="icon-button" aria-label="Macro details">···</button></div><div className="macro-bars"><MacroBar label="Protein" value={`${macros.protein}g / ${goals.protein}g`} percent={proteinPercent} color="green" /><MacroBar label="Carbs" value={`${macros.carbs}g / ${goals.carbs}g`} percent={carbsPercent} color="orange" /><MacroBar label="Fats" value={`${macros.fat}g / ${goals.fat}g`} percent={fatPercent} color="purple" /></div></div></div></section>
    <section className="content-grid lower-grid"><div className="surface-card rhythm-card"><div className="card-heading"><div><p className="eyebrow">YOUR WEEKLY RHYTHM</p><h2>Consistency, not perfection</h2></div><span className="trend-pill">↗ 12% this week</span></div><div className="rhythm-chart">{weekly.map((height: number, index: number) => <div className="chart-column" key={index}><div className="chart-bar-wrap"><div className="chart-bar" style={{ height: `${height}%` }}><span>{height}</span></div></div><small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small></div>)}</div></div><div className="surface-card recommendations"><div className="card-heading"><div><p className="eyebrow">MADE FOR YOU</p><h2>Next best bites</h2></div><button className="quiet-button" onClick={() => onNavigate("discover")}>Explore all <ChevronRight size={15} /></button></div><div className="mini-recipe-list">{recipes.slice(0, 2).map(recipe => <button className="mini-recipe" key={recipe.id} onClick={() => onLog(recipe)}><div className={`mini-recipe-art accent-${recipe.accent}`}><Leaf size={19} /></div><span><strong>{recipe.title}</strong><small>{recipe.prepMinutes} min · {recipe.protein}g protein</small></span><Plus size={16} /></button>)}</div></div></section>
    <WeeklyProgressChart entries={data?.weeklyIntake ?? []} goals={goals} />
    <SmartInsights goals={goals} calories={calories} />
    <DailyHealthAnalysis openId={profile?.openId} />
    <p className="disclaimer"><Sparkles size={13} /> NutriAI provides general nutrition information, not medical advice. Your data stays yours.</p>
  </>;
}


function DailyHealthAnalysis({ openId }: { openId?: string }) {
  const analysis = trpc.health.dailyAnalysis.useQuery({ openId: openId ?? "" }, { enabled: Boolean(openId) });
  if (!analysis.data) return null;
  return <section className="daily-health-card"><div className="daily-health-heading"><div><p className="eyebrow accent-text">DAILY HEALTH CHECK-IN</p><h2>Guidance shaped around you.</h2><p>Based on the health preferences you saved, not a diagnosis.</p></div><div className="condition-pills">{analysis.data.conditions.map((condition: string) => <span key={condition}>{condition}</span>)}</div></div><div className="daily-guidance-grid">{analysis.data.priorities.map((item: any) => <article key={item.condition}><strong>{item.focus}</strong><span>{item.suggestion}</span></article>)}</div><p className="health-disclaimer">{analysis.data.disclaimer}</p></section>;
}

function WeeklyProgressChart({ entries, goals }: { entries: any[]; goals: { calories: number; protein: number; carbs: number; fat: number; hydration: number } }) {
  if (!entries.length) return <section className="surface-card weekly-progress-card weekly-empty"><div className="card-heading"><div><p className="eyebrow">WEEKLY PROGRESS</p><h2>Start your real intake history</h2><p className="card-caption">Log a meal to compare your actual calories and macros against your custom goals.</p></div><div className="weekly-empty-icon"><Sparkles size={18} /></div></div></section>;
  const averageCalories = entries.length ? Math.round(entries.reduce((sum, item) => sum + item.calories, 0) / entries.length) : 0;
  const daysOnTarget = entries.filter(item => item.calories <= goals.calories * 1.1 && item.calories >= goals.calories * .8).length;
  return <section className="surface-card weekly-progress-card"><div className="card-heading weekly-heading"><div><p className="eyebrow">WEEKLY PROGRESS</p><h2>Logged intake vs your goals</h2><p className="card-caption">Daily calories compared with your {goals.calories.toLocaleString()} kcal target.</p></div><div className="weekly-summary"><strong>{averageCalories.toLocaleString()}</strong><span>avg kcal</span><em>{daysOnTarget}/7 on target</em></div></div><div className="weekly-chart"><div className="chart-axis"><span>{goals.calories.toLocaleString()}</span><span>{Math.round(goals.calories * .5).toLocaleString()}</span><span>0</span></div><div className="weekly-bars">{entries.map(entry => { const height = Math.min(100, Math.round((entry.calories / goals.calories) * 100)); const onTarget = entry.calories <= goals.calories * 1.1 && entry.calories >= goals.calories * .8; return <div className="weekly-day" key={entry.day}><div className="weekly-bar-wrap"><div className="goal-line" /><div className={`weekly-bar ${onTarget ? "on-target" : "over-target"}`} style={{ height: `${Math.max(8, height)}%` }} title={`${entry.calories} kcal`}><span>{entry.calories}</span></div></div><strong>{entry.day}</strong><small>{entry.protein}g P</small></div>; })}</div></div><div className="weekly-legend"><span><i className="legend-swatch goal-swatch" /> On target range</span><span><i className="legend-swatch over-swatch" /> Above target</span><span className="weekly-tip"><Sparkles size={13} /> Your most consistent day was Friday.</span></div></section>;
}

function SmartInsights({ goals, calories }: { goals: { calories: number; protein: number; carbs: number; fat: number; hydration: number }; calories: { current: number; target: number } }) {
  const healthScore = Math.min(98, Math.round(76 + (goals.calories > 0 ? 4 : 0)));
  return <section className="smart-insights"><div className="smart-intro"><p className="eyebrow accent-text">SMART NUTRITION LAYER</p><h2>More than a calorie count.</h2><p>NutriAI turns your food log into small, practical actions for the rest of your day.</p></div><div className="insight-grid"><article className="insight-card health-insight"><div className="insight-icon"><CircleCheck size={17} /></div><div><p className="eyebrow">HEALTH SCORE</p><h3>{healthScore}<small>/ 100</small></h3><span className="insight-status">Good balance today</span></div></article><article className="insight-card water-insight"><div className="insight-icon"><Droplets size={17} /></div><div><p className="eyebrow">SMART WATER</p><h3>{Math.max(1, goals.hydration - 5)} more cups</h3><span>Keep a glass nearby after your next meal.</span></div></article><article className="insight-card workout-insight"><div className="insight-icon"><Sparkles size={17} /></div><div><p className="eyebrow">MOVE SUGGESTION</p><h3>22 min walk</h3><span>A gentle reset for your {calories.current.toLocaleString()} kcal logged today.</span></div></article><article className="insight-card carbon-insight"><div className="insight-icon"><Leaf size={17} /></div><div><p className="eyebrow">CARBON SCORE</p><h3>82 <small>/ low impact</small></h3><span>Plant-forward meals are helping this week.</span></div></article></div><div className="recommendation-strip"><strong>Personalized pathways</strong><span>Diabetes-friendly</span><span>Blood pressure</span><span>Weight goals</span><span>Healthy alternatives</span><button>Explore recommendations <ArrowUpRight size={14} /></button></div></section>;
}

function MacroBar({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) { return <div className="macro-row"><div><span>{label}</span><strong>{value}</strong></div><div className="macro-track"><span className={`macro-fill ${color}`} style={{ width: `${percent}%` }} /></div></div>; }

function HealthGuidance({ result }: { result: any }) {
  return <section className="scan-guidance"><div className="scan-guidance-heading"><div><p className="eyebrow accent-text">HEALTHIER NEXT STEP</p><h3>Make this plate work harder for you.</h3><p>Suggestions are based on your saved preferences and the scan estimate.</p></div><span>{result.guidanceConditions}</span></div><div className="guidance-columns"><div><strong>Better alternatives</strong>{result.alternatives?.map((item: string) => <p key={item}><Leaf size={13} />{item}</p>)}</div><div><strong>Try this today</strong>{result.suggestions?.map((item: string) => <p key={item}><Sparkles size={13} />{item}</p>)}</div></div><small>{result.guidanceDisclaimer}</small></section>;
}

function HistoryView({ entries, onNavigate }: { entries: any[]; onNavigate: (view: View) => void }) {
  return <>
    <section className="page-heading"><div><p className="eyebrow accent-text">SCAN HISTORY</p><h1>Your nutrition snapshots.</h1><p className="subheading">Revisit past food photos and the nutrition estimates you approved.</p></div><Button className="primary-cta" onClick={() => onNavigate("scan")}><ScanLine size={17} /> Scan new food</Button></section>
    {entries.length === 0 ? <div className="history-empty surface-card"><div className="result-icon"><HistoryIcon size={20} /></div><p className="eyebrow">A VISUAL JOURNAL FOR YOUR MEALS</p><h2>Your scan history will live here.</h2><p>Upload a food photo to create your first nutrition snapshot. Your image, detected food cues, and macro estimates will be ready whenever you need them.</p><Button className="primary-cta" onClick={() => onNavigate("scan")}><ScanLine size={16} /> Scan your first meal</Button></div> : <><div className="history-summary"><span><strong>{entries.length}</strong> saved scan{entries.length === 1 ? "" : "s"}</span><span className="history-note"><CircleCheck size={14} /> Stored securely with your scan details</span></div><section className="history-grid">{entries.map(entry => <article className="history-card" key={entry.id}><div className="history-image-wrap"><img src={entry.imageUrl} alt={entry.dishName} /><span className="history-confidence">{Math.round(entry.confidence * 100)}% match</span></div><div className="history-card-body"><div className="history-date"><span>{new Date(entry.scannedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span><span>{entry.fileName}</span></div><h3>{entry.dishName}</h3><p>{entry.note}</p><div className="history-macros"><span><strong>{entry.calories}</strong> kcal</span><span><strong>{entry.protein}g</strong> protein</span><span><strong>{entry.carbs}g</strong> carbs</span><span><strong>{entry.fat}g</strong> fat</span></div><div className="detected-tags">{entry.detectedObjects.map((object: string) => <span key={object}>{object}</span>)}</div></div></article>)}</section></>}
  </>;
}

function ScanView({ preview, fileName, result, pending, onFile, onUseCamera, onNavigate, onLog }: { preview: string | null; fileName: string; result: any; pending: boolean; onFile: (file?: File) => void; onUseCamera: () => void; onNavigate: (view: View) => void; onLog: (recipe: any) => void }) {
  const [servedGrams, setServedGrams] = useState("");
  const [remainingGrams, setRemainingGrams] = useState("90");
  const [analysisSaved, setAnalysisSaved] = useState(false);
  useEffect(() => {
    if (!result) return;
    setServedGrams(result.servingWeightGrams == null ? "" : String(result.servingWeightGrams));
    setRemainingGrams(result.servingWeightGrams == null ? "" : "0");
    setAnalysisSaved(false);
  }, [result]);
  const mealAnalysis = trpc.mealAnalysis.create.useMutation({ onSuccess: () => { setAnalysisSaved(true); toast.success("Meal analysis saved", { description: "Your portion and food-waste estimate is in your history." }); } });
  const servedInput = Number(servedGrams);
  const hasServedWeight = Number.isFinite(servedInput) && servedInput > 0;
  const served = hasServedWeight ? servedInput : 0;
  const remaining = hasServedWeight ? Math.min(served, Math.max(0, Number(remainingGrams) || 0)) : 0;
  const consumed = hasServedWeight ? served - remaining : 0;
  const wastePercent = hasServedWeight ? Math.round((remaining / served) * 100) : 0;
  const saveAnalysis = () => { if (!result || !hasServedWeight) return; let openId: string | undefined; try { openId = JSON.parse(localStorage.getItem("nutrition-ai-user") || "null")?.openId; } catch { openId = undefined; } mealAnalysis.mutate({ openId, dishName: result.dishName, servedGrams: served, consumedGrams: consumed, caloriesServed: result.calories, caloriesConsumed: Math.round(result.calories * (consumed / served)), wastePercent }); };
  return <>
    <section className="page-heading"><div><p className="eyebrow accent-text">NUTRIVISION AI</p><h1>See what’s on your plate.</h1><p className="subheading">Upload a food photo for a quick, thoughtful nutrition estimate.</p></div><div className="scan-status"><span className="status-dot" /> Vision beta</div></section>
    <section className="scan-layout"><div className={`scan-dropzone ${preview ? "has-preview" : ""}`}>
      {preview ? <><img src={preview} alt="Uploaded food preview" /><div className="scan-preview-overlay"><span>{fileName}</span><label className="change-photo">Change photo<input type="file" accept="image/*" capture="environment" onChange={event => onFile(event.target.files?.[0])} /></label></div></> : <><div className="scan-orb"><ScanLine size={29} /></div><h2>Drop a meal photo here</h2><p>Our visual nutrition layer will identify the main ingredients and create an estimate you can review.</p><div className="upload-actions"><button type="button" className="upload-label" onClick={onUseCamera}><ScanLine size={16} /> Use camera</button><label className="upload-label secondary-upload"><Upload size={16} /> Choose image<input type="file" accept="image/*" onChange={event => onFile(event.target.files?.[0])} /></label></div><span className="scan-helper">Camera on mobile · JPG, PNG or WEBP · up to 10 MB</span></>}
      {pending && <div className="scan-loading"><span className="loading-pulse" /> Reading your plate...</div>}
    </div><div className="scan-result-card">
      {!result && !pending && <div className="scan-empty"><div className="result-icon"><Sparkles size={20} /></div><p className="eyebrow">YOUR RESULT WILL APPEAR HERE</p><h2>Nutrition, made visible.</h2><p>We’ll show an estimated calorie and macro breakdown, plus the food cues detected in your image.</p><div className="scan-trust"><CircleCheck size={15} /> You stay in control before anything is logged</div></div>}
      {pending && <div className="scan-empty"><div className="result-icon spinning"><Sparkles size={20} /></div><p className="eyebrow">ANALYZING IMAGE</p><h2>Looking for the good stuff.</h2><p>Matching visible food cues to your nutrition library and portion estimates.</p></div>}
      {result && !pending && <div className="scan-result"><div className="result-header"><div><p className="eyebrow">ESTIMATED MATCH <span className="confidence-pill">{Math.round(result.confidence * 100)}% confidence</span></p><h2>{result.dishName}</h2></div><div className="result-icon"><Check size={19} /></div></div><p className="result-note">{result.note}</p><div className="scan-metrics"><div><strong>{result.calories}</strong><span>kcal</span></div><div><strong>{result.protein}g</strong><span>protein</span></div><div><strong>{result.carbs}g</strong><span>carbs</span></div><div><strong>{result.fat}g</strong><span>fat</span></div></div><div className="portion-analysis"><div className="portion-heading"><div><p className="eyebrow">BEFORE & AFTER ANALYSIS</p><h3>How much did you enjoy?</h3><p>Enter served and remaining weights to calculate what you consumed.</p></div><div className={`waste-score ${!hasServedWeight ? "mid-waste" : wastePercent <= 10 ? "low-waste" : wastePercent <= 25 ? "mid-waste" : "high-waste"}`}><strong>{hasServedWeight ? `${wastePercent}%` : "—"}</strong><span>{hasServedWeight ? "food waste" : "enter weights"}</span></div></div><p className="portion-estimate">{result.servingWeightGrams != null ? <>{result.analysisMode === "image_model" ? "Visual weight estimate" : "Model serving estimate"}: <strong>{result.servingWeightGrams} g</strong> served ({result.servingWeightLowGrams}–{result.servingWeightHighGrams} g range). A kitchen scale is required for measured weight.</> : "A photo without a known-size reference cannot provide reliable grams. Enter a kitchen-scale weight below to calculate consumed amounts."}</p><div className="portion-fields"><label>Served portion (g)<Input type="number" min="1" value={servedGrams} onChange={event => setServedGrams(event.target.value)} /></label><label>Remaining after meal (g)<Input type="number" min="0" value={remainingGrams} onChange={event => setRemainingGrams(event.target.value)} /></label></div><div className="portion-summary"><span><strong>{hasServedWeight ? `${consumed}g` : "—"}</strong> consumed</span><span><strong>{hasServedWeight ? Math.round(result.calories * (consumed / served)) : "—"}</strong> kcal consumed</span><button onClick={saveAnalysis} disabled={!hasServedWeight || mealAnalysis.isPending || analysisSaved}>{analysisSaved ? <><Check size={13} /> Saved</> : mealAnalysis.isPending ? "Saving…" : <><Save size={13} /> Save analysis</>}</button></div></div><HealthGuidance result={result} /><p className="eyebrow detected-label">DETECTED CUES</p><div className="detected-tags">{result.detectedObjects.map((object: string) => <span key={object}>{object}</span>)}</div><div className="scan-actions"><Button className="primary-cta" onClick={() => onLog({ id: result.dishName, category: "scanned meal", calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat })}><Plus size={16} /> Add to today</Button><button className="quiet-button" onClick={() => onNavigate("today")}>Review dashboard <ArrowUpRight size={15} /></button></div><p className="scan-source">{result.source} · Values are estimates, not medical advice</p></div>}
    </div></section>
    {result && <section className="scan-summary"><div className="scan-summary-heading"><div><p className="eyebrow">SCAN SUMMARY</p><h2>{result.dishName}</h2></div><span className={`analysis-source ${result.analysisMode === "image_model" ? "source-live" : "source-demo"}`}>{result.analysisMode === "image_model" ? "AI estimate" : result.analysisMode === "local_classifier" ? "Dish match · demo nutrition" : "Demo estimate"}</span></div><div className="scan-summary-weight"><span>{result.servingWeightGrams != null ? "Estimated serving weight" : "Serving weight not estimated"}</span><strong>{result.servingWeightGrams != null ? `${result.servingWeightGrams} g` : "—"}</strong><small>{result.servingWeightGrams != null ? `${result.servingWeightLowGrams}–${result.servingWeightHighGrams} g range` : "Use a kitchen scale for measured grams"}</small></div><div className="scan-summary-nutrients"><div><strong>{result.calories}</strong><span>kcal</span></div><div><strong>{result.protein} g</strong><span>Protein</span></div><div><strong>{result.carbs} g</strong><span>Carbohydrates</span></div><div><strong>{result.fat} g</strong><span>Fat</span></div><div><strong>{result.fiber} g</strong><span>Fiber</span></div></div><p className="scan-summary-note">{result.analysisMode === "image_model" ? "Nutrition and weight are visual estimates, not measured values." : "No image-based weight is available; nutrition values are generic demo estimates, not measured from the image."}</p></section>}
    <section className="scan-benefits"><div><ScanLine size={18} /><strong>Visual cues</strong><p>Recognizes the main ingredients and plate pattern.</p></div><div><Sparkles size={18} /><strong>Useful estimates</strong><p>Turns a photo into a simple, reviewable nutrition snapshot.</p></div><div><CircleCheck size={18} /><strong>Your approval</strong><p>Nothing is added to your day until you choose to log it.</p></div></section>
  </>;
}

function DiscoverView({ recipes, search, setSearch, category, setCategory, diet, setDiet, onLog }: { recipes: any[]; search: string; setSearch: (v: string) => void; category: string; setCategory: (v: string) => void; diet: string; setDiet: (v: string) => void; onLog: (recipe: any) => void }) {
  return <><section className="page-heading"><div><p className="eyebrow accent-text">RECIPE LIBRARY</p><h1>Find your next good meal.</h1><p className="subheading">Thoughtful recipes matched to your preferences, time, and energy.</p></div><div className="saved-count"><span>12</span><small>saved recipes</small></div></section><section className="discover-toolbar"><div className="search-field"><Search size={18} /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search recipes, ingredients, or goals" /></div><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter by meal type"><option>All meals</option><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select><select value={diet} onChange={event => setDiet(event.target.value)} aria-label="Filter by diet"><option>Any diet</option><option>Vegan</option><option>Vegetarian</option><option>Pescatarian</option><option>Omnivore</option></select></section><div className="discover-meta"><span><strong>{recipes.length}</strong> recipes for your table</span><button className="filter-button"><span>Curated for Maya</span> <SlidersHorizontal size={15} /></button></div><section className="recipe-grid">{recipes.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} onLog={onLog} />)}</section>{recipes.length === 0 && <div className="empty-state"><Leaf size={30} /><h3>No recipes found yet</h3><p>Try a broader search or remove one of the filters.</p></div>}<p className="disclaimer"><Sparkles size={13} /> Nutrition values are estimates based on the recipe serving size.</p></>;
}

function PlanView({ data, recipes, onLog }: { data: any; recipes: any[]; onLog: (recipe: any) => void }) {
  const meals = data?.meals ?? [];
  return <><section className="page-heading"><div><p className="eyebrow accent-text">WEEKLY PLAN</p><h1>A little structure, a lot more ease.</h1><p className="subheading">Your plan adapts around your real life — not the other way around.</p></div><Button className="primary-cta"><Sparkles size={16} /> Refresh plan</Button></section><section className="plan-banner"><div><span className="plan-badge">THIS WEEK’S FOCUS</span><h2>More plants, same joy.</h2><p>We’ve nudged fiber up without asking you to give up the flavors you love.</p></div><div className="plan-stat"><strong>4.8</strong><span>days planned</span></div><div className="plan-stat"><strong>82%</strong><span>goal fit</span></div></section><div className="week-tabs"><button className="active">Today <small>24</small></button><button>Wed <small>25</small></button><button>Thu <small>26</small></button><button>Fri <small>27</small></button><button>Sat <small>28</small></button><button>Sun <small>29</small></button></div><section className="content-grid plan-grid"><div className="surface-card plan-meals"><div className="card-heading"><div><p className="eyebrow">TUESDAY, SEP 24</p><h2>Meals that meet you there</h2></div><span className="plan-total">1,980 kcal</span></div>{meals.map((meal: any) => <div className="plan-row" key={meal.id}><div className="plan-time">{meal.time}</div><div className={`plan-thumb accent-${meal.id === "breakfast" ? "berry" : meal.id === "lunch" ? "sage" : "coral"}`}><Leaf size={18} /></div><div className="plan-info"><strong>{meal.title}</strong><span>{meal.label} · {meal.calories || 180} kcal</span></div><button className="plan-check" onClick={() => meal.status !== "logged" && toast.success("Meal marked as ready")}>{meal.status === "logged" ? <Check size={15} /> : <Plus size={16} />}</button></div>)}<button className="add-meal-link" onClick={() => recipes[0] && onLog(recipes[0])}><Plus size={16} /> Add another meal</button></div><div className="surface-card shopping-card"><div className="card-heading"><div><p className="eyebrow">SHOPPING LIST</p><h2>Ready when you are</h2></div><span className="list-count">8 items</span></div><div className="shopping-list">{["Baby greens", "Greek yogurt", "Salmon fillets", "Avocado", "Brown rice", "Mixed berries"].map((item, index) => <label key={item} className="shopping-item"><input type="checkbox" defaultChecked={index === 0 || index === 3} /><span>{item}</span></label>)}</div><button className="text-link">Open full list <ArrowUpRight size={14} /></button></div></section></>;
}

function TasksView({ profile, recipes, onNavigate, onLog }: { profile: any; recipes: any[]; onNavigate: (view: View) => void; onLog: (recipe: any) => void }) {
  const currentWeight = Number(profile?.currentWeightKg ?? profile?.currentWeight ?? 72);
  const targetWeight = Number(profile?.targetWeightKg ?? profile?.targetWeight ?? 65);
  const weightGap = currentWeight - targetWeight;
  const isOverweight = weightGap > 4;
  const isUnderweight = weightGap < -4;

  const tasks = isOverweight ? [
    { title: "Reduce liquid calories", detail: "Cut sugary tea, soda, and large dessert portions. Aim for water, black coffee, or unsweetened tea instead.", impact: "-250 to -400 kcal/day" },
    { title: "Make lunch lighter", detail: "Use a palm-sized protein, 2 fists of vegetables, and half the usual rice or roti portion.", impact: "-300 to -500 kcal/day" },
    { title: "Replace fried snacks", detail: "Swap medu vada, pakoda, or chips for curd, fruit, or roasted chana on most days.", impact: "-200 to -350 kcal/day" },
    { title: "Add a daily walk", detail: "Take a 20–30 minute brisk walk after lunch or dinner, 5 days a week.", impact: "Burn 150–300 kcal" },
  ] : isUnderweight ? [
    { title: "Add a calorie-dense snack", detail: "Have a banana with peanut butter, nuts, or a glass of milk with nuts and dates between meals.", impact: "+300 to +500 kcal/day" },
    { title: "Use protein with every meal", detail: "Add paneer, dal, eggs, yogurt, soy, or chicken to each main meal to support muscle gain.", impact: "+20–35 g protein/day" },
    { title: "Eat every 3–4 hours", detail: "Keep 3 solid meals and 2 snacks to create a steady calorie surplus without feeling too full.", impact: "+400 to +700 kcal/day" },
    { title: "Strength train 3x a week", detail: "Focus on compound lifts or bodyweight training to turn extra calories into lean mass, not just fat.", impact: "Build muscle + recovery" },
  ] : [
    { title: "Stay steady", detail: "Keep balanced meals with protein, fiber, and a consistent amount of carbs and healthy fats.", impact: "Maintain weight" },
    { title: "Monitor your routine", detail: "Track the portion sizes and meal timing that keep your energy and appetite stable.", impact: "Consistency" },
    { title: "Keep a protein anchor", detail: "Include dal, paneer, eggs, yogurt, or chicken in each meal so your intake stays satisfying and balanced.", impact: "Stable recovery" },
  ];

  const statusLabel = isOverweight ? "Weight loss tasks" : isUnderweight ? "Weight gain tasks" : "Maintenance tasks";
  const summary = isOverweight ? `You are ${Math.abs(weightGap).toFixed(1)} kg above your target weight. Focus on gentle calorie reduction without starving your energy.` : isUnderweight ? `You are ${Math.abs(weightGap).toFixed(1)} kg below your target weight. Focus on calorie-dense meals and recovery.` : "Your weight is close to your target. Keep your routine steady and protein-focused.";

  return <>
    <section className="page-heading"><div><p className="eyebrow accent-text">TASKS</p><h1>{statusLabel}</h1><p className="subheading">Practical steps to match your body goal and daily routine.</p></div><Button className="primary-cta" onClick={() => onNavigate("discover")}><Plus size={17} /> Add a meal</Button></section>
    <section className="surface-card" style={{ padding: 22, marginBottom: 18 }}>
      <div className="card-heading"><div><p className="eyebrow">YOUR GOAL</p><h2>{summary}</h2></div><span className="trend-pill">{currentWeight} kg → {targetWeight} kg</span></div>
    </section>
    <section className="content-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
      {tasks.map(task => <article key={task.title} className="surface-card" style={{ padding: 18 }}>
        <div className="card-heading"><div><p className="eyebrow">TASK</p><h3>{task.title}</h3></div><span className="trend-pill">{task.impact}</span></div>
        <p style={{ marginTop: 12, color: "#5f6f67", lineHeight: 1.6 }}>{task.detail}</p>
      </article>)}
    </section>
    <section className="content-grid two-col" style={{ marginTop: 20 }}>
      <div className="surface-card" style={{ padding: 18 }}>
        <div className="card-heading"><div><p className="eyebrow">FOOD IDEAS</p><h2>Easy choices</h2></div></div>
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {(isOverweight ? ["Idli with sambar", "Vegetable poha", "Dal chawal bowl", "Curd with fruit"] : isUnderweight ? ["Paneer bhuna with roti", "Masala dosa with upma", "Vegetable biryani", "Smoothie with banana + nuts"] : ["Balanced thali", "Dal + rice + sabzi", "Idli + chutney", "Paneer and salad"]).map(item => <button key={item} onClick={() => recipes[0] && onLog(recipes[0])} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, background: "rgba(15,23,42,0.03)", border: "1px solid rgba(148,163,184,0.2)", color: "#1f2937", fontWeight: 600, cursor: "pointer" }}>{item}</button>)}
        </div>
      </div>
      <div className="surface-card" style={{ padding: 18 }}>
        <div className="card-heading"><div><p className="eyebrow">SMART REMINDERS</p><h2>Keep momentum</h2></div></div>
        <div style={{ display: "grid", gap: 10, marginTop: 14, color: "#374151" }}>
          <div><strong>1.</strong> Check your portion before the second serving.</div>
          <div><strong>2.</strong> Eat protein and fiber at every main meal.</div>
          <div><strong>3.</strong> Aim for 6–8 glasses of water and sleep well.</div>
          <div><strong>4.</strong> Keep small wins consistent for 2–3 weeks.</div>
        </div>
      </div>
    </section>
  </>;
}

function CoachView({ messages, prompt, setPrompt, onSend, pending }: { messages: { role: string; text: string }[]; prompt: string; setPrompt: (v: string) => void; onSend: (prompt?: string) => void; pending: boolean }) {
  return <><section className="page-heading"><div><p className="eyebrow accent-text">YOUR NUTRITION COACH</p><h1>Ask better questions. Feel more supported.</h1><p className="subheading">A thoughtful space for practical, judgment-free nutrition guidance.</p></div><div className="coach-available"><span className="status-dot" /> Coach online</div></section><section className="coach-shell"><div className="coach-intro"><div className="coach-orb"><Sparkles size={26} /></div><p className="eyebrow">NUTRIAI COACH</p><h2>What would make today easier?</h2><p>Ask about a meal, a craving, your plan, or one small habit you’d like to build.</p><div className="prompt-chips"><button onClick={() => onSend("How can I get more protein today?")}>How can I get more protein?</button><button onClick={() => onSend("What is a good snack right now?")}>What’s a good snack?</button><button onClick={() => onSend("Help me balance dinner")}>Help me balance dinner</button></div></div><div className="chat-panel"><div className="chat-header"><div className="chat-avatar"><Sparkles size={17} /></div><div><strong>NutriAI</strong><span>Grounded in your plan</span></div><span className="status-dot" /></div><div className="chat-messages">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>{message.role === "assistant" && <div className="chat-mini-avatar"><Sparkles size={12} /></div>}<div className="message-bubble">{message.text}</div></div>)}{pending && <div className="chat-message assistant"><div className="chat-mini-avatar"><Sparkles size={12} /></div><div className="message-bubble typing"><span /><span /><span /></div></div>}</div><div className="chat-composer"><Textarea value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} placeholder="Ask anything about your day..." rows={2} /><button onClick={() => onSend()} disabled={!prompt.trim() || pending} aria-label="Send message"><Send size={17} /></button></div><p className="chat-disclaimer">General nutrition information only · Not medical advice</p></div></section></>;
}
