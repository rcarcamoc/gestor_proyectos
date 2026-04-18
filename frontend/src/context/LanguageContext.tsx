import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'es';

interface Translations {
  [key: string]: {
    [key in Language]: string;
  };
}

export const translations: Translations = {
  // Common
  'dashboard': { en: 'Dashboard', es: 'Tablero' },
  'projects': { en: 'Projects', es: 'Proyectos' },
  'tasks': { en: 'Tasks', es: 'Tareas' },
  'users_team': { en: 'Users & Team', es: 'Usuarios y Equipo' },
  'settings': { en: 'Settings', es: 'Configuración' },
  'logout': { en: 'Logout', es: 'Cerrar Sesión' },
  'new_project': { en: 'New Project', es: 'Nuevo Proyecto' },
  'create': { en: 'Create', es: 'Crear' },
  'cancel': { en: 'Cancel', es: 'Cancelar' },
  'save': { en: 'Save', es: 'Guardar' },
  'logout': { en: 'Logout', es: 'Cerrar Sesión' },
  'loading': { en: 'Loading...', es: 'Cargando...' },
  'error': { en: 'Error', es: 'Error' },
  'notifications': { en: 'Notifications', es: 'Notificaciones' },
  'mark_all_read': { en: 'Mark all as read', es: 'Marcar todo como leído' },
  'no_notifications': { en: 'You have no notifications.', es: 'No tienes notificaciones.' },

  // Project Modal
  'edit_project': { en: 'Edit Project', es: 'Editar Proyecto' },
  'update_project': { en: 'Update Project', es: 'Actualizar Proyecto' },
  'project_name': { en: 'Project Name', es: 'Nombre del Proyecto' },
  'description': { en: 'Description (Optional)', es: 'Descripción (Opcional)' },
  'start_date': { en: 'Start Date', es: 'Fecha de Inicio' },
  'deadline': { en: 'Deadline (Optional)', es: 'Fecha Límite (Opcional)' },
  'project_color': { en: 'Project Color', es: 'Color del Proyecto' },
  'priority': { en: 'Priority', es: 'Prioridad' },
  'status': { en: 'Status', es: 'Estado' },
  'low': { en: 'Low', es: 'Baja' },
  'medium': { en: 'Medium', es: 'Media' },
  'high': { en: 'High', es: 'Alta' },
  'planned': { en: 'Planned', es: 'Planificado' },
  'in_progress': { en: 'In Progress', es: 'En Progreso' },
  'completed': { en: 'Completed', es: 'Completado' },
  'on_hold': { en: 'On Hold', es: 'En Espera' },
  'archived': { en: 'Archived', es: 'Archivado' },
  'creating': { en: 'Creating...', es: 'Creando...' },
  'create_project': { en: 'Create Project', es: 'Crear Proyecto' },
  'website_redesign_placeholder': { en: 'e.g.: Website Redesign', es: 'ej.: Rediseño del sitio web' },
  'objectives_placeholder': { en: 'Describe the main objectives...', es: 'Describe los objetivos principales...' },

  // Project List
  'manage_projects_desc': { en: 'Manage and track your active projects.', es: 'Administra y rastrea tus proyectos activos.' },
  'no_projects': { en: 'No projects found', es: 'No se encontraron proyectos' },
  'start_first_project': { en: 'Start by creating your first project.', es: 'Comienza creando tu primer proyecto.' },

  // Auth
  'welcome_back': { en: 'Welcome Back', es: 'Bienvenido de nuevo' },
  'email': { en: 'Email', es: 'Correo electrónico' },
  'password': { en: 'Password', es: 'Contraseña' },
  'sign_in': { en: 'Sign In', es: 'Iniciar Sesión' },
  'signing_in': { en: 'Signing in...', es: 'Iniciando sesión...' },
  'no_account': { en: "Don't have an account?", es: '¿No tienes una cuenta?' },
  'register_org': { en: 'Register your organization', es: 'Registra tu organización' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string): string => {
    if (!translations[key]) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
    return translations[key][language];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
