import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lock } from 'lucide-react';

/**
 * Read-only banner shown when the team has been deactivated by an admin.
 * Members can still view past records but cannot create/edit anything.
 */
export default function DeactivatedBanner({ startupName }: { startupName?: string }) {
  return (
    <Alert variant="destructive" className="border-destructive/40">
      <Lock className="h-4 w-4" />
      <AlertTitle>Team Deactivated</AlertTitle>
      <AlertDescription>
        {startupName ? `"${startupName}" ` : 'This team '}has been deactivated by an administrator.
        You can still view past records, but cannot add or change anything until the team is reactivated.
      </AlertDescription>
    </Alert>
  );
}
