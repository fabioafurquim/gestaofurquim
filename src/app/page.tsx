'use client';

import AuthLayout from '@/components/AuthLayout';
import ShiftCalendar from '@/components/ShiftCalendar';

export default function DashboardPage() {
  return (
    <AuthLayout title="Dashboard de Plantões">
      <ShiftCalendar />
    </AuthLayout>
  );
}
