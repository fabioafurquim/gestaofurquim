'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FiHome, FiUsers, FiSettings, FiFileText, FiFile, FiDollarSign, FiCalendar } from 'react-icons/fi';
import { usePathname } from 'next/navigation';

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <div className="bg-gradient-to-b from-blue-600 to-blue-800 text-white w-64 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 text-center border-b border-blue-500">
        <div className="w-40 h-40 mx-auto mb-3">
          <Image src="/logo.png" alt="Logo" className="w-full h-full object-contain" width={160} height={160} />
        </div>
        <h1 className="text-sm font-medium text-white text-center">PlantãoFisio</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-4 space-y-2">
        <Link href="/" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
          pathname === '/'
            ? 'bg-white/20 text-white'
            : 'text-white hover:bg-white/10 hover:text-white'
        }`}>
          <FiHome className="mr-3" size={20} />
          <span>Dashboard</span>
        </Link>
        <Link href="/physiotherapists" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
          pathname === '/physiotherapists'
            ? 'bg-white/20 text-white'
            : 'text-white hover:bg-white/10 hover:text-white'
        }`}>
          <FiUsers className="mr-3" size={20} />
          <span>Fisioterapeutas</span>
        </Link>
        <Link href="/shifts" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
          pathname === '/shifts'
            ? 'bg-white/20 text-white'
            : 'text-white hover:bg-white/10 hover:text-white'
        }`}>
          <FiUsers className="mr-3" size={20} />
          <span>Plantões</span>
        </Link>
        <Link href="/teams" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
          pathname === '/teams'
            ? 'bg-white/20 text-white'
            : 'text-white hover:bg-white/10 hover:text-white'
        }`}>
          <FiSettings className="mr-3" size={20} />
          <span>Equipes</span>
        </Link>
        <Link href="/holidays" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
          pathname === '/holidays'
            ? 'bg-white/20 text-white'
            : 'text-white hover:bg-white/10 hover:text-white'
        }`}>
          <FiCalendar className="mr-3" size={20} />
          <span>Feriados</span>
        </Link>
        <Link href="/reports/financial" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
          pathname === '/reports/financial'
            ? 'bg-white/20 text-white'
            : 'text-white hover:bg-white/10 hover:text-white'
        }`}>
          <FiFileText className="mr-3" size={20} />
          <span>Relatórios Financeiros</span>
        </Link>
        <Link href="/contracts" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
          pathname.startsWith('/contracts')
            ? 'bg-white/20 text-white'
            : 'text-white hover:bg-white/10 hover:text-white'
        }`}>
          <FiFile className="mr-3" size={20} />
          <span>Contratos</span>
        </Link>
        <Link href="/payments" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
          pathname.startsWith('/payments')
            ? 'bg-white/20 text-white'
            : 'text-white hover:bg-white/10 hover:text-white'
        }`}>
          <FiDollarSign className="mr-3" size={20} />
          <span>Pagamentos</span>
        </Link>
        <Link href="/payment-control" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
          pathname.startsWith('/payment-control')
            ? 'bg-white/20 text-white'
            : 'text-white hover:bg-white/10 hover:text-white'
        }`}>
          <FiDollarSign className="mr-3" size={20} />
          <span>Controle de Pagamentos</span>
        </Link>
      </nav>
    </div>
  );
};

export default Sidebar;
