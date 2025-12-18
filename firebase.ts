// This is a workaround for the no-build-tool environment
declare const firebase: any;

const renderError = (title: string, message: string) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 2rem; text-align: center; font-family: sans-serif; background-color: #fff3f3; color: #b91c1c; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">${title}</h1>
        <p style="max-width: 600px;">${message}</p>
      </div>
    `;
  }
  throw new Error(`${title}: ${message}`);
};

// 1. Check if Firebase SDKs were loaded
if (typeof firebase === 'undefined') {
  renderError(
    'Erro Crítico de Configuração',
    'Os scripts do Firebase não foram carregados.'
  );
}

// 2. Check if config exists
const firebaseConfig = (window as any).firebaseConfig;
if (!firebaseConfig) {
  renderError(
    'Ação Necessária: Configure o Firebase',
    'window.firebaseConfig não encontrado.'
  );
}

// Initialize Firebase (v8 compat)
const app = firebase.apps?.length
  ? firebase.app()
  : firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/**
 * 🔑 EXPORTA TUDO QUE O APP ESPERA
 */
export { auth, db, storage };
export const firebaseExport = firebase;

// 👉 compatibilidade com imports antigos
export { firebaseExport as firebase };
