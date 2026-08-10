export const formatErrorMessage = (err: any, fallback: string): string => {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) {
    return msg.map((m: any) => typeof m === 'object' ? JSON.stringify(m) : String(m)).join(', ');
  }
  if (typeof msg === 'string') return msg;
  if (msg && typeof msg === 'object') return JSON.stringify(msg);
  return err?.message || fallback;
};
