// Parâmetros de ambiente da aplicação
// Base44 removido. Usar variáveis de ambiente Vite diretamente.

export const appParams = {
  dataMode: import.meta.env.VITE_DATA_MODE ?? 'mock',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
};
