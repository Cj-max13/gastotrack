import axios from "axios";

const API = "http://localhost:3000";
const AI_API = "http://192.168.0.11:8000";

export const getTransactions = () => axios.get(`${API}/transactions`);

export const getInsights = (transactions) =>
  axios.post(`${AI_API}/ai/insights`, { transactions });
