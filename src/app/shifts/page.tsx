'use client';

import AuthLayout from '@/components/AuthLayout';
import ShiftCalendar from '@/components/ShiftCalendar';

export default function ShiftsPage() {
  return (
    <AuthLayout title="Plantões">
      <ShiftCalendar />
    </AuthLayout>
  );
}
