import { useAuth } from '../lib/AuthContext';
import { isJklbPremium } from '../lib/flags';

export function usePremium(): { isPremium: boolean } {
  const { profile } = useAuth();
  return { isPremium: isJklbPremium(profile?.handle) };
}
