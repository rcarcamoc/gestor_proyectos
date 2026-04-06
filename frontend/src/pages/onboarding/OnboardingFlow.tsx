import React, { useState } from 'react';

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
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-green-600">¡Onboarding completado!</h2>
            <p className="text-gray-600">Tu equipo ya está configurado. Redirigiendo al dashboard...</p>
            {setTimeout(() => (window.location.href = '/'), 3000) && null}
          </div>
        );
      default:
        return <div>Fin del flujo</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-12">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl w-full border border-gray-100">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-blue-600">SmartTrack</h1>
            <span className="text-sm font-semibold text-gray-400">Paso {step} de 5</span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all duration-500" 
              style={{ width: `${(step / 5) * 100}%` }}
            ></div>
          </div>
        </div>

        {renderStep()}
      </div>
    </div>
  );
};

// Componentes internos
const Step1Org = ({ onNext }: any) => {
  const [org, setOrg] = useState({ organization_name: '', country: 'Chile', team_name: '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(org); }} className="space-y-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Crea tu organización y equipo</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre de la organización</label>
        <input required type="text" placeholder="Nombre de la organización" className="w-full px-4 py-3 border rounded-xl" value={org.organization_name} onChange={(e) => setOrg({ ...org, organization_name: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">País</label>
        <select className="w-full px-4 py-3 border rounded-xl" value={org.country} onChange={(e) => setOrg({ ...org, country: e.target.value })}>
          <option value="Chile">Chile</option>
          <option value="Mexico">México</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre de tu primer equipo</label>
        <input required type="text" placeholder="Nombre de tu primer equipo" className="w-full px-4 py-3 border rounded-xl" value={org.team_name} onChange={(e) => setOrg({ ...org, team_name: e.target.value })} />
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg">Siguiente</button>
    </form>
  );
};

const Step2Invite = ({ onNext, onSkip }: any) => {
  const [emails, setEmails] = useState('');
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Invita a tu equipo</h2>
      <p className="text-sm text-gray-500 italic mb-4">(Opcional: puedes hacerlo más tarde)</p>
      <textarea className="w-full px-4 py-3 border rounded-xl h-24" placeholder="emails separados por comas" value={emails} onChange={(e) => setEmails(e.target.value)} />
      <div className="flex space-x-4">
        <button onClick={onSkip} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 px-4 rounded-xl">Omitir</button>
        <button onClick={() => onNext({ emails: emails.split(',').map(e => e.trim()) })} className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-xl">Invitar y continuar</button>
      </div>
    </div>
  );
};

const Step3Skills = ({ onNext, onSkip }: any) => {
  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Define tus skills</h2>
      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2">
        {['React', 'FastAPI', 'MySQL', 'Python'].map((s, idx) => (
          <div key={idx} className={`p-3 border rounded-xl cursor-pointer ${selectedSkills.includes(idx) ? 'bg-blue-50 border-blue-400' : ''}`} onClick={() => setSelectedSkills(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}>
            {s}
          </div>
        ))}
      </div>
      <div className="flex space-x-4 pt-4">
        <button onClick={onSkip} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 px-4 rounded-xl">Omitir (Modo BASIC)</button>
        <button onClick={() => onNext({ skill_ids: selectedSkills })} className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg">Siguiente</button>
      </div>
    </div>
  );
};

const Step4Project = ({ onNext }: any) => {
  const [project, setProject] = useState({ name: '', start_date: new Date().toISOString().split('T')[0], deadline: '', priority: 'Medium' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(project); }} className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Tu primer proyecto</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre del proyecto</label>
        <input required type="text" placeholder="Nombre del proyecto" className="w-full px-4 py-3 border rounded-xl" value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Inicio</label>
          <input required type="date" className="w-full px-4 py-3 border rounded-xl" value={project.start_date} onChange={(e) => setProject({ ...project, start_date: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Prioridad</label>
          <select className="w-full px-4 py-3 border rounded-xl" value={project.priority} onChange={(e) => setProject({ ...project, priority: e.target.value })}>
            <option value="High">Alta</option>
            <option value="Medium">Media</option>
            <option value="Low">Baja</option>
          </select>
        </div>
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg">Crear Proyecto</button>
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
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Tu primera tarea y demo del motor</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre de la tarea</label>
        <input required type="text" placeholder="Nombre de la tarea" className="w-full px-4 py-3 border rounded-xl" value={task.name} onChange={(e) => setTask({ ...task, name: e.target.value })} />
      </div>
      
      {!motorResult ? (
        <button onClick={handleCreate} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg">Crear Tarea y Validar</button>
      ) : (
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 animate-in fade-in zoom-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-blue-800">Resultado del motor</h3>
            <span className="px-3 py-1 bg-blue-200 text-blue-800 text-xs font-bold rounded-full">{motorResult.motor_confidence.level} - {motorResult.motor_confidence.percentage}%</span>
          </div>
          <p className="text-blue-700 text-sm mb-4 italic">"{motorResult.suggestion}"</p>
          <button onClick={() => onNext({})} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg">Finalizar Onboarding</button>
        </div>
      )}
    </div>
  );
};

export default OnboardingFlow;
