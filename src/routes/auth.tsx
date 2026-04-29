import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");

  useEffect(() => {
    if (!user) return;
    navigate({ to: "/dashboard" });
  }, [navigate, user]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast.error(error);
    else {
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName, shopName);
    setLoading(false);
    if (error) toast.error(error);
    else {
      toast.success("Account created — signing you in");
      const { error: signInError } = await signIn(email, password);
      if (!signInError) navigate({ to: "/dashboard" });
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left — workshop panel */}
      <div className="hidden lg:flex relative bg-sidebar text-sidebar-foreground p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-[0.07]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">SparePilot</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
                Workshop OS
              </div>
            </div>
          </div>
        </div>

        <div className="relative space-y-6 max-w-md">
          <div className="inline-block px-2 py-1 rounded-sm bg-primary/15 text-primary text-[10px] uppercase tracking-[0.18em] font-semibold">
            Built for Automobiles
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Bill in seconds.<br />
            Track every part, every rupees.
          </h1>
          <p className="text-sidebar-foreground/70 leading-relaxed">
            Inventory, GST invoicing, udhaar tracking and supplier payments —
            calibrated for the speed of a real spare parts counter.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-sidebar-border">
            {[
              { k: "<30s", v: "per invoice" },
              { k: "1000+", v: "parts handled" },
              { k: "0₹", v: "stock errors" },
            ].map((s) => (
              <div key={s.k}>
                <div className="text-2xl font-bold text-primary num">{s.k}</div>
                <div className="text-xs text-sidebar-foreground/60 mt-0.5">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-sidebar-foreground/50">
          v1.0 · Workshop-grade reliability
        </div>
      </div>

      {/* Right — auth */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
              <Wrench className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">SparePilot</span>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
                <p className="text-sm text-muted-foreground mt-1">Sign in to your shop dashboard.</p>
              </div>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" placeholder="you@shop.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Set up your shop</h2>
                <p className="text-sm text-muted-foreground mt-1">First account becomes the shop admin.</p>
              </div>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Your name</Label>
                    <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="shopName">Shop name</Label>
                    <Input id="shopName" required value={shopName} onChange={(e) => setShopName(e.target.value)} className="h-11" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password-up">Password (min 8)</Label>
                  <Input id="password-up" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
