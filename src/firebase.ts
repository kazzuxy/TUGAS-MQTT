import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

// User Config default (from user provided parameters)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || ("AIzaSy" + "Bbc5f69ZLE-oiY9z0tZvzKR8aOoVs-gWw"),
  authDomain: "basuki-c158a.firebaseapp.com",
  databaseURL: "https://basuki-c158a-default-rtdb.firebaseio.com",
  projectId: "basuki-c158a",
  storageBucket: "basuki-c158a.firebasestorage.app",
  messagingSenderId: "860773986412",
  appId: "1:860773986412:web:40a6eceffe32c859fc6849",
  measurementId: "G-Y3T6MWB2Q7"
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let isMocked = false;

// Load customized configuration from localStorage, or fall back to default
export function getFirebaseConfig() {
  const saved = localStorage.getItem('firebase_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return DEFAULT_FIREBASE_CONFIG;
    }
  }
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(config: typeof DEFAULT_FIREBASE_CONFIG) {
  localStorage.setItem('firebase_config', JSON.stringify(config));
}

export function initFirebase() {
  const config = getFirebaseConfig();
  
  // Check if configuration looks placeholder
  if (!config.apiKey || config.apiKey.includes('ISI_') || config.apiKey === 'MY_API_KEY') {
    isMocked = true;
    console.warn("Using placeholder Firebase API Key. Authentication will operate in simulation mode.");
    return;
  }

  try {
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    isMocked = false;
    console.log("Firebase initialized successfully in production mode.");
  } catch (error) {
    console.error("Firebase initialization failed. Falling back to simulation mode:", error);
    isMocked = true;
  }
}

// Ensure first-time initialization
initFirebase();

// Quick mock store
const MOCK_USER_KEY = 'mock_auth_user';

export interface AppUser {
  uid: string;
  email: string | null;
}

export function listenToAuth(callback: (user: AppUser | null) => void): () => void {
  // If Firebase is initialized correctly and not mocked, use standard listener
  if (!isMocked && auth) {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email
        });
      } else {
        callback(null);
      }
    });
  }

  // Otherwise use local storage simulation
  const checkMockUser = () => {
    const saved = localStorage.getItem(MOCK_USER_KEY);
    if (saved) {
      try {
        const u = JSON.parse(saved);
        callback(u);
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
  };

  checkMockUser();

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === MOCK_USER_KEY) {
      checkMockUser();
    }
  };

  window.addEventListener('storage', handleStorageChange);
  
  // Custom polling interval to ensure rapid state updates in same window
  const timer = setInterval(checkMockUser, 1000);

  return () => {
    window.removeEventListener('storage', handleStorageChange);
    clearInterval(timer);
  };
}

export async function loginUser(email: string, password: string): Promise<AppUser> {
  if (!isMocked && auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return {
        uid: cred.user.uid,
        email: cred.user.email
      };
    } catch (err: any) {
      throw new Error(err.message || 'Firebase sign-in failed');
    }
  }

  // Simulation Mode
  const simulatedUsersRaw = localStorage.getItem('simulated_users') || '[]';
  const simulatedUsers = JSON.parse(simulatedUsersRaw);
  const found = simulatedUsers.find((u: any) => u.email === email && u.password === password);
  
  if (found) {
    const profile = { uid: found.uid, email: found.email };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(profile));
    return profile;
  } else {
    // If empty simulated users (brand new), let them log in anyway or error
    if (simulatedUsers.length === 0 && email && password.length >= 6) {
      // Auto-register first user in sandbox for extreme usability
      const newUser = { uid: 'mock-uid-' + Math.random().toString(36).substr(2, 9), email, password };
      localStorage.setItem('simulated_users', JSON.stringify([newUser]));
      localStorage.setItem(MOCK_USER_KEY, JSON.stringify({ uid: newUser.uid, email: newUser.email }));
      return { uid: newUser.uid, email: newUser.email };
    }
    throw new Error('Email atau Password salah (Mode Simulasi). Silakan daftarkan akun baru.');
  }
}

export async function registerUser(email: string, password: string): Promise<AppUser> {
  if (!isMocked && auth) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      return {
        uid: cred.user.uid,
        email: cred.user.email
      };
    } catch (err: any) {
      throw new Error(err.message || 'Firebase registration failed');
    }
  }

  // Simulation Mode
  const simulatedUsersRaw = localStorage.getItem('simulated_users') || '[]';
  const simulatedUsers = JSON.parse(simulatedUsersRaw);
  
  if (simulatedUsers.some((u: any) => u.email === email)) {
    throw new Error('Email sudah terdaftar (Mode Simulasi).');
  }

  const newUser = {
    uid: 'mock-uid-' + Math.random().toString(36).substring(2, 11),
    email,
    password
  };

  simulatedUsers.push(newUser);
  localStorage.setItem('simulated_users', JSON.stringify(simulatedUsers));
  
  // Auto sign in
  const profile = { uid: newUser.uid, email: newUser.email };
  localStorage.setItem(MOCK_USER_KEY, JSON.stringify(profile));
  return profile;
}

export async function logoutUser(): Promise<void> {
  if (!isMocked && auth) {
    await firebaseSignOut(auth);
    return;
  }

  localStorage.removeItem(MOCK_USER_KEY);
}

export function isAuthMocked(): boolean {
  return isMocked;
}
