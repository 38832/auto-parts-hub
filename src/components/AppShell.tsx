import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  Truck,
  ShoppingCart,
  LogOut,
  Wrench,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/billing", label: "New Invoice", icon: Receipt },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/invoices", label: "Invoices", icon: ShoppingCart },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">SparePilot</span>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-md hover:bg-sidebar-accent"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:sticky top-0 left-0 z-30 h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="hidden md:flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Wrench className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">SparePilot</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/60">
              Workshop OS
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 mt-14 md:mt-0 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to ||
              (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r" />
                )}
                <Icon className="h-[18px] w-[18px]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div className="px-2 py-1.5 text-xs">
            <div className="truncate text-sidebar-foreground/90">{user?.email}</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-primary mt-0.5">
              {role ?? "loading…"}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="flex-1 min-w-0 mt-14 md:mt-0">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
