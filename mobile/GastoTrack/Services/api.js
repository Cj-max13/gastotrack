import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';
import { cacheTransactions, getCachedTransactions, addToCache } from '../Services/OfflineManager';

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

// ── Transactions (online + offline cache) ──
export const getTransactions = async () => {
  try {
    const res = await api.get('/transactions');
    // Cache the fresh data for offline use
    await cacheTransactions(res.data);
    return res;
  } catch {
    // Offline — return cached data
    const cached = await getCachedTransactions();
    return { data: cached, fromCache: true };
  }
};

export const postTransaction = async (text) => {
  const res = await api.post('/transactions/raw', { text });
  // Add to local cache immediately
  await addToCache(res.data);
  return res;
};

export const resetCategorySpending = (category, spentAmount) =>
  api.post(`/transactions/reset/${encodeURIComponent(category)}`, { spentAmount });

export const getCategoryOffsets = () =>
  api.get('/transactions/offsets');

// ── AI Service ──
export const getInsights = (transactions, budgets = null, category_offsets = null) =>
  axios.post(`${CONFIG.AI_URL}/ai/insights`, { transactions, budgets, category_offsets });

export const previewCategorize = (merchant, rawText = '') =>
  axios.post(`${CONFIG.AI_URL}/ai/categorize`, { merchant, raw_text: rawText });

export const sendChatMessage = (message, history = [], token = null) =>
  axios.post(`${CONFIG.AI_URL}/ai/chat`, { message, history, token });
