import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

// ── Axios instance with auto-injected JWT ──
const api = axios.create({ baseURL: CONFIG.API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──
export const register = (name, email, password) =>
  axios.post(`${CONFIG.API_URL}/auth/register`, { name, email, password });

export const login = (email, password) =>
  axios.post(`${CONFIG.API_URL}/auth/login`, { email, password });

// ── Transactions (require auth) ──
export const getTransactions = () => api.get('/transactions');
export const postTransaction = (text) => api.post('/transactions/raw', { text });

// ── AI Service ──
export const getInsights = (transactions, budgets = null) =>
  axios.post(`${CONFIG.AI_URL}/ai/insights`, { transactions, budgets });

export const previewCategorize = (merchant, rawText = '') =>
  axios.post(`${CONFIG.AI_URL}/ai/categorize`, { merchant, raw_text: rawText });

export const sendChatMessage = (message, history = [], token = null) =>
  axios.post(`${CONFIG.AI_URL}/ai/chat`, { message, history, token });
