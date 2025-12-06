
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
}

// 1. Check if Firebase SDKs were loaded
if (typeof firebase === 'undefined') {
    renderError(
        'Erro Crítico de Configuração',
        'Os scripts do Firebase não foram carregados. Verifique se as tags `<script>` para o Firebase SDK estão presentes e corretas no seu arquivo `index.html`.'
    );
}

// 2. Check if the user has added their config
const firebaseConfig = (window as any).firebaseConfig;
if (!firebaseConfig || firebaseConfig.apiKey === "YOUR_API_KEY") {
    renderError(
        'Ação Necessária: Configure o Firebase',
        'As credenciais do Firebase não foram configuradas. Por favor, edite o arquivo `index.html`, encontre o objeto `window.firebaseConfig` e substitua os valores de exemplo pelas credenciais do seu projeto.'
    );
}


// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const firebaseExport = firebase;

export { auth, db, storage, firebaseExport as firebase };
