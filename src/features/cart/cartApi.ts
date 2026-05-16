import type { User } from "../auth/auth.api";

export const getStoredAccessToken = (): string | null => null;
export const getStoredUser = (): User | null => null;
export const persistAuthSession = (_accessToken: string, _user: User): void => undefined;
export const clearAuthSession = (): void => undefined;
