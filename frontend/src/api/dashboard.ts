import api from './axios';

export const getDashboardSummary = async (viewMode: "personal" | "team" = "personal") => {
  const response = await api.get('/dashboard/summary', { params: { view_mode: viewMode } });
  return response.data;
};

export const getDashboardTimeline = async (viewMode: "personal" | "team" = "personal") => {
  const response = await api.get('/dashboard/timeline', { params: { view_mode: viewMode } });
  return response.data;
};
