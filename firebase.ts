// This is a workaround for the no-build-tool environment
declare const firebase: any;

// Mantém a mesma função de erro (SEM quebrar o PWA)
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
    // ❗ NÃO lança erro para não quebrar o PWA
    console.error(`${title}: ${message}`);
};

// 1. Check if Firebase SDKs were loaded (não quebra o app)
if (typeof firebase === 'undefined') {
    renderError(
        'Erro de Configuração',
        'Os scripts do Firebase ainda não foram carregados. O aplicativo continuará aberto, mas os serviços do Firebase podem não funcionar.'
    );
}

// 2. Check if the user has added their config (não quebra o app)
const firebaseConfig = (window as any).firebaseConfig;
if (!firebaseConfig || firebaseConfig.apiKey === "YOUR_API_KEY") {
    renderError(
        'Configuração do Firebase Necessária',
        'As credenciais do Firebase não foram configuradas corretamente. O aplicativo continuará aberto, mas sem conexão com o Firebase.'
    );
}

// Initialize Firebase (somente se possível)
let app: any = null;
let auth: any = null;
let db: any = null;
let storage: any = null;

try {
    if (
        typeof firebase !== 'undefined' &&
        firebaseConfig &&
        firebaseConfig.apiKey
    ) {
        app = firebase.apps && firebase.apps.length
            ? firebase.apps[0]
            : firebase.initializeApp(firebaseConfig);

        auth = firebase.auth();
        db = firebase.firestore();
        storage = firebase.storage();
    }
} catch (error) {
    console.error('Falha ao inicializar o Firebase:', error);
}

// Exports preservados
export { auth, db, storage };
