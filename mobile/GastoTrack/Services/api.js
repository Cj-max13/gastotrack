/**
 * api.js
 * Centralized API layer. All calls go through the axios instance
 * which auto-injects the JWT from AsyncStorage.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';
import { cacheTransactions, getCachedTransactions, addToCache } from './OfflineManager';

// ── Axios instance — auto-injects JWT on every request ───────────────────────
const api = axios.create({ baseURL: CONFIG.API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const register = (name, email, password) =>
  axios.post(`${CONFIG.API_URL}/auth/register`, { name, email, password });

export const login = (email, password) =>
  axios.post(`${CONFIG.API_URL}/auth/login`, { email, password });

export const getMe = () =>
  api.get('/auth/me');

export const updateMonthlyBudget = (monthly_budget) =>
  api.put('/auth/budget', { monthly_budget });

export const deleteAccount = (password) =>
  api.delete('/auth/account', { data: { password } });

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────

// Get all transactions with optional filters + pagination
// filters: { category, search, dateFrom, dateTo, amountMin, amountMax,
//            sortBy, sortDir, page, limit }
export const getTransactions = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, v);
    });
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/transactions${query}`);
    // Cache the fresh data for offline use (cache the data array)
    const txList = res.data?.data || res.data;
    await cacheTransactions(Array.isArray(txList) ? txList : []);
    return res;
  } catch {
    // Offline — return cached data wrapped in same shape
    const cached = await getCachedTransactions();
    return {
      data: { data: cached, total: cached.length, page: 1, limit: cached.length, totalPages: 1 },
      fromCache: true,
    };
  }
};

// POST /transactions/raw — from Android NotificationListenerService
export const postTransaction = async (text) => {
  const res = await api.post('/transactions/raw', { text });
  if (res.data && !res.data.duplicate) await addToCache(res.data);
  return res;
};

// POST /transactions/manual — from user typed/voice input
export const postManualTransaction = async (text) => {
  const res = await api.post('/transactions/manual', { text });
  if (res.data) await addToCache(res.data);
  return res;
};

// GET /transactions/:id
export const getTransactionById = (id) =>
  api.get(`/transactions/${id}`);

// PUT /transactions/:id — edit category, amount, merchant
export const updateTransaction = (id, { amount, merchant, category }) =>
  api.put(`/transactions/${id}`, { amount, merchant, category });

// DELETE /transactions/:id
export const deleteTransaction = (id) =>
  api.delete(`/transactions/${id}`);

// POST /transactions/reset/:category
export const resetCategorySpending = (category, spentAmount) =>
  api.post(`/transactions/reset/${encodeURIComponent(category)}`, { spentAmount });

// GET /transactions/offsets
export const getCategoryOffsets = () =>
  api.get('/transactions/offsets');

// ── BUDGET ────────────────────────────────────────────────────────────────────

// GET /budget — full overview with spending vs limits per category
export const getBudget = () =>
  api.get('/budget');

// PUT /budget — update category limits
// body: { food: 3000, transport: 1500 } OR { category: 'food', limit: 3000 }
export const updateBudgetLimits = (body) =>
  api.put('/budget', body);

// GET /budget/status — alert check (warning/over categories only)
export const getBudgetStatus = () =>
  api.get('/budget/status');

// ── AI SERVICE ────────────────────────────────────────────────────────────────

export const getInsights = (transactions, budgets = null, category_offsets = null) =>
  axios.post(`${CONFIG.AI_URL}/ai/insights`, { transactions, budgets, category_offsets });

export const previewCategorize = (merchant, rawText = '') =>
  axios.post(`${CONFIG.AI_URL}/ai/categorize`, { merchant, raw_text: rawText });

export const sendChatMessage = (message, history = [], token = null) =>
  axios.post(`${CONFIG.AI_URL}/ai/chat`, { message, history, token });
