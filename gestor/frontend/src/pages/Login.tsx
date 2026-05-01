import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import api from '../api/axios';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token, refresh_token } = response.data;
      login(access_token, refresh_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error logging in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 transition-colors duration-300">
      <div className="glass-card p-8 rounded-2xl shadow-xl max-w-md w-full border border-border/50 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <h1 className="text-3xl font-bold text-primary mb-6 text-center">SmartTrack</h1>
        <h2 className="text-xl font-semibold text-text-base mb-6 text-center">{t('welcome_back')}</h2>

        {error && (
          <div className="bg-red-500/10 text-red-500 p-4 rounded-lg border border-red-500/20 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{t('email')}</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-text-muted/50 shadow-sm"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{t('password')}</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-text-muted/50 shadow-sm"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 mt-4 active:scale-95"
          >
            {isLoading ? t('signing_in') : t('sign_in')}
          </button>
        </form>

        <p className="mt-8 text-center text-text-muted text-sm">
          {t('no_account')}{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            {t('register_org')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
