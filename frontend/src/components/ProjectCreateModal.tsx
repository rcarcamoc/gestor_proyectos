import React, { useState } from 'react';
import api from '../api/axios';
import { X, FolderPlus, AlertCircle } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface ProjectCreateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    deadline: '',
    priority: 'Medium',
    status: 'Planned'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.deadline) {
        delete (dataToSend as any).deadline;
      }
      await api.post('/projects/', dataToSend);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || t('error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="glass-card w-full max-w-lg p-8 relative animate-in fade-in zoom-in duration-300 border border-border/50">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-text-muted hover:text-text-base transition-colors p-2 rounded-full hover:bg-white/5"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-text-base mb-6 flex items-center gap-3 tracking-tight">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary border border-primary/30">
             <FolderPlus size={20} />
          </div>
          {t('new_project')}
        </h2>

        {error && (
          <div className="bg-accent-red/10 text-accent-red p-4 rounded-xl text-sm mb-6 flex items-center gap-3 border border-accent-red/20">
             <AlertCircle size={18} className="flex-shrink-0" />
             {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{t('project_name')}</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-text-base placeholder:text-text-muted/50 shadow-sm"
              placeholder={t('website_redesign_placeholder')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{t('description')}</label>
            <textarea
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-text-base placeholder:text-text-muted/50 min-h-[100px] resize-none shadow-sm"
              placeholder={t('objectives_placeholder')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{t('start_date')}</label>
              <input
                type="date"
                required
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-text-base shadow-sm"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Deadline (Optional)</label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-text-base shadow-sm"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{t('priority')}</label>
            <select
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-text-base shadow-sm cursor-pointer"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="Low">{t('low')}</option>
              <option value="Medium">{t('medium')}</option>
              <option value="High">{t('high')}</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 mt-2 rounded-xl font-semibold text-white shadow-lg transition-all transform active:scale-[0.98] ${
              isSubmitting
                ? 'bg-surface border border-border/50 text-text-muted cursor-not-allowed'
                : 'bg-primary hover:bg-primary/90 shadow-primary/20 hover:-translate-y-0.5 text-white'
            }`}
          >
            {isSubmitting ? t('creating') : t('create_project')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProjectCreateModal;
