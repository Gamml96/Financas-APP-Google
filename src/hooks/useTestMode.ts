import { useState, useEffect } from 'react';

/**
 * Hook que ativa um "Modo Teste" quando o localStorage contém TEST_MODE=true.
 *
 * Como o Firebase configurado no projeto é do AI Studio (não o seu),
 * este hook permite testar a interface localmente sem fazer login.
 *
 * Para ativar: abra o console do navegador e digite:
 *   localStorage.setItem('TEST_MODE', 'true'); location.reload();
 *
 * Para desativar:
 *   localStorage.removeItem('TEST_MODE'); location.reload();
 */
export function useTestMode() {
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    const enabled = typeof window !== 'undefined' && localStorage.getItem('TEST_MODE') === 'true';
    setIsTestMode(enabled);
  }, []);

  const toggleTestMode = () => {
    if (typeof window === 'undefined') return;
    const next = !isTestMode;
    if (next) {
      localStorage.setItem('TEST_MODE', 'true');
    } else {
      localStorage.removeItem('TEST_MODE');
    }
    setIsTestMode(next);
    // Recarrega para aplicar as mudanças
    window.location.reload();
  };

  return { isTestMode, toggleTestMode };
}

/**
 * Cria um objeto de usuário fake que simula um usuário logado.
 * Usado quando TEST_MODE está ativo.
 */
export function createTestUser() {
  return {
    uid: 'test-user-001',
    email: 'teste@exemplo.com',
    displayName: 'teste',
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: [],
  } as any;
}