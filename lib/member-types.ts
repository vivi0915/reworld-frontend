export type Member = {
  id: string;
  username: string;
  displayName: string;
  phone: string;
  email: string;
  accessRole: "member" | "admin";
  createdAt: string;
};
