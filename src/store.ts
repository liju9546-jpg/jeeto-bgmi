import { create } from 'zustand';
import { db, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot } from './firebase';
import { Match, User, AddCashRequest, WithdrawalRequest, SupportTicket, Broadcast, AdminUser } from './types';
// Telegram functions import kiye
import { 
  sendRegistrationToTelegram, 
  sendAddCashToTelegram, 
  sendSupportToTelegram,
  sendFraudAlertToTelegram 
} from './telegram';

const ADMIN_CREDENTIALS = [
  { email: 'shantanuvishwakarma877@gmail.com', password: '6392821977', name: 'Super Admin', role: 'superadmin' as const },
  { email: 'lijuhanuma12@gmail.com', password: '6392821977', name: 'Admin', role: 'admin' as const }
];

const generateId = () => Math.random().toString(36).substr(2, 9);
const generateReferralCode = () => Math.random().toString(36).substr(2, 6).toUpperCase();

interface Store {
  matches: Match[];
  currentUser: User | null;
  isAdminLoggedIn: boolean;
  currentAdmin: AdminUser | null;
  addCashRequests: AddCashRequest[];
  withdrawalRequests: WithdrawalRequest[];
  supportTickets: SupportTicket[];
  broadcast: Broadcast | null;
  theme: 'red' | 'blue' | 'purple';
  soundEnabled: boolean;
  page: string;
  loading: boolean;

  initStore: () => void;
  setPage: (page: string) => void;
  setTheme: (theme: 'red' | 'blue' | 'purple') => void;
  toggleSound: () => void;

  loginAdmin: (email: string, password: string) => boolean;
  logoutAdmin: () => void;

  signupUser: (data: { email: string; password: string; displayName: string; bgmiName: string; characterId?: string; upiId?: string }) => Promise<{ success: boolean; message: string }>;
  loginUser: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logoutUser: () => void;
  updateUserProfile: (userId: string, data: Partial<User>) => Promise<void>;

  createMatch: (data: Partial<Match>) => Promise<void>;
  updateMatch: (matchId: string, data: Partial<Match>) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  // File parameters add kiye screenshots ke liye
  registerPlayer: (matchId: string, bgmiName: string, characterId: string, upiId: string, paymentScreenshot: File, bgmiScreenshot: File) => Promise<{ success: boolean; message: string; slotNumber?: number }>;
  verifyPlayer: (matchId: string, playerId: string) => Promise<void>;
  banPlayer: (matchId: string, playerId: string) => Promise<void>;
  approvePayment: (matchId: string, playerId: string) => Promise<void>;
  rejectPayment: (matchId: string, playerId: string) => Promise<void>;
  announceWinners: (matchId: string, first: string, second: string, third: string) => Promise<void>;
  uploadQRCode: (matchId: string, qrCode: string) => Promise<void>;

  submitAddCash: (userId: string, userName: string, email: string, bgmiName: string, amount: number, screenshot: File) => Promise<void>;
  approveAddCash: (requestId: string, userId: string, amount: number) => Promise<void>;
  rejectAddCash: (requestId: string) => Promise<void>;

  submitWithdrawal: (userId: string, userName: string, email: string, bgmiName: string, upiId: string, amount: number) => Promise<void>;
  approveWithdrawal: (requestId: string, userId: string, amount: number) => Promise<void>;
  rejectWithdrawal: (requestId: string, userId: string, amount: number) => Promise<void>;

  submitSupport: (data: { userId: string; userName: string; bgmiName: string; email: string; category: string; message: string }) => Promise<void>;
  setBroadcast: (message: string, duration: number) => Promise<void>;
  clearBroadcast: () => Promise<void>;

  banUser: (userId: string) => Promise<void>;
  unbanUser: (userId: string) => Promise<void>;
}

export const useStore = create<Store>((set, get) => {
  // Init auth logic (unaltered)
  const savedUserId = localStorage.getItem('jeeto_user_id');
  const savedLoginTime = localStorage.getItem('jeeto_login_time');
  let initialUser: User | null = null;
  
  if (savedUserId && savedLoginTime) {
    const elapsed = Date.now() - parseInt(savedLoginTime);
    if (elapsed < 2 * 60 * 60 * 1000) {
      const savedUser = localStorage.getItem('jeeto_user_data');
      if (savedUser) {
        try { initialUser = JSON.parse(savedUser); } catch {}
      }
    } else {
      localStorage.removeItem('jeeto_user_id');
      localStorage.removeItem('jeeto_login_time');
      localStorage.removeItem('jeeto_user_data');
    }
  }

  const savedTheme = localStorage.getItem('jeeto_theme') as 'red' | 'blue' | 'purple' || 'red';
  const savedSound = localStorage.getItem('jeeto_sound') !== 'false';

  return {
    matches: [],
    currentUser: initialUser,
    isAdminLoggedIn: false,
    currentAdmin: null,
    addCashRequests: [],
    withdrawalRequests: [],
    supportTickets: [],
    broadcast: null,
    theme: savedTheme,
    soundEnabled: savedSound,
    page: 'home',
    loading: false,

    initStore: () => {
      onSnapshot(collection(db, 'matches'), (snap) => {
        const matches = snap.docs.map(d => ({ ...d.data(), id: d.id } as Match));
        set({ matches });
      });

      onSnapshot(collection(db, 'addCashRequests'), (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as AddCashRequest));
        set({ addCashRequests: reqs });
      });

      onSnapshot(collection(db, 'withdrawalRequests'), (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as WithdrawalRequest));
        set({ withdrawalRequests: reqs });
      });

      onSnapshot(collection(db, 'supportTickets'), (snap) => {
        const tickets = snap.docs.map(d => ({ ...d.data(), id: d.id } as SupportTicket));
        set({ supportTickets: tickets });
      });

      onSnapshot(doc(db, 'settings', 'broadcast'), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Broadcast;
          set({ broadcast: data.expiresAt > Date.now() ? data : null });
        }
      });
    },

    setPage: (page) => set({ page }),
    setTheme: (theme) => {
      localStorage.setItem('jeeto_theme', theme);
      set({ theme });
    },
    toggleSound: () => {
      const { soundEnabled } = get();
      localStorage.setItem('jeeto_sound', String(!soundEnabled));
      set({ soundEnabled: !soundEnabled });
    },

    loginAdmin: (email, password) => {
      const admin = ADMIN_CREDENTIALS.find(a => a.email === email && a.password === password);
      if (admin) {
        set({ isAdminLoggedIn: true, currentAdmin: { id: generateId(), ...admin } });
        return true;
      }
      return false;
    },
    logoutAdmin: () => set({ isAdminLoggedIn: false, currentAdmin: null, page: 'home' }),

    signupUser: async (data) => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        if (usersSnap.docs.some(d => d.data().email === data.email)) return { success: false, message: 'Email exists!' };
        const id = generateId();
        await setDoc(doc(db, 'users', id), { ...data, id, walletBalance: 0, referralCode: generateReferralCode(), createdAt: new Date().toISOString() });
        return { success: true, message: 'Account created!' };
      } catch { return { success: false, message: 'Error!' }; }
    },

    loginUser: async (email, password) => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const userDoc = usersSnap.docs.find(d => d.data().email === email && d.data().password === password);
        if (!userDoc) return { success: false, message: 'Invalid credentials!' };
        const userData = { ...userDoc.data(), id: userDoc.id } as User;
        set({ currentUser: userData });
        return { success: true, message: 'Login success!' };
      } catch { return { success: false, message: 'Failed!' }; }
    },

    logoutUser: () => {
      localStorage.clear();
      set({ currentUser: null, page: 'home' });
    },

    updateUserProfile: async (userId, data) => {
      await updateDoc(doc(db, 'users', userId), data);
    },

    createMatch: async (data) => {
      const id = generateId();
      await setDoc(doc(db, 'matches', id), { ...data, id, status: 'open', players: [], registeredPlayers: 0, createdAt: new Date().toISOString() });
    },

    updateMatch: async (matchId, data) => {
      await updateDoc(doc(db, 'matches', matchId), data);
    },

    deleteMatch: async (matchId) => {
      await deleteDoc(doc(db, 'matches', matchId));
    },

    // --- FIX: TELEGRAM INTEGRATION ADDED ---
    registerPlayer: async (matchId, bgmiName, characterId, upiId, paymentScreenshot: File, bgmiScreenshot: File) => {
      const { matches } = get();
      const match = matches.find(m => m.id === matchId);
      if (!match) return { success: false, message: 'Match not found!' };

      // Duplicate Check + Fraud Alert
      if (match.players.find(p => p.characterId === characterId)) {
        await sendFraudAlertToTelegram({ bgmiName, characterId, matchName: match.name });
        return { success: false, message: 'ID already registered!' };
      }

      const slotNumber = match.registeredPlayers + 1;
      const player = { id: generateId(), bgmiName, characterId, upiId, slotNumber, verified: false, paymentStatus: 'pending', registeredAt: new Date().toISOString() };

      await updateDoc(doc(db, 'matches', matchId), {
        players: [...match.players, player],
        registeredPlayers: slotNumber
      });

      // Send to Telegram
      await sendRegistrationToTelegram({
        bgmiName, characterId, upiId,
        matchName: match.name,
        matchTime: match.time,
        slotNumber,
        paymentScreenshot,
        bgmiScreenshot
      });

      return { success: true, message: 'Registered successfully!', slotNumber };
    },

    verifyPlayer: async (matchId, playerId) => {
      const match = get().matches.find(m => m.id === matchId);
      if (!match) return;
      const players = match.players.map(p => p.id === playerId ? { ...p, verified: true } : p);
      await updateDoc(doc(db, 'matches', matchId), { players });
    },

    banPlayer: async (matchId, playerId) => {
      const match = get().matches.find(m => m.id === matchId);
      if (!match) return;
      const players = match.players.map(p => p.id === playerId ? { ...p, banned: true } : p);
      await updateDoc(doc(db, 'matches', matchId), { players });
    },

    approvePayment: async (matchId, playerId) => {
      const match = get().matches.find(m => m.id === matchId);
      if (!match) return;
      const players = match.players.map(p => p.id === playerId ? { ...p, paymentStatus: 'approved' as const, verified: true } : p);
      await updateDoc(doc(db, 'matches', matchId), { players });
    },

    rejectPayment: async (matchId, playerId) => {
      const match = get().matches.find(m => m.id === matchId);
      if (!match) return;
      const players = match.players.map(p => p.id === playerId ? { ...p, paymentStatus: 'rejected' as const } : p);
      await updateDoc(doc(db, 'matches', matchId), { players });
    },

    announceWinners: async (matchId, first, second, third) => {
      await updateDoc(doc(db, 'matches', matchId), { winners: { first, second, third }, status: 'done' });
    },

    uploadQRCode: async (matchId, qrCode) => {
      await updateDoc(doc(db, 'matches', matchId), { qrCode });
    },

    // --- FIX: ADD CASH TELEGRAM INTEGRATION ---
    submitAddCash: async (userId, userName, email, bgmiName, amount, screenshot: File) => {
      const id = generateId();
      await setDoc(doc(db, 'addCashRequests', id), { id, userId, userName, userEmail: email, bgmiName, amount, status: 'pending', createdAt: new Date().toISOString() });
      
      // Send Photo to Telegram
      await sendAddCashToTelegram({ userName, email, bgmiName, amount, screenshot });
    },

    approveAddCash: async (requestId, userId, amount) => {
      await updateDoc(doc(db, 'addCashRequests', requestId), { status: 'approved' });
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        await updateDoc(doc(db, 'users', userId), { walletBalance: (userSnap.data().walletBalance || 0) + amount });
      }
    },

    rejectAddCash: async (requestId) => {
      await updateDoc(doc(db, 'addCashRequests', requestId), { status: 'rejected' });
    },

    submitWithdrawal: async (userId, userName, email, bgmiName, upiId, amount) => {
      const { currentUser } = get();
      if (!currentUser || currentUser.walletBalance < amount) return;
      const id = generateId();
      await setDoc(doc(db, 'withdrawalRequests', id), { id, userId, userName, userEmail: email, bgmiName, upiId, amount, status: 'pending', createdAt: new Date().toISOString() });
      await updateDoc(doc(db, 'users', userId), { walletBalance: currentUser.walletBalance - amount });
    },

    approveWithdrawal: async (requestId) => {
      await updateDoc(doc(db, 'withdrawalRequests', requestId), { status: 'approved' });
    },

    rejectWithdrawal: async (requestId, userId, amount) => {
      await updateDoc(doc(db, 'withdrawalRequests', requestId), { status: 'rejected' });
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        await updateDoc(doc(db, 'users', userId), { walletBalance: (userSnap.data().walletBalance || 0) + amount });
      }
    },

    // --- FIX: SUPPORT TELEGRAM INTEGRATION ---
    submitSupport: async (data) => {
      const id = generateId();
      await setDoc(doc(db, 'supportTickets', id), { ...data, id, status: 'open', createdAt: new Date().toISOString() });
      
      // Send Message to Telegram
      await sendSupportToTelegram({
        userName: data.userName,
        bgmiName: data.bgmiName,
        email: data.email,
        category: data.category,
        message: data.message
      });
    },

    setBroadcast: async (message, duration) => {
      const expiresAt = Date.now() + duration * 60 * 1000;
      await setDoc(doc(db, 'settings', 'broadcast'), { message, expiresAt, createdAt: new Date().toISOString() });
    },

    clearBroadcast: async () => {
      await setDoc(doc(db, 'settings', 'broadcast'), { expiresAt: 0, message: '' });
    },

    banUser: async (userId) => {
      await updateDoc(doc(db, 'users', userId), { banned: true });
    },

    unbanUser: async (userId) => {
      await updateDoc(doc(db, 'users', userId), { banned: false });
    },
  };
});
