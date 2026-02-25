'use client';

import Link from 'next/link';
import AuthLayout from '@/components/AuthLayout';
import PhysiotherapistList from '@/components/PhysiotherapistList';

export default function PhysiotherapistsPage() {
  return (
    <AuthLayout title="Fisioterapeutas">
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-gray-600">Gerencie os fisioterapeutas cadastrados no sistema</p>
        </div>
        <Link 
          href="/physiotherapists/new" 
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Novo Fisioterapeuta
        </Link>
      </div>
      <PhysiotherapistList />
    </AuthLayout>
  );
}
