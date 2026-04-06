import { type FC, useState } from "react";
import { User, Lock, Palette, Save, AlertCircle, CheckCircle2, Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export const SettingsPage: FC = () => {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "appearance">("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { theme, toggleTheme } = useTheme();

  const handleSave = () => {
    setIsSaving(true);
    // Mock save delay
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage({ type: "success", text: "Settings saved successfully!" });
      setTimeout(() => setSaveMessage(null), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-base mb-1">Settings</h2>
        <p className="text-sm text-text-muted">Manage your account preferences and site configuration.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 space-y-1">
          {[
            { id: "profile", icon: User, label: "Profile Information" },
            { id: "security", icon: Lock, label: "Password & Security" },
            { id: "appearance", icon: Palette, label: "Appearance" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                activeTab === tab.id
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-text-muted hover:bg-white/5 hover:text-text-base"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="glass-card p-8 border border-border/50 rounded-2xl relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            {/* Success/Error Message */}
            {saveMessage && (
              <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm animate-fade-in border ${
                saveMessage.type === "success"
                  ? "bg-green-500/10 text-green-500 border-green-500/20"
                  : "bg-red-500/10 text-red-500 border-red-500/20"
              }`}>
                {saveMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {saveMessage.text}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="space-y-6 animate-fade-in relative z-10">
                <h3 className="text-lg font-semibold text-text-base mb-4">Personal Details</h3>

                <div className="flex items-center gap-6 mb-8">
                  <div className="w-20 h-20 rounded-full bg-surface border-2 border-border/50 flex items-center justify-center text-2xl font-bold text-text-muted">
                    U
                  </div>
                  <button className="px-4 py-2 bg-surface text-text-base border border-border/50 rounded-lg text-sm hover:bg-surface-hover transition-colors">
                    Upload Avatar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Full Name</label>
                    <input type="text" defaultValue="Admin User" className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-base transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Email Address</label>
                    <input type="email" defaultValue="admin@smarttrack.com" className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-base transition-all" />
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6 animate-fade-in relative z-10">
                <h3 className="text-lg font-semibold text-text-base mb-4">Change Password</h3>

                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Current Password</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-base transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">New Password</label>
                    <input type="password" placeholder="Min 8 characters" className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-base transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Confirm New Password</label>
                    <input type="password" placeholder="Min 8 characters" className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-base transition-all" />
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <div className="space-y-6 animate-fade-in relative z-10">
                <h3 className="text-lg font-semibold text-text-base mb-4">Theme Preferences</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                  <div
                    onClick={() => theme !== 'dark' && toggleTheme()}
                    className={`cursor-pointer border-2 rounded-xl p-4 flex items-center justify-between transition-all ${
                      theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border/50 bg-surface/50 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Moon size={20} className={theme === 'dark' ? 'text-primary' : 'text-text-muted'} />
                      <div>
                        <h4 className="text-text-base font-medium">Dark Mode</h4>
                        <p className="text-xs text-text-muted mt-1">Sleek glassmorphism</p>
                      </div>
                    </div>
                    {theme === 'dark' && <div className="w-4 h-4 rounded-full bg-primary ring-2 ring-offset-2 ring-offset-surface ring-primary" />}
                  </div>

                  <div
                    onClick={() => theme !== 'light' && toggleTheme()}
                    className={`cursor-pointer border-2 rounded-xl p-4 flex items-center justify-between transition-all ${
                      theme === 'light' ? 'border-primary bg-primary/10' : 'border-border/50 bg-surface/50 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Sun size={20} className={theme === 'light' ? 'text-primary' : 'text-text-muted'} />
                      <div>
                        <h4 className="text-text-base font-medium">Light Mode</h4>
                        <p className="text-xs text-text-muted mt-1">Clean and professional</p>
                      </div>
                    </div>
                    {theme === 'light' && <div className="w-4 h-4 rounded-full bg-primary ring-2 ring-offset-2 ring-offset-surface ring-primary" />}
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-10 pt-6 border-t border-border/50 flex justify-end relative z-10">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5 min-w-[120px] justify-center"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
