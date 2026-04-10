import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjects } from '../../api/projects';
import ProjectCreateModal from '../../components/ProjectCreateModal';
import { Folder, Calendar, Plus, MoreHorizontal } from 'lucide-react';
import { cn } from "../../lib/utils";
import { useTranslation } from '../../context/LanguageContext';

const ProjectList: React.FC = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-base flex items-center gap-2">
            <Folder className="text-primary" size={24} />
            {t('projects')}
          </h2>
          <p className="text-sm text-text-muted mt-1">{t('manage_projects_desc')}</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium shadow-md shadow-primary/20 hover:bg-primary/90 transition-all hover:scale-105"
        >
          <Plus size={16} />
          {t('new_project')}
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects?.length > 0 ? (
          projects.map((p: any) => (
            <div key={p.id} className="glass-card p-6 flex flex-col group relative overflow-hidden">
              {/* Subtle gradient background element for card */}
              <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-all" />

              <div className="flex justify-between items-start mb-4 relative z-10">
                <span className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border",
                  p.priority === 'High' ? "bg-accent-red/10 text-accent-red border-accent-red/20"
                  : p.priority === 'Medium' ? "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20"
                  : "bg-primary/10 text-primary border-primary/20"
                )}>
                  {p.priority === 'High' ? t('high') : p.priority === 'Medium' ? t('medium') : t('low')}
                </span>

                <div className="relative">
                  <button onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)} className="text-text-muted hover:text-text-base transition-colors">
                    <MoreHorizontal size={18} />
                  </button>
                  {menuOpenId === p.id && (
                    <div className="absolute right-0 mt-2 w-32 bg-surface border border-border/50 rounded-lg shadow-xl z-30">
                       <button onClick={() => window.location.href = `/tasks?project=${p.id}`} className="w-full text-left px-4 py-2 text-xs hover:bg-white/5">Ver Tareas</button>
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-semibold text-text-base mb-2 relative z-10">{p.name}</h3>
              <p className="text-sm text-text-muted mb-6 line-clamp-2 flex-grow relative z-10">
                {p.description || "No description provided."}
              </p>

              <div className="pt-4 border-t border-border/50 flex flex-col space-y-2 text-xs text-text-muted relative z-10">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Calendar size={12} /> {t('start_date')}:</span>
                  <span className="font-medium text-text-base/80">{p.start_date}</span>
                </div>
                {p.deadline && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Calendar size={12} /> {t('deadline')}:</span>
                    <span className="font-medium text-text-base/80">{p.deadline}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1.5">{t('status')}:</span>
                  <span className="font-medium text-text-base/80">{p.status}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-border/50 rounded-xl bg-surface/30">
            <Folder className="mx-auto text-text-muted/50 mb-3" size={48} />
            <h3 className="text-lg font-medium text-text-base">{t('no_projects')}</h3>
            <p className="text-sm text-text-muted mt-1 mb-4">{t('start_first_project')}</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-primary hover:text-text-base transition-colors font-medium text-sm"
            >
              + {t('new_project')}
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <ProjectCreateModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default ProjectList;
