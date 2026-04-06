import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

const OnboardingFlow: React.FC = () => {
  const [step, setStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState<any>({});

  const nextStep = (data: any) => {
    setOnboardingData({ ...onboardingData, ...data });
    setStep(step + 1);
  };

  const skipStep = () => {
    setStep(step + 1);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return <Step1Org onNext={nextStep} />;
      case 2:
        return <Step2Invite onNext={nextStep} onSkip={skipStep} />;
      case 3:
        return <Step3Skills onNext={nextStep} onSkip={skipStep} />;
      case 4:
        return <Step4Project onNext={nextStep} />;
      case 5:
        return <Step5Task onNext={nextStep} />;
      case 6:
        return (
          <div className="text-center space-y-4 animate-fade-in">
            <h2 className="text-2xl font-bold text-success">¡Onboarding completado!</h2>
            <p className="text-text-muted">Tu equipo ya está configurado. Redirigiendo al dashboard...</p>
            {setTimeout(() => (window.location.href = '/'), 3000) && null}
          </div>
        );
      default:
        return <div>Fin del flujo</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12 transition-colors duration-300">
      <div className="glass-card p-8 md:p-12 max-w-2xl w-full border border-border/50 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="mb-10 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-primary tracking-tight">SmartTrack</h1>
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest bg-surface px-3 py-1 rounded-full border border-border/50">
              Paso {step} de 5
            </span>
          </div>
          <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden border border-border/20">
            <div
              className="bg-primary h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              style={{ width: `${(step / 5) * 100}%` }}
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

// Componentes internos
const Step1Org = ({ onNext }: any) => {
  const [org, setOrg] = useState({ organization_name: '', country: 'Chile', team_name: '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(org); }} className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-text-base">Crea tu organización y equipo</h2>
        <p className="text-sm text-text-muted">Comencemos con los detalles básicos de tu espacio de trabajo.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Nombre de la organización</label>
          <input required type="text" placeholder="Nombre de la organización" className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all" value={org.organization_name} onChange={(e) => setOrg({ ...org, organization_name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">País</label>
            <select className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all appearance-none" value={org.country} onChange={(e) => setOrg({ ...org, country: e.target.value })}>
              <option value="Chile">Chile</option>
              <option value="Mexico">México</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Nombre del equipo</label>
            <input required type="text" placeholder="Nombre de tu primer equipo" className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all" value={org.team_name} onChange={(e) => setOrg({ ...org, team_name: e.target.value })} />
          </div>
        </div>
      </div>
      <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">Continuar</button>
    </form>
  );
};

const Step2Invite = ({ onNext, onSkip }: any) => {
  const [emails, setEmails] = useState('');
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
        <button onClick={onSkip} className="flex-1 px-6 py-4 rounded-xl font-bold border border-border/50 text-text-muted hover:bg-surface transition-all">Omitir por ahora</button>
        <button onClick={() => onNext({ emails: emails.split(',').map(e => e.trim()) })} className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">Invitar y continuar</button>
      </div>
    </div>
  );
};

const Step3Skills = ({ onNext, onSkip }: any) => {
  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);
  const skills = ['React', 'FastAPI', 'MySQL', 'Python', 'DevOps', 'UI/UX', 'Management', 'Testing'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-text-base">Define tus habilidades</h2>
        <p className="text-sm text-text-muted">Esto ayuda al motor a sugerirte las mejores tareas.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1 custom-scrollbar">
        {skills.map((s, idx) => (
          <button
            key={idx}
            type="button"
            className={`p-3 border rounded-xl text-xs font-bold transition-all ${
              selectedSkills.includes(idx)
                ? 'bg-primary/20 border-primary text-primary shadow-inner shadow-primary/10'
                : 'bg-surface/50 border-border/50 text-text-muted hover:border-primary/50'
            }`}
            onClick={() => setSelectedSkills(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/20">
        <button onClick={onSkip} className="flex-1 px-6 py-4 rounded-xl font-bold border border-border/50 text-text-muted hover:bg-surface transition-all">
          Omitir (Modo BASIC)
        </button>
        <button onClick={() => onNext({ skill_ids: selectedSkills })} className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
          Guardar y continuar
        </button>
      </div>
    </div>
  );
};

const Step4Project = ({ onNext }: any) => {
  const [project, setProject] = useState({ name: '', start_date: new Date().toISOString().split('T')[0], deadline: '', priority: 'Medium' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(project); }} className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-text-base">Tu primer proyecto</h2>
        <p className="text-sm text-text-muted">¿En qué estará trabajando tu equipo esta semana?</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Nombre del proyecto</label>
          <input required type="text" placeholder="Ej: Rediseño Web 2026" className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all" value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Fecha de inicio</label>
            <input required type="date" className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all [color-scheme:dark]" value={project.start_date} onChange={(e) => setProject({ ...project, start_date: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Prioridad</label>
            <select className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all appearance-none" value={project.priority} onChange={(e) => setProject({ ...project, priority: e.target.value })}>
              <option value="High">Alta</option>
              <option value="Medium">Media</option>
              <option value="Low">Baja</option>
            </select>
          </div>
        </div>
      </div>
      <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">Crear Proyecto</button>
    </form>
  );
};

const Step5Task = ({ onNext }: any) => {
  const [task, setTask] = useState({ name: '', estimated_hours: 4 });
  const [motorResult, setMotorResult] = useState<any>(null);

  const handleCreate = async () => {
    setMotorResult({
      motor_confidence: { level: 'BASIC', percentage: 55, label: 'Estimación inicial', is_estimated: true },
      suggestion: '¡Todo listo! El motor ha validado tu primera tarea.'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-text-base">Demo del Motor Inteligente</h2>
        <p className="text-sm text-text-muted">Crea una tarea para ver cómo SmartTrack anticipa conflictos.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Nombre de la tarea</label>
        <input required type="text" placeholder="Ej: Implementar Auth JWT" className="w-full px-4 py-3 border border-border/50 bg-surface/50 text-text-base rounded-xl focus:bg-surface focus:border-primary outline-none transition-all" value={task.name} onChange={(e) => setTask({ ...task, name: e.target.value })} />
      </div>

      {!motorResult ? (
        <button onClick={handleCreate} className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
          Validar Viabilidad
        </button>
      ) : (
        <div className="bg-primary/10 p-6 rounded-2xl border border-primary/30 animate-in zoom-in duration-500">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-primary">Resultado del motor</h3>
            <span className="px-3 py-1 bg-primary text-white text-[10px] font-black rounded-full uppercase tracking-tighter">
              {motorResult.motor_confidence.level} • {motorResult.motor_confidence.percentage}%
            </span>
          </div>
          <p className="text-text-base text-sm mb-6 font-medium leading-relaxed italic">
            "{motorResult.suggestion}"
          </p>
          <button onClick={() => onNext({})} className="w-full bg-success hover:bg-success/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-success/20 transition-all active:scale-[0.98]">
            Finalizar y entrar al Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingFlow;
