import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: API_URL,
});

export const getScheduledEmails = async (userEmail?: string) => {
  const res = await api.get('/api/emails/scheduled', { params: { userEmail } });
  return res.data;
};

export const getSentEmails = async (userEmail?: string) => {
  const res = await api.get('/api/emails/sent', { params: { userEmail } });
  return res.data;
};

export const getAllEmails = async (userEmail?: string) => {
  const res = await api.get('/api/emails/all', { params: { userEmail } });
  return res.data;
};

export const scheduleEmails = async (payload: any) => {
  const res = await api.post('/api/emails/schedule', payload);
  return res.data;
};

export const getCredentials = async () => {
  try {
    const res = await api.get('/api/credentials');
    return res.data;
  } catch {
    // Fallback to internal relay endpoint
    const res = await fetch('/api/relay');
    return await res.json();
  }
};

