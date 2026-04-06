import api from './axios';

export const getProjects = async () => {
  const response = await api.get('/projects/');
  return response.data;
};

export const createProject = async (data: any) => {
  const response = await api.post('/projects/', data);
  return response.data;
};
