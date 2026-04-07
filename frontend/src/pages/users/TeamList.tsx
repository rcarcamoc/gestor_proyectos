import { type FC, useState } from "react";
import { Users, Mail, Shield, UserPlus, MoreVertical, X, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

// Mock data to demonstrate UI
const INITIAL_TEAM = [
  { id: 1, name: "Admin User", email: "admin@smarttrack.com", role: "Owner", status: "Active", avatar: "AU" },
  { id: 2, name: "Maria Garcia", email: "maria@smarttrack.com", role: "Leader", status: "Active", avatar: "MG" },
  { id: 3, name: "John Smith", email: "john@smarttrack.com", role: "Member", status: "Away", avatar: "JS" },
  { id: 4, name: "Ana Martinez", email: "ana@smarttrack.com", role: "Member", status: "Offline", avatar: "AM" },
];

export const TeamList: FC = () => {
  const [team, setTeam] = useState(INITIAL_TEAM);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Member");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    // Show success message briefly
    setShowSuccess(true);

    // Add mock user
    const newUser = {
      id: Date.now(),
      name: inviteEmail.split("@")[0], // Mock name based on email
      email: inviteEmail,
      role: inviteRole,
      status: "Offline", // Starts offline
      avatar: inviteEmail.substring(0, 2).toUpperCase()
    };

    setTeam([...team, newUser]);

    setTimeout(() => {
      setShowSuccess(false);
      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteRole("Member");
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-base flex items-center gap-2">
            <Users className="text-accent-yellow" size={24} />
            Users & Team
          </h2>
          <p className="text-sm text-text-muted mt-1">Manage team members and access roles.</p>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-text-base border border-white/20 rounded-md text-sm font-medium hover:bg-white/20 transition-all hover:scale-105"
        >
          <UserPlus size={16} />
          Invite User
        </button>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {team.map((member) => (
          <div key={member.id} className="glass-card p-6 flex flex-col items-center text-center group relative overflow-hidden">
            {/* Background glowing orb */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors pointer-events-none" />

            <button className="absolute top-4 right-4 text-text-muted hover:text-text-base transition-colors p-1 rounded-full hover:bg-white/10 z-20">
              <MoreVertical size={18} />
            </button>

            {/* Avatar */}
            <div className="relative mb-4 z-10 mt-2">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-surface to-border/80 border border-border/50 flex items-center justify-center text-2xl font-bold text-text-base shadow-lg">
                {member.avatar}
              </div>
              <div className={cn(
                "absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#09090b]",
                member.status === "Active" ? "bg-accent-green" :
                member.status === "Away" ? "bg-accent-yellow" : "bg-text-muted/50"
              )} />
            </div>

            {/* Details */}
            <h3 className="text-lg font-semibold text-text-base relative z-10">{member.name}</h3>
            <p className="text-sm text-text-muted mb-4 relative z-10 flex items-center gap-1.5 justify-center">
              <Mail size={12} />
              {member.email}
            </p>

            <div className="mt-auto w-full pt-4 border-t border-border/50 flex justify-between items-center relative z-10 text-sm">
              <span className="flex items-center gap-1.5 text-text-muted">
                <Shield size={14} className={member.role === "Owner" ? "text-accent-red" : "text-text-muted"} />
                {member.role}
              </span>
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-md",
                member.status === "Active" ? "bg-accent-green/10 text-accent-green" :
                member.status === "Away" ? "bg-accent-yellow/10 text-accent-yellow" :
                "bg-surface text-text-muted border border-border/50"
              )}>
                {member.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-md p-4">
          <div className="glass-card w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-300 border border-border/50">
            <button
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-base transition-colors p-2"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-text-base mb-6 flex items-center gap-2">
              <UserPlus size={20} className="text-accent-yellow" />
              Invite Team Member
            </h2>

            {showSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
                <CheckCircle2 size={48} className="text-accent-green mb-4" />
                <h3 className="text-lg font-medium text-text-base">Invitation Sent!</h3>
                <p className="text-text-muted text-sm mt-1">An email has been sent to {inviteEmail}</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow outline-none text-text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow outline-none text-text-base appearance-none"
                  >
                    <option value="Member" className="bg-surface text-text-base">Member</option>
                    <option value="Leader" className="bg-surface text-text-base">Leader</option>
                    <option value="Owner" className="bg-surface text-text-base">Owner</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 mt-4 bg-accent-yellow text-background font-bold rounded-xl hover:bg-accent-yellow/90 transition-all hover:-translate-y-0.5"
                >
                  Send Invitation
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
