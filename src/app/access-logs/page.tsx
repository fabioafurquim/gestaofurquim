import { redirect } from 'next/navigation';

export default function AccessLogsPage() {
  redirect('/maintenance?tab=access-logs');
}
