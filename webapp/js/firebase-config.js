import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// =====================================================
// 🔧 CONFIGURAÇÃO DO FIREBASE
// Cole aqui as credenciais do Firebase Console:
// Console → Configurações do Projeto → Apps da Web
// =====================================================
const firebaseConfig = {
  apiKey: "AIzaSyA3UZnOfkrEGrweCN1BD_AjxOJXiyLqNmc",
  authDomain: "reforco-escolar-2026.firebaseapp.com",
  projectId: "reforco-escolar-2026",
  storageBucket: "reforco-escolar-2026.firebasestorage.app",
  messagingSenderId: "450712179120",
  appId: "1:450712179120:web:22635afc0423d5877d0675"
};

let app = null;
let db = null;

/**
 * Inicializa o Firebase App e Firestore.
 */
export function initFirebase() {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('✅ Firebase inicializado com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
    return false;
  }
}

/**
 * Retorna a instância do Firestore.
 */
export function getDb() {
  if (!db) {
    throw new Error('Firebase não inicializado. Chame initFirebase() primeiro.');
  }
  return db;
}

/**
 * Verifica se o Firebase está configurado com credenciais reais.
 */
export function isFirebaseConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('COLE_');
}
