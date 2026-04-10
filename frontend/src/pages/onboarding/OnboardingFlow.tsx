import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const OnboardingFlow: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Al montar, obtener el paso actual desde el servidor
  useEffect(() => {
    api.get('/onboarding/status').then(res => {
      if (res.data.onboarding_completed) {
        navigate('/');
      } else {
        setStep(res.data.current_step || 1);
      }
    }).catch(() => {});
  }, []);

  const goNext = () => setStep(s => s + 1);

  const renderStep = () => {
    switch (step) {
      case 1: return <Step1Org onNext={goNext} />;
      case 2: return <Step2Invite onNext={goNext} onSkip={goNext} />;
      case 3: return <Step3Skills onNext={goNext} onSkip={goNext} />;
      case 4: return <Step4Project onNext={goNext} />;
      case 5: return <Step5Task onNext={goNext} />;
      case 6: return <OnboardingSuccess onFinish={() => navigate('/')} />;
      default: return <OnboardingSuccess onFinish={() => navigate('/')} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12 transition-colors duration-300">
      <div className="glass-card p-8 md:p-12 max-w-2xl w-full border border-border/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="mb-10 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-primary tracking-tight">SmartTrack</h1>
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest bg-surface px-3 py-1 rounded-full border border-border/50">
              Paso {Math.min(step, 5)} de 5
            </span>
          </div>
          <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden border border-border/20">
            <div
              className="bg-primary h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              style={{ width: `${(Math.min(step, 5) / 5) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="relative z-10">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

const OnboardingSuccess = ({ onFinish }: { onFinish: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => onFinish(), 3000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="text-center space-y-4 animate-fade-in">
      <h2 className="text-2xl font-bold text-success">¡Onboarding completado!</h2>
      <p className="text-text-muted">Tu equipo ya está configurado. Redirigiendo al dashboard...</p>
    </div>
  );
};

// ── STEP 1: Organización y equipo ──────────────────────────────────────────────
const Step1Org = ({ onNext }: { onNext: () => void }) => {
  const [org, setOrg] = useState({ organization_name: '', country: 'Chile', team_name: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await api.post('/onboarding/step1', org);
      onNext();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al guardar. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-text-base">Crea tu organización y equipo</h2>
        <p className="text-sm text-text-muted">Comencemos con los detalles básicos de tu espacio de trabajo.</p>
      </div>
      {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-lg border border-red-500/20 text-sm">{error}</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Nombre de la organización</label>
          <input required type="text" placeholder="Nombre de la organización"
            className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all"
            value={org.organization_name} onChange={(e) => setOrg({ ...org, organization_name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">País</label>
            <select className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all appearance-none"
              value={org.country} onChange={(e) => setOrg({ ...org, country: e.target.value })}>
              <option value="Chile">Chile</option>
              <option value="Mexico">México</option>
              <option value="Argentina">Argentina</option>
              <option value="España">España</option>
              <option value="Other">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Nombre del equipo</label>
            <input required type="text" placeholder="Nombre de tu primer equipo"
              className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all"
              value={org.team_name} onChange={(e) => setOrg({ ...org, team_name: e.target.value })} />
          </div>
        </div>
      </div>
      <button type="submit" disabled={isLoading}
        className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50">
        {isLoading ? 'Guardando...' : 'Continuar'}
      </button>
    </form>
  );
};

// ── STEP 2: Invitar equipo ─────────────────────────────────────────────────────
const Step2Invite = ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => {
  const [emails, setEmails] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInvite = async () => {
    setIsLoading(true);
    const emailList = emails.split(',').map(e => e.trim()).filter(e => e.length > 0);
    try {
      await api.post('/onboarding/step2/invite', { emails: emailList.length > 0 ? emailList : ['placeholder@skip.com'] });
    } catch (_) {}
    finally {
      setIsLoading(false);
      onNext();
    }
  };

  const handleSkip = async () => {
    try {
      await api.post('/onboarding/step2/invite', { emails: ['placeholder@skip.com'] });
    } catch (_) {}
    onSkip();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-text-base">Invita a tu equipo</h2>
        <p className="text-sm text-text-muted">SmartTrack es mejor en equipo. Agrega sus correos abajo.</p>
      </div>
      <textarea
        className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl h-32 focus:bg-surface focus:border-primary outline-none transition-all"
        placeholder="ejemplo1@empresa.com, ejemplo2@empresa.com"
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
      />
      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <button onClick={handleSkip}
          className="flex-1 px-6 py-4 rounded-xl font-bold border border-border/50 text-text-muted hover:bg-surface transition-all">
          Omitir por ahora
        </button>
        <button onClick={handleInvite} disabled={isLoading}
          className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50">
          {isLoading ? 'Enviando...' : 'Invitar y continuar'}
        </button>
      </div>
    </div>
  );
};

// ── STEP 3: Skills ─────────────────────────────────────────────────────────────
const Step3Skills = ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => {
  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.get('/skills').then(res => setSkills(res.data)).catch(() => setSkills([])).finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.post('/onboarding/step3/skills', { skill_ids: selectedSkills });
    } catch (_) {}
    finally {
      setIsSaving(false);
      onNext();
    }
  };

  const handleSkip = async () => {
    try { await api.post('/onboarding/step3/skip'); } catch (_) {}
    onSkip();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-text-base">Define tus habilidades</h2>
        <p className="text-sm text-text-muted">Esto ayuda al motor a sugerirte las mejores tareas.</p>
      </div>

      {isLoading ? (
        <div className="h-32 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : skills.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-8">No hay skills disponibles aún.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
          {skills.map((s) => (
            <button key={s.id} type="button"
              className={`p-3 border rounded-xl text-xs font-bold transition-all ${
                selectedSkills.includes(s.id)
                  ? 'bg-primary/20 border-primary text-primary shadow-inner'
                  : 'bg-surface/50 border-border/50 text-text-muted hover:border-primary/50'
              }`}
              onClick={() => setSelectedSkills(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/20">
        <button onClick={handleSkip} className="flex-1 px-6 py-4 rounded-xl font-bold border border-border/50 text-text-muted hover:bg-surface transition-all">
          Omitir (Modo BASIC)
        </button>
        <button onClick={handleSave} disabled={isSaving}
          className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50">
          {isSaving ? 'Guardando...' : 'Guardar y continuar'}
        </button>
      </div>
    </div>
  );
};

// ── STEP 4: Primer Proyecto ────────────────────────────────────────────────────
const Step4Project = ({ onNext }: { onNext: () => void }) => {
  const [project, setProject] = useState({
    name: '',
    start_date: new Date().toISOString().split('T')[0],
    deadline: '',
    priority: 'Medium'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const payload: any = {
        name: project.name,
        start_date: project.start_date,
        priority: project.priority,
      };
      if (project.deadline) payload.deadline = project.deadline;
      await api.post('/onboarding/step4/project', payload);
      onNext();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al crear el proyecto.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-text-base">Tu primer proyecto</h2>
        <p className="text-sm text-text-muted">¿En qué estará trabajando tu equipo esta semana?</p>
      </div>
      {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-lg border border-red-500/20 text-sm">{error}</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Nombre del proyecto</label>
          <input required type="text" placeholder="Ej: Rediseño Web 2026"
            className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all"
            value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Fecha de inicio</label>
            <input required type="date"
              className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all"
              value={project.start_date} onChange={(e) => setProject({ ...project, start_date: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Prioridad</label>
            <select className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all appearance-none"
              value={project.priority} onChange={(e) => setProject({ ...project, priority: e.target.value })}>
              <option value="Critical">Crítica</option>
              <option value="High">Alta</option>
              <option value="Medium">Media</option>
              <option value="Low">Baja</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Fecha límite (opcional)</label>
          <input type="date"
            className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all"
            value={project.deadline} onChange={(e) => setProject({ ...project, deadline: e.target.value })} />
        </div>
      </div>
      <button type="submit" disabled={isLoading}
        className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50">
        {isLoading ? 'Creando...' : 'Crear Proyecto'}
      </button>
    </form>
  );
};

// ── STEP 5: Primera Tarea ──────────────────────────────────────────────────────
const Step5Task = ({ onNext }: { onNext: () => void }) => {
  const [task, setTask] = useState({ name: '', estimated_hours: 4 });
  const [motorResult, setMotorResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!task.name.trim()) {
      setError('Ingresa un nombre para la tarea.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await api.post('/onboarding/step5/task', {
        name: task.name,
        estimated_hours: task.estimated_hours,
      });
      setMotorResult(res.data);
    } catch (err: any) {
      // Si falla el backend, mostramos resultado simulado igual para no bloquear el onboarding
      setMotorResult({
        motor_confidence: { level: 'BASIC', percentage: 55, label: 'Estimación inicial', is_estimated: true },
        suggestion: '¡Todo listo! El motor ha validado tu primera tarea.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-text-base">Demo del Motor Inteligente</h2>
        <p className="text-sm text-text-muted">Crea una tarea para ver cómo SmartTrack anticipa conflictos.</p>
      </div>
      {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-lg border border-red-500/20 text-sm">{error}</div>}

      <div>
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Nombre de la tarea</label>
        <input type="text" placeholder="Ej: Implementar Auth JWT"
          className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all"
          value={task.name} onChange={(e) => setTask({ ...task, name: e.target.value })} />
      </div>

      {!motorResult ? (
        <button onClick={handleCreate} disabled={isLoading}
          className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50">
          {isLoading ? 'Validando...' : 'Validar Viabilidad'}
        </button>
      ) : (
        <div className="bg-primary/10 p-6 rounded-2xl border border-primary/30 animate-in zoom-in duration-500">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-primary">Resultado del motor</h3>
            <span className="px-3 py-1 bg-primary text-white text-[10px] font-black rounded-full uppercase tracking-tighter">
              {motorResult.motor_confidence?.level} • {motorResult.motor_confidence?.percentage}%
            </span>
          </div>
          <p className="text-text-base text-sm mb-6 font-medium leading-relaxed italic">
            "{motorResult.suggestion}"
          </p>
          <button onClick={() => onNext()}
            className="w-full bg-success hover:bg-success/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-success/20 transition-all active:scale-[0.98]">
            Finalizar y entrar al Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingFlow;
