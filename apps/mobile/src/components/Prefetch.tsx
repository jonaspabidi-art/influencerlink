import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '../auth';
import { prefetchTabs } from '../queries';

/**
 * Hämtar flikarnas innehåll i bakgrunden så fort vi vet vem som är inloggad.
 *
 * Första besöket i varje flik är det enda tillfälle där användaren faktiskt
 * väntar – därefter ligger allt kvar i minnet. Medan hen läser startskärmen
 * hinner resten komma, och nästa flik är ifylld när hen kommer dit.
 *
 * prefetchQuery hoppar över det som redan är färskt, så inget hämtas två
 * gånger, och ett fel här är tyst: skärmen gör om anropet och visar felet på
 * riktigt om det kvarstår.
 */
export function Prefetch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.onboardingComplete) return;
    prefetchTabs(queryClient, user.role);
  }, [user?.role, user?.onboardingComplete, queryClient]);

  return null;
}
