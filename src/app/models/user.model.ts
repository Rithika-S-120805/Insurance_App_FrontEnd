export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
  AGENT = 'AGENT'
}

export interface User {
  userId?: number;
  user_id?: number;
  username: string;
  password?: string;
  fullName: string;
  email: string;
  role: UserRole;
  agent_id?: number;
  agentId?: number;
}
