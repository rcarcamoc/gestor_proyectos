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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-12">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <h1 className="text-3xl font-bold text-blue-600 mb-6 text-center">SmartTrack</h1>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Create your account</h2>
        <p className="text-gray-500 mb-8 text-sm">Join SmartTrack and manage your team efficiently.</p>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              name="full_name"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="John Doe"
              value={formData.full_name}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
            <input
              type="text"
              name="organization_name"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="Acme Corp"
              value={formData.organization_name}
              onChange={handleChange}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                name="country"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all appearance-none bg-white"
                value={formData.country}
                onChange={handleChange}
              >
                <option value="Chile">Chile</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-blue-200 disabled:opacity-50 mt-4"
          >
            {isLoading ? 'Creating account...' : 'Get Started'}
          </button>
        </form>

        <p className="mt-8 text-center text-gray-600 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
