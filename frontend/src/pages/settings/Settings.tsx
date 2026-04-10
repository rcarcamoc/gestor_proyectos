import { type FC, useState, useEffect } from "react";
import { User, Lock, Palette, Save, AlertCircle, CheckCircle2, Moon, Sun, Star } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

export const SettingsPage: FC = () => {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "appearance" | "skills" | "manage_skills">("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "leader";

  const [availableSkills, setAvailableSkills] = useState<{id: number, name: string}[]>([]);
  const [mySkills, setMySkills] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === "skills" || activeTab === "manage_skills") {
      api.get("/skills/").then(res => setAvailableSkills(res.data)).catch(console.error);
    }
    if (activeTab === "skills") {
      api.get("/skills/my-skills").then(res => setMySkills(res.data)).catch(console.error);
    }
  }, [activeTab]);

  const addSkill = async (skill_id: number, level: string) => {
    try {
      await api.post("/skills/my-skills", { skill_id, level });
      api.get("/skills/my-skills").then(res => setMySkills(res.data));
    } catch (err) {
      console.error(err);
    }
  };

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
            { id: "skills", icon: Star, label: "My Skills" },
            ...(isAdmin ? [{ id: "manage_skills", icon: Palette, label: "Manage Skills (Admin)" }] : [])
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
                    <input type="text" defaultValue="Admin User" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-base transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Email Address</label>
                    <input type="email" defaultValue="admin@smarttrack.com" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-base transition-all shadow-sm" />
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
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-base placeholder:text-text-muted/50 transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">New Password</label>
                    <input type="password" placeholder="Min 8 characters" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-base placeholder:text-text-muted/50 transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Confirm New Password</label>
                    <input type="password" placeholder="Min 8 characters" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-base placeholder:text-text-muted/50 transition-all shadow-sm" />
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

            {/* Skills Tab */}
            {activeTab === "skills" && (
              <div className="space-y-6 animate-fade-in relative z-10">
                <h3 className="text-lg font-semibold text-text-base mb-4">My Skills (Engine Configuration)</h3>
                <p className="text-sm text-text-muted mb-6">Declare your skills to help the Smart Engine assign you relevant tasks.</p>

                <div className="bg-surface p-6 rounded-xl border border-border/50">
                   <h4 className="font-semibold text-sm mb-4">Add a new skill</h4>
                   <div className="flex items-center gap-4">
                     <select id="skillSelect" className="flex-1 px-4 py-2 rounded-lg bg-surface border border-border text-text-base">
                        {availableSkills.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                     </select>
                     <select id="levelSelect" className="w-40 px-4 py-2 rounded-lg bg-surface border border-border text-text-base">
                        <option value="basic">Basic</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                     </select>
                     <button onClick={() => {
                        const sid = parseInt((document.getElementById('skillSelect') as HTMLSelectElement).value);
                        const lvl = (document.getElementById('levelSelect') as HTMLSelectElement).value;
                        if (sid) addSkill(sid, lvl);
                     }} className="px-4 py-2 bg-primary text-white rounded-lg font-bold">Add</button>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {mySkills.map(skill => (
                    <div key={skill.id} className="p-4 rounded-xl border border-border/50 bg-surface flex justify-between items-center">
                       <div>
                         <h5 className="font-bold text-text-base">{skill.skill_name}</h5>
                         <span className="text-xs text-text-muted capitalize">{skill.level}</span>
                       </div>
                       <div>
                         {skill.validated ? (
                            <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded border border-green-500/20">Validated</span>
                         ) : (
                            <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded border border-yellow-500/20">Self Declared</span>
                         )}
                       </div>
                    </div>
                  ))}
                  {mySkills.length === 0 && (
                     <div className="col-span-full py-8 text-center text-text-muted">No skills declared yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* Manage Skills Tab (Admin Only) */}
            {activeTab === "manage_skills" && (
              <div className="space-y-6 animate-fade-in relative z-10">
                 <h3 className="text-lg font-semibold text-text-base mb-4">Core Skills Administrator</h3>
                 <p className="text-sm text-text-muted">Define and manage the global skills list used by the Smart Engine.</p>

                 <div className="bg-surface p-6 rounded-xl border border-border/50">
                    <h4 className="font-semibold text-sm mb-4">Create New Skill</h4>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <input id="newSkillName" type="text" placeholder="e.g. Docker, Python, Architecture" className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary outline-none text-text-base" />
                      <input id="newSkillCategory" type="text" placeholder="Category (e.g. Backend)" className="w-full sm:w-48 px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary outline-none text-text-base" />
                      <button onClick={async () => {
                         const name = (document.getElementById('newSkillName') as HTMLInputElement).value;
                         const category = (document.getElementById('newSkillCategory') as HTMLInputElement).value;
                         if (!name) return;
                         try {
                            await api.post("/skills/", { name, category });
                            setSaveMessage({ type: "success", text: "Skill created successfully!" });
                            api.get("/skills/").then(res => setAvailableSkills(res.data));
                            (document.getElementById('newSkillName') as HTMLInputElement).value = "";
                            (document.getElementById('newSkillCategory') as HTMLInputElement).value = "";
                         } catch (e) {
                            setSaveMessage({ type: "error", text: "Error creating skill" });
                         }
                      }} className="px-6 py-2.5 bg-secondary text-white rounded-xl font-bold shadow-md shadow-secondary/20">Create Skill</button>
                    </div>
                 </div>

                 <div className="overflow-hidden rounded-xl border border-border/50">
                    <table className="w-full text-left bg-surface/30">
                       <thead className="bg-surface/50 text-xs uppercase text-text-muted">
                          <tr>
                             <th className="px-6 py-3 font-semibold">Skill Name</th>
                             <th className="px-6 py-3 font-semibold">Category</th>
                             <th className="px-6 py-3 font-semibold text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-border/50">
                          {availableSkills.map(s => (
                             <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-text-base">{s.name}</td>
                                <td className="px-6 py-4 text-sm text-text-muted">{s.category || '-'}</td>
                                <td className="px-6 py-4 text-right">
                                   <button onClick={async () => {
                                      if (confirm(`Deactivate ${s.name}?`)) {
                                         await api.delete(`/skills/${s.id}`);
                                         api.get("/skills/").then(res => setAvailableSkills(res.data));
                                      }
                                   }} className="text-accent-red hover:underline text-xs">Delete</button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
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
