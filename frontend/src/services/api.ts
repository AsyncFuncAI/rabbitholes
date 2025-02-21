import axios from 'axios';

export interface SearchParams {
  query: string;
  previousConversation?: Array<{ user?: string; assistant?: string }>;
  concept?: string;
  followUpMode?: 'expansive' | 'focused';
  parentSearchId?: string;
  currentNodes?: any[];
  currentEdges?: any[];
}

const API_BASE_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const searchRabbitHole = async (
  params: SearchParams,
  signal?: AbortSignal
) => {
  const response = await api.post('/rabbitholes/search', params, { signal });
  return response.data;
};

export const getRecentSearches = async () => {
  try {
    const response = await api.get('/rabbitholes/recent-searches');
    return response.data;
  } catch (error) {
    console.error('Error fetching recent searches:', error);
    return [];
  }
};

export const getSearchById = async (searchId: string) => {
  try {
    const response = await api.get(`/rabbitholes/search/${searchId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching search by ID:', error);
    throw error;
  }
};

export default api;
