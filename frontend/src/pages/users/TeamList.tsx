import { type FC, useState, useEffect } from "react";
import { Users, Mail, Shield, UserPlus, MoreVertical, X, CheckCircle2 } from "lucide-react";
import api from "../../api/axios";

export const TeamList: FC = () => {
  const [team, setTeam] = useState<any[]>([]);
  const [currentTeamId, setCurrentTeamId] = useState<number | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sendInvite, setSendInvite] = useState(true);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<{skill_id: number, level: string}[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [roleEditUser, setRoleEditUser] = useState<number | null>(null);

  const fetchMembers = async (tid: number) => {
    try {
      const res = await api.get(`/teams/${tid}/members`);
      setTeam(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    api.get("/teams/").then(res => {
      if (res.data.length > 0) {
        setCurrentTeamId(res.data[0].id);
        fetchMembers(res.data[0].id);
      }
    });
    api.get("/skills/").then(res => setAvailableSkills(res.data));
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName || !currentTeamId) return;

    try {
      await api.post(`/teams/${currentTeamId}/members`, { 
          email: inviteEmail, 
          full_name: inviteName,
          role: inviteRole,
          send_invite: sendInvite,
          skills: selectedSkills
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsInviteModalOpen(false);
        setInviteEmail("");
        setInviteName("");
        setInviteRole("member");
        setSelectedSkills([]);
        if (currentTeamId) fetchMembers(currentTeamId);
      }, 1500);
    } catch (err) {
      console.error(err);
      alert("Error adding member");
    }
  };

  const handleChangeRole = async (user_id: number, new_role: string) => {
    try {
      await api.patch(`/teams/members/${user_id}`, { role: new_role });
      setRoleEditUser(null);
      if (currentTeamId) fetchMembers(currentTeamId);
    } catch (err) {
      console.error(err);
      alert("Error updating role");
    }
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {team.map((member) => (
          <div key={member.user_id} className="glass-card p-6 flex flex-col items-center text-center group relative overflow-hidden">
            {/* Background glowing orb */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors pointer-events-none" />

            <div className="absolute top-4 right-4 z-20">
               <button onClick={() => setRoleEditUser(roleEditUser === member.user_id ? null : member.user_id)} className="text-text-muted hover:text-text-base transition-colors p-1 rounded-full hover:bg-white/10">
                 <MoreVertical size={18} />
               </button>
               {roleEditUser === member.user_id && (
                  <div className="absolute right-0 mt-2 w-32 bg-surface border border-border/50 rounded-lg shadow-xl z-30">
                     <button onClick={() => handleChangeRole(member.user_id, 'owner')} className="w-full text-left px-4 py-2 text-xs hover:bg-white/5">Owner</button>
                     <button onClick={() => handleChangeRole(member.user_id, 'leader')} className="w-full text-left px-4 py-2 text-xs hover:bg-white/5">Leader</button>
                     <button onClick={() => handleChangeRole(member.user_id, 'member')} className="w-full text-left px-4 py-2 text-xs hover:bg-white/5">Member</button>
                  </div>
               )}
            </div>

            {/* Avatar */}
            <div className="relative mb-4 z-10 mt-2">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-surface to-border/80 border border-border/50 flex items-center justify-center text-2xl font-bold text-text-base shadow-lg uppercase">
                {member.full_name ? member.full_name.substring(0, 2) : member.email.substring(0, 2)}
              </div>
            </div>

            {/* Details */}
            <h3 className="text-lg font-semibold text-text-base relative z-10">{member.full_name || 'User'}</h3>
            <p className="text-sm text-text-muted mb-4 relative z-10 flex items-center gap-1.5 justify-center">
              <Mail size={12} />
              {member.email}
            </p>

            <div className="mt-auto w-full pt-4 border-t border-border/50 flex justify-center items-center relative z-10 text-sm">
              <span className="flex items-center gap-1.5 text-text-muted uppercase text-xs font-bold tracking-wider">
                <Shield size={14} className={member.role === "owner" ? "text-accent-red" : member.role === "leader" ? "text-accent-yellow" : "text-text-muted"} />
                {member.role}
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
              Add Team Member
            </h2>

            {showSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
                <CheckCircle2 size={48} className="text-accent-green mb-4" />
                <h3 className="text-lg font-medium text-text-base">Member Added!</h3>
                <p className="text-text-muted text-sm mt-1">{inviteName} has been added to the team.</p>
              </div>
            ) : (
              <form onSubmit={handleAddMember} className="space-y-4 max-h-[70vh] overflow-y-auto px-1 pr-2">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:border-accent-yellow outline-none text-text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Email</label>
                      <input
                        type="email"
                        required
                        placeholder="john@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:border-accent-yellow outline-none text-text-base"
                      />
                    </div>
                 </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:border-accent-yellow outline-none text-text-base appearance-none"
                    >
                      <option value="member">Member</option>
                      <option value="leader">Leader</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                      <input type="checkbox" id="sendInvite" checked={sendInvite} onChange={e => setSendInvite(e.target.checked)} className="rounded bg-surface/50 border-border/50 text-accent-yellow" />
                      <label htmlFor="sendInvite" className="text-xs text-text-muted cursor-pointer">Send Email Invitation</label>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface/50 border border-border/50">
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Initial Skills</label>
                    <div className="flex gap-2 mb-3">
                       <select id="modalSkill" className="flex-1 text-xs rounded-lg bg-surface border border-border/50 text-text-base px-2 py-1.5 focus:outline-none">
                          <option value="">Select skill...</option>
                          {availableSkills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                       <select id="modalLevel" className="w-24 text-xs rounded-lg bg-surface border border-border/50 text-text-base px-2 py-1.5 focus:outline-none">
                          <option value="basic">Basic</option>
                          <option value="intermediate">Int</option>
                          <option value="advanced">Adv</option>
                          <option value="expert">Exp</option>
                       </select>
                       <button type="button" onClick={() => {
                          const sid = parseInt((document.getElementById('modalSkill') as HTMLSelectElement).value);
                          const lvl = (document.getElementById('modalLevel') as HTMLSelectElement).value;
                          if (sid && !selectedSkills.find(ss => ss.skill_id === sid)) {
                             setSelectedSkills([...selectedSkills, { skill_id: sid, level: lvl }]);
                          }
                       }} className="px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold">+</button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                       {selectedSkills.map(ss => (
                          <div key={ss.skill_id} className="flex items-center gap-1.5 px-2 py-1 bg-surface border border-border/50 rounded-lg text-[10px] text-text-base">
                             <span>{availableSkills.find(s => s.id === ss.skill_id)?.name} ({ss.level})</span>
                             <button type="button" onClick={() => setSelectedSkills(selectedSkills.filter(x => x.skill_id !== ss.skill_id))}><X size={10}/></button>
                          </div>
                       ))}
                    </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 bg-accent-yellow text-background font-bold rounded-xl hover:bg-accent-yellow/90 transition-all shadow-lg shadow-accent-yellow/20"
                >
                  Create and Add Member
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
