export interface Player {
  id: string;
  bgmiName: string;
  characterId: string;
  upiId: string;
  slotNumber: number;
  verified: boolean;
  paymentStatus: 'pending' | 'approved' | 'rejected';
  banned: boolean;
  registeredAt: string;
}

export interface Match {
  id: string;
  name: string;
  map: 'Erangel' | 'Miramar' | 'Sanhok' | 'Livik' | 'TDM';
  type: 'Solo' | 'Duo' | 'Squad';
  date: string;
  time: string;
  status: 'open' | 'live' | 'done';
  registeredPlayers: number;
  maxPlayers: number;
  entryFee: number;
  customPrizePool: number;
  prizeFirst: number;
  prizeSecond: number;
  prizeThird: number;
  roomId: string;
  roomPassword: string;
  players: Player[];
  winners: { first: string; second: string; third: string };
  qrCode: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  password: string;
  displayName: string;
  bgmiName: string;
  characterId: string;
  upiId: string;
  walletBalance: number;
  couponBalance: number;
  referralCode: string;
  referredBy: string;
  totalMatches: number;
  totalWinnings: number;
  achievements: string[];
  banned: boolean;
  createdAt: string;
}

export interface AddCashRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  bgmiName: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  bgmiName: string;
  upiId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  bgmiName: string;
  email: string;
  category: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface Broadcast {
  id: string;
  message: string;
  expiresAt: number;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'superadmin' | 'admin';
}
