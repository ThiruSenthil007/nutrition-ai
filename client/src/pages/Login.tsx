import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Leaf, LockKeyhole, Mail, Phone, ShieldCheck, Sparkles, UserRound, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

type Mode = "login" | "signup";
type Step = "details" | "otp";

export default function Login() {
  const [, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path === "/" ? "/home" : path);
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("details");
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [destination, setDestination] = useState("");
  const [demoCode, setDemoCode] = useState<string | undefined>();
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", dateOfBirth: "", age: "", identifier: "" });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nutrition-ai-user");
      if (saved && JSON.parse(saved)?.openId) {
        navigate("/");
      }
    } catch {}
  }, []);

  const quickEnter = () => {
    const demoUser = {
      openId: "local:thiru@nutriai.app",
      name: "Thiru",
      email: "thiru@nutriai.app",
      phone: "+1 555 0199",
      dateOfBirth: "2000-01-01",
      age: 26,
      goalCalories: 2050,
      goalProtein: 120,
      goalCarbs: 220,
      goalFat: 70,
    };
    localStorage.setItem("nutrition-ai-user", JSON.stringify(demoUser));
    toast.success("Welcome to NutriAI, Thiru!");
    navigate("/");
  };

  const requestOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: result => {
      setChallengeId(result.challengeId);
      setDestination(result.maskedDestination);
      setDemoCode(result.demoCode);
      if (result.demoCode) {
        setOtp(result.demoCode);
      }
      setStep("otp");
      toast.success("Verification code sent", { description: `Check ${result.maskedDestination}.` });
    },
    onError: error => toast.error("Could not start verification", { description: error.message }),
  });
  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: result => {
      localStorage.setItem("nutrition-ai-user", JSON.stringify(result.user));
      const userName = typeof (result.user as any)?.name === "string" ? ((result.user as any).name as string).trim() : "";
      toast.success("You’re in", { description: `Welcome${userName ? `, ${userName.split(" ")[0]}` : " back"}.` });
      navigate("/");
    },
    onError: error => toast.error("That code did not work", { description: error.message }),
  });

  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setStep("details");
    setDemoCode(undefined);
    setOtp("");
  };
  const request = (event?: FormEvent) => {
    event?.preventDefault();
    const identifier = mode === "login" ? form.identifier.trim() : form.email.trim();
    requestOtp.mutate({
      mode,
      identifier,
      name: mode === "signup" ? form.name.trim() : undefined,
      email: mode === "signup" ? form.email.trim() : undefined,
      phone: mode === "signup" ? form.phone.trim() : undefined,
      dateOfBirth: mode === "signup" ? form.dateOfBirth : undefined,
      age: mode === "signup" ? Number(form.age) : undefined,
    });
  };
  const verify = (event: FormEvent) => {
    event.preventDefault();
    if (!challengeId) return;
    verifyOtp.mutate({ challengeId, code: otp });
  };

  return <div className="auth-page">
    <section className="auth-story"><div className="auth-brand"><img className="brand-logo auth-brand-logo" src="/image.png" alt="NutriVision AI" /></div><div className="auth-story-content"><p className="eyebrow auth-eyebrow">A calmer way to care for yourself</p><h1>Small steps.<br /><em>More of you.</em></h1><p>Save your food scans, keep your nutrition history close, and build a rhythm that fits your real life.</p><div className="auth-proof"><div className="proof-icon"><Sparkles size={17} /></div><div><strong>Your data, in your hands.</strong><span>Secure account access with one-time verification.</span></div></div></div><div className="auth-story-footer"><span><Check size={14} /> Personalized workspace</span><span><Check size={14} /> No passwords to remember</span></div></section>
    <main className="auth-main"><button className="auth-back" onClick={() => navigate("/")}><ArrowLeft size={15} /> Back to NutriAI</button><div className="auth-card">{step === "details" ? <><div className="auth-heading"><div><p className="eyebrow accent-text">WELCOME TO NUTRIAI</p><h2>{mode === "login" ? "Welcome back." : "Create your account."}</h2><p>{mode === "login" ? "Sign in to pick up your nutrition rhythm." : "Set up your personal workspace in under a minute."}</p></div><div className="auth-lock"><LockKeyhole size={17} /></div></div><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Sign in</button><button className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Create account</button></div><form onSubmit={request} className="auth-form">{mode === "login" ? <><label>Email or phone number<span className="input-with-icon"><Mail size={16} /><Input value={form.identifier} onChange={event => update("identifier", event.target.value)} placeholder="you@example.com" autoComplete="username" required /></span></label><p className="auth-helper"><ShieldCheck size={14} /> We’ll send a secure one-time code. No password required.</p></> : <><div className="form-grid"><label>Full name<span className="input-with-icon"><UserRound size={16} /><Input value={form.name} onChange={event => update("name", event.target.value)} placeholder="Thiru" autoComplete="name" required /></span></label><label>Phone number<span className="input-with-icon"><Phone size={16} /><Input value={form.phone} onChange={event => update("phone", event.target.value)} placeholder="+1 555 000 0000" autoComplete="tel" required /></span></label></div><label>Email address<span className="input-with-icon"><Mail size={16} /><Input type="email" value={form.email} onChange={event => update("email", event.target.value)} placeholder="you@example.com" autoComplete="email" required /></span></label><div className="form-grid"><label>Date of birth<Input type="date" value={form.dateOfBirth} onChange={event => update("dateOfBirth", event.target.value)} required /></label><label>Age<Input type="number" min="13" max="110" value={form.age} onChange={event => update("age", event.target.value)} placeholder="28" required /></label></div><p className="auth-helper"><ShieldCheck size={14} /> Your details personalize your nutrition experience.</p></>}<Button className="auth-submit" type="submit" disabled={requestOtp.isPending}>{requestOtp.isPending ? "Sending code…" : mode === "login" ? "Send login code" : "Create account & send code"}<ArrowRight size={16} /></Button><div style={{ margin: "14px 0 6px", textAlign: "center", fontSize: "12px", opacity: 0.7 }}>— or skip verification —</div><Button type="button" variant="outline" className="w-full" onClick={quickEnter} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontWeight: 600, width: "100%", padding: "10px", borderRadius: "10px" }}><Zap size={15} style={{ color: "#10b981" }} /> Instant Demo Access</Button></form></> : <><button className="auth-step-back" onClick={() => setStep("details")}><ArrowLeft size={14} /> Edit details</button><div className="otp-heading"><div className="otp-badge"><ShieldCheck size={21} /></div><p className="eyebrow accent-text">ONE-TIME VERIFICATION</p><h2>Check your messages.</h2><p>Enter the 6-digit code sent to <strong>{destination}</strong>.</p></div><form onSubmit={verify} className="auth-form otp-form"><label>Verification code<Input className="otp-input" value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} required /></label>{demoCode && <div className="demo-code" onClick={() => setOtp(demoCode)} style={{ cursor: "pointer" }} title="Click to insert code"><span>Preview code (Click to auto-fill)</span><strong>{demoCode}</strong></div>}<Button className="auth-submit" type="submit" disabled={verifyOtp.isPending || otp.length !== 6}>{verifyOtp.isPending ? "Verifying…" : "Confirm & continue"}<ArrowRight size={16} /></Button><div style={{ margin: "10px 0 4px", textAlign: "center", fontSize: "12px", opacity: 0.7 }}>— or enter instantly —</div><Button type="button" variant="outline" className="w-full" onClick={quickEnter} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontWeight: 600, width: "100%", padding: "10px", borderRadius: "10px" }}><Zap size={15} style={{ color: "#10b981" }} /> Skip to App (Instant)</Button><button type="button" className="resend-button" onClick={() => request()}>{requestOtp.isPending ? "Sending…" : "Resend code"}<ChevronRight size={14} /></button></form></>}</div><p className="auth-legal">By continuing, you agree to NutriAI’s general wellness terms. NutriAI is not medical advice.</p></main>
  </div>;
}
