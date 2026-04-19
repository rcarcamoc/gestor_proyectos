import { type FC, type ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../context/LanguageContext";
import api from "../../api/axios";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  Send
} from "lucide-react";
import { cn } from "../../lib/utils";
import ChatAssistant from "../ChatAssistant";

interface DashboardLayoutProps {
  children: ReactNode;
  userRole?: "owner" | "leader" | "member";
  userName?: string;
}

export const DashboardLayout: FC<DashboardLayoutProps> = ({
  children
}) => {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const userRole = user?.role || "member";
  const userName = user?.full_name || "User";

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications/");
      setNotifications(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Polling cada 30s
    return () => clearInterval(interval);
  }, []);

  const markAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      fetchNotifications();
    } catch (e) { console.error(e); }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const navItems = [
    { name: t('dashboard'), path: "/", icon: LayoutDashboard },
    { name: t('projects'), path: "/projects", icon: FolderKanban },
    { name: t('tasks'), path: "/tasks", icon: CheckSquare },
    ...(userRole === "owner" || userRole === "leader"
        ? [{ name: t('users_team'), path: "/users", icon: Users }]
        : []),
    { name: "Telegram Bot", path: "/vincular", icon: Send },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border/50 bg-surface/80 backdrop-blur-xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
              P
            </div>
            <span className="text-lg font-semibold tracking-tight text-text-base">ProManage</span>
          </div>
          <button
            className="md:hidden text-text-muted hover:text-text-base"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "text-primary bg-primary/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-primary/30"
                    : "text-text-muted hover:text-text-base hover:bg-white/5 border border-transparent"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                )}
                <Icon size={18} className={cn("transition-colors", isActive ? "text-primary" : "group-hover:text-text-base")} />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50 space-y-1">
          <Link to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-text-muted hover:text-text-base hover:bg-white/5 transition-all">
            <Settings size={18} />
            <span className="font-medium text-sm">{t('settings')}</span>
          </Link>
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-danger hover:bg-danger/10 transition-all text-left"
          >
            <LogOut size={18} />
            <span className="font-medium text-sm">{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Background ambient glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[100px] pointer-events-none translate-y-1/2" />

        {/* Topbar */}
        <header className="h-16 flex-shrink-0 border-b border-border/50 bg-surface/30 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden text-text-muted hover:text-text-base"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-semibold text-text-base hidden sm:block">
              {navItems.find(i => i.path === location.pathname)?.name || t('dashboard')}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-surface/50 p-1 rounded-xl border border-border/50">
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-bold transition-all",
                  language === 'en' ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text-base"
                )}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-bold transition-all",
                  language === 'es' ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text-base"
                )}
              >
                ES
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) fetchNotifications();
                }}
                className="relative p-2 text-text-muted hover:text-text-base transition-colors rounded-full hover:bg-white/5"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-surface border border-border/50 rounded-xl shadow-2xl overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-border/50 flex justify-between items-center bg-surface/50">
                    <h3 className="font-bold text-sm text-text-base">{t('notifications')}</h3>
                    <button onClick={markAllRead} className="text-[10px] text-primary hover:underline uppercase font-bold">{t('mark_all_read')}</button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-text-muted text-xs">{t('no_notifications')}</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={cn("p-4 border-b border-border/10 hover:bg-white/5 transition-colors cursor-pointer", !n.is_read && "bg-primary/5")}>
                           <p className={cn("text-xs", !n.is_read ? "text-text-base font-semibold" : "text-text-muted")}>{n.message}</p>
                           <span className="text-[10px] text-text-muted mt-1 block">{new Date(n.created_at).toLocaleTimeString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-8 w-px bg-border/50" />

            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="text-right hidden sm:block text-sm">
                <p className="font-medium text-text-base group-hover:text-primary transition-colors">{userName}</p>
                <p className="text-text-muted text-xs uppercase tracking-wider">{userRole}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent border-2 border-surface p-0.5 shadow-lg group-hover:shadow-primary/20 transition-all">
                <div className="w-full h-full rounded-full bg-surface/50 backdrop-blur-sm flex items-center justify-center text-text-base text-sm font-bold">
                  {userName.charAt(0)}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6 z-10 relative">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </div>
        <ChatAssistant />
      </main>
    </div>
  );
};
