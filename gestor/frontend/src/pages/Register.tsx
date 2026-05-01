import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    organization_name: '',
    country: 'Chile'
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/register', formData);
      const { access_token, refresh_token } = response.data;
      login(access_token, refresh_token);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error creating account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12 transition-colors duration-300">
      <div className="glass-card p-8 rounded-2xl shadow-xl max-w-md w-full border border-border/50 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <h1 className="text-3xl font-bold text-primary mb-6 text-center">SmartTrack</h1>
        <h2 className="text-xl font-semibold text-text-base mb-2">Create your account</h2>
        <p className="text-text-muted mb-8 text-sm">Join SmartTrack and manage your team efficiently.</p>

        {error && (
          <div className="bg-red-500/10 text-red-500 p-4 rounded-lg border border-red-500/20 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Full Name</label>
            <input
              type="text"
              name="full_name"
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-text-muted/50 shadow-sm"
              placeholder="John Doe"
              value={formData.full_name}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Work Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-text-muted/50 shadow-sm"
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Organization Name</label>
            <input
              type="text"
              name="organization_name"
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-text-muted/50 shadow-sm"
              placeholder="Acme Corp"
              value={formData.organization_name}
              onChange={handleChange}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Country</label>
              <select
                name="country"
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                value={formData.country}
                onChange={handleChange}
              >
                <option value="Chile">Chile</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-base focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-text-muted/50 shadow-sm"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 mt-4 active:scale-95"
          >
            {isLoading ? 'Creating account...' : 'Get Started'}
          </button>
        </form>

        <p className="mt-8 text-center text-text-muted text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
