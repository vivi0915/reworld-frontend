export type Member = {
  id: string;
  username: string;
  displayName: string;
  phone: string;
  email: string;
  accessRole: "member" | "admin";
  createdAt: string;
  playerId: string;
  phoneVerified: number;
  status: 'active' | 'suspended';
  lastLoginAt: string | null;
};
