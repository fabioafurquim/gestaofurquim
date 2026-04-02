import { redirect } from 'next/navigation';

interface PaymentControlMonthPageProps {
  params: Promise<{ month: string }>;
}

export default async function PaymentControlMonthPage({ params }: PaymentControlMonthPageProps) {
  const { month } = await params;
  redirect(`/financial-closing/${month}`);
}
