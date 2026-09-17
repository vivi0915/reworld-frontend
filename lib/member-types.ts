export type Member = {
  id: string;
  username: string;
  displayName: string;
  phone: string | null;
  email: string;
  accessRole: "member" | "admin";
  createdAt: string;
  playerId: string;
  phoneVerified: number;
  phoneVerifiedAt: string | null;
  status: 'active' | 'suspended';
  lastLoginAt: string | null;
};
