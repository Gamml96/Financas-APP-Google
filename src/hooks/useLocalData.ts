import { useState, useEffect } from 'react';
import { localStorageService } from '../services/localStorageService';

/**
 * Hook que substitui o listener do Firestore quando o Modo Teste está ativo.
 * Usa `localStorage` para persistir dados entre recargas.
 *
 * @param collectionName Nome da coleção ('accounts', 'transactions', etc.)
 * @param enabled Se true, ativa o listener local
 * @returns Array de documentos
 */
export function useLocalCollection(collectionName: string, enabled: boolean = false) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!enabled) return;

    // Carrega os dados iniciais
    const load = () => {
      switch (collectionName) {
        case 'accounts':
          setData(localStorageService.getAccounts());
          break;
        case 'transactions':
          setData(localStorageService.getTransactions());
          break;
        case 'categories':
          setData(localStorageService.getCategories());
          break;
        case 'budgets':
          setData(localStorageService.getBudgets());
          break;
        default:
          setData([]);
      }
    };

    load();

    // Listener para mudanças no localStorage (outra aba/janela)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'vidi_test_data_v1') load();
    };
    window.addEventListener('storage', handleStorage);

    // Polling periódico para detectar mudanças no mesmo contexto
    const interval = setInterval(load, 500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [collectionName, enabled]);

  return data;
}

/**
 * Hook para o perfil do usuário no Modo Teste.
 */
export function useLocalUserProfile(enabled: boolean = false) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const load = () => {
      setProfile(localStorageService.getUserProfile());
    };

    load();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'vidi_test_data_v1') load();
    };
    window.addEventListener('storage', handleStorage);

    const interval = setInterval(load, 500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [enabled]);

  return profile;
}