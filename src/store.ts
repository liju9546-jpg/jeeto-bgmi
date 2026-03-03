import { create } from 'zustand';
import { db, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot } from './firebase';
import { Match, User, AddCashRequest, WithdrawalRequest, SupportTicket, Broadcast, AdminUser } from './types';

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
  registerPlayer: (matchId: string, bgmiName: string, characterId: string, upiId: string) => Promise<{ success: boolean; message: string; slotNumber?: number }>;
  verifyPlayer: (matchId: string, playerId: string) => Promise<void>;
  banPlayer: (matchId: string, playerId: string) => Promise<void>;
  approvePayment: (matchId: string, playerId: string) => Promise<void>;
  rejectPayment: (matchId: string, playerId: string) => Promise<void>;
  announceWinners: (matchId: string, first: string, second: string, third: string) => Promise<void>;
  uploadQRCode: (matchId: string, qrCode: string) => Promise<void>;

  submitAddCash: (userId: string, userName: string, email: string, bgmiName: string, amount: number) => Promise<void>;
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
  // Init auth from localStorage
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
      // Listen to matches
      onSnapshot(collection(db, 'matches'), (snap) => {
        const matches = snap.docs.map(d => ({ ...d.data(), id: d.id } as Match));
        set({ matches });
        // Auto status update
        const now = new Date();
        matches.forEach(async (m) => {
          if (m.status === 'open' && m.date && m.time) {
            const matchTime = new Date(`${m.date}T${m.time}`);
            const diff = matchTime.getTime() - now.getTime();
            if (diff <= 0) {
              await updateDoc(doc(db, 'matches', m.id), { status: 'live' });
            }
          }
        });
      });

      // Listen to addCash
      onSnapshot(collection(db, 'addCashRequests'), (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as AddCashRequest));
        set({ addCashRequests: reqs });
      });

      // Listen to withdrawals
      onSnapshot(collection(db, 'withdrawalRequests'), (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as WithdrawalRequest));
        set({ withdrawalRequests: reqs });
      });

      // Listen to support
      onSnapshot(collection(db, 'supportTickets'), (snap) => {
        const tickets = snap.docs.map(d => ({ ...d.data(), id: d.id } as SupportTicket));
        set({ supportTickets: tickets });
      });

      // Listen to broadcast
      onSnapshot(doc(db, 'settings', 'broadcast'), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Broadcast;
          if (data.expiresAt > Date.now()) {
            set({ broadcast: data });
          } else {
            set({ broadcast: null });
          }
        }
      });

      // Refresh user data
      const { currentUser } = get();
      if (currentUser) {
        getDoc(doc(db, 'users', currentUser.id)).then(snap => {
          if (snap.exists()) {
            const userData = { ...snap.data(), id: snap.id } as User;
            set({ currentUser: userData });
            localStorage.setItem('jeeto_user_data', JSON.stringify(userData));
          }
        });
      }

      // Auto logout check
      setInterval(() => {
        const loginTime = localStorage.getItem('jeeto_login_time');
        if (loginTime) {
          const elapsed = Date.now() - parseInt(loginTime);
          if (elapsed >= 2 * 60 * 60 * 1000) {
            get().logoutUser();
          }
        }
      }, 30000);
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
        const emailExists = usersSnap.docs.some(d => d.data().email === data.email);
        if (emailExists) return { success: false, message: 'Email already registered!' };

        const id = generateId();
        const newUser: User = {
          id, email: data.email, password: data.password,
          displayName: data.displayName, bgmiName: data.bgmiName,
          characterId: data.characterId || '', upiId: data.upiId || '',
          walletBalance: 0, couponBalance: 0,
          referralCode: generateReferralCode(),
          referredBy: '', totalMatches: 0, totalWinnings: 0,
          achievements: [], banned: false, createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', id), newUser);
        return { success: true, message: 'Account created! Please login.' };
      } catch (e) {
        return { success: false, message: 'Error creating account. Try again!' };
      }
    },

    loginUser: async (email, password) => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const userDoc = usersSnap.docs.find(d => d.data().email === email && d.data().password === password);
        if (!userDoc) return { success: false, message: 'Invalid email or password!' };
        
        const userData = { ...userDoc.data(), id: userDoc.id } as User;
        if (userData.banned) return { success: false, message: 'Account banned! Contact support.' };
        
        localStorage.setItem('jeeto_user_id', userData.id);
        localStorage.setItem('jeeto_login_time', String(Date.now()));
        localStorage.setItem('jeeto_user_data', JSON.stringify(userData));
        set({ currentUser: userData });
        return { success: true, message: 'Login successful!' };
      } catch (e) {
        return { success: false, message: 'Login failed. Try again!' };
      }
    },

    logoutUser: () => {
      localStorage.removeItem('jeeto_user_id');
      localStorage.removeItem('jeeto_login_time');
      localStorage.removeItem('jeeto_user_data');
      set({ currentUser: null, page: 'home' });
    },

    updateUserProfile: async (userId, data) => {
      await updateDoc(doc(db, 'users', userId), data);
      const { currentUser } = get();
      if (currentUser && currentUser.id === userId) {
        const updated = { ...currentUser, ...data };
        set({ currentUser: updated });
        localStorage.setItem('jeeto_user_data', JSON.stringify(updated));
      }
    },

    createMatch: async (data) => {
      const id = generateId();
      const match: Match = {
        id, name: data.name || `${data.map} ${data.type}`,
        map: data.map || 'Erangel', type: data.type || 'Solo',
        date: data.date || '', time: data.time || '',
        status: 'open', registeredPlayers: 0,
        maxPlayers: data.maxPlayers || 100,
        entryFee: data.entryFee || 20,
        customPrizePool: 0, prizeFirst: 0, prizeSecond: 0, prizeThird: 0,
        roomId: '', roomPassword: '', players: [],
        winners: { first: '', second: '', third: '' },
        qrCode: '', createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'matches', id), match);
    },

    updateMatch: async (matchId, data) => {
      await updateDoc(doc(db, 'matches', matchId), data);
    },

    deleteMatch: async (matchId) => {
      await deleteDoc(doc(db, 'matches', matchId));
    },

    registerPlayer: async (matchId, bgmiName, characterId, upiId) => {
      const { matches, currentUser } = get();
      const match = matches.find(m => m.id === matchId);
      if (!match) return { success: false, message: 'Match not found!' };
      if (match.registeredPlayers >= match.maxPlayers) return { success: false, message: 'Match is full!' };
      if (match.status !== 'open') return { success: false, message: 'Registration closed!' };

      const duplicate = match.players.find(p => p.characterId === characterId);
      if (duplicate) return { success: false, message: 'Character ID already registered!' };

      const userAlreadyRegistered = match.players.find(p => p.bgmiName === bgmiName && currentUser?.bgmiName === bgmiName);
      if (userAlreadyRegistered) return { success: false, message: 'Already registered for this match!' };

      const slotNumber = match.registeredPlayers + 1;
      const player = {
        id: generateId(), bgmiName, characterId, upiId,
        slotNumber, verified: false, paymentStatus: 'pending' as const,
        banned: false, registeredAt: new Date().toISOString()
      };

      const updatedPlayers = [...match.players, player];
      await updateDoc(doc(db, 'matches', matchId), {
        players: updatedPlayers,
        registeredPlayers: slotNumber
      });

      if (currentUser) {
        await updateDoc(doc(db, 'users', currentUser.id), {
          totalMatches: (currentUser.totalMatches || 0) + 1
        });
      }

      return { success: true, message: 'Registered successfully!', slotNumber };
    },

    verifyPlayer: async (matchId, playerId) => {
      const { matches } = get();
      const match = matches.find(m => m.id === matchId);
      if (!match) return;
      const players = match.players.map(p => p.id === playerId ? { ...p, verified: true } : p);
      await updateDoc(doc(db, 'matches', matchId), { players });
    },

    banPlayer: async (matchId, playerId) => {
      const { matches } = get();
      const match = matches.find(m => m.id === matchId);
      if (!match) return;
      const players = match.players.map(p => p.id === playerId ? { ...p, banned: true } : p);
      await updateDoc(doc(db, 'matches', matchId), { players });
    },

    approvePayment: async (matchId, playerId) => {
      const { matches } = get();
      const match = matches.find(m => m.id === matchId);
      if (!match) return;
      const players = match.players.map(p => p.id === playerId ? { ...p, paymentStatus: 'approved' as const, verified: true } : p);
      await updateDoc(doc(db, 'matches', matchId), { players });
    },

    rejectPayment: async (matchId, playerId) => {
      const { matches } = get();
      const match = matches.find(m => m.id === matchId);
      if (!match) return;
      const players = match.players.map(p => p.id === playerId ? { ...p, paymentStatus: 'rejected' as const } : p);
      await updateDoc(doc(db, 'matches', matchId), { players });
    },

    announceWinners: async (matchId, first, second, third) => {
      await updateDoc(doc(db, 'matches', matchId), {
        winners: { first, second, third }, status: 'done'
      });
    },

    uploadQRCode: async (matchId, qrCode) => {
      await updateDoc(doc(db, 'matches', matchId), { qrCode });
    },

    submitAddCash: async (userId, userName, email, bgmiName, amount) => {
      const id = generateId();
      const req: AddCashRequest = {
        id, userId, userName, userEmail: email, bgmiName, amount,
        status: 'pending', createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'addCashRequests', id), req);
    },

    approveAddCash: async (requestId, userId, amount) => {
      await updateDoc(doc(db, 'addCashRequests', requestId), { status: 'approved' });
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        const user = userSnap.data() as User;
        await updateDoc(doc(db, 'users', userId), { walletBalance: (user.walletBalance || 0) + amount });
        const { currentUser } = get();
        if (currentUser?.id === userId) {
          const updated = { ...currentUser, walletBalance: (currentUser.walletBalance || 0) + amount };
          set({ currentUser: updated });
          localStorage.setItem('jeeto_user_data', JSON.stringify(updated));
        }
      }
    },

    rejectAddCash: async (requestId) => {
      await updateDoc(doc(db, 'addCashRequests', requestId), { status: 'rejected' });
    },

    submitWithdrawal: async (userId, userName, email, bgmiName, upiId, amount) => {
      const { currentUser } = get();
      if (!currentUser || currentUser.walletBalance < amount) return;
      const id = generateId();
      await setDoc(doc(db, 'withdrawalRequests', id), {
        id, userId, userName, userEmail: email, bgmiName, upiId, amount,
        status: 'pending', createdAt: new Date().toISOString()
      });
      const newBalance = currentUser.walletBalance - amount;
      await updateDoc(doc(db, 'users', userId), { walletBalance: newBalance });
      const updated = { ...currentUser, walletBalance: newBalance };
      set({ currentUser: updated });
      localStorage.setItem('jeeto_user_data', JSON.stringify(updated));
    },

    approveWithdrawal: async (requestId, _userId, _amount) => {
      await updateDoc(doc(db, 'withdrawalRequests', requestId), { status: 'approved' });
    },

    rejectWithdrawal: async (requestId, userId, amount) => {
      await updateDoc(doc(db, 'withdrawalRequests', requestId), { status: 'rejected' });
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        const user = userSnap.data() as User;
        await updateDoc(doc(db, 'users', userId), { walletBalance: (user.walletBalance || 0) + amount });
        const { currentUser } = get();
        if (currentUser?.id === userId) {
          const updated = { ...currentUser, walletBalance: (currentUser.walletBalance || 0) + amount };
          set({ currentUser: updated });
          localStorage.setItem('jeeto_user_data', JSON.stringify(updated));
        }
      }
    },

    submitSupport: async (data) => {
      const id = generateId();
      await setDoc(doc(db, 'supportTickets', id), {
        ...data, id, status: 'open', createdAt: new Date().toISOString()
      });
    },

    setBroadcast: async (message, duration) => {
      const expiresAt = Date.now() + duration * 60 * 1000;
      const broadcast: Broadcast = { id: generateId(), message, expiresAt, createdAt: new Date().toISOString() };
      await setDoc(doc(db, 'settings', 'broadcast'), broadcast);
      set({ broadcast });
    },

    clearBroadcast: async () => {
      await setDoc(doc(db, 'settings', 'broadcast'), { expiresAt: 0, message: '' });
      set({ broadcast: null });
    },

    banUser: async (userId) => {
      await updateDoc(doc(db, 'users', userId), { banned: true });
    },

    unbanUser: async (userId) => {
      await updateDoc(doc(db, 'users', userId), { banned: false });
    },
  };
});
