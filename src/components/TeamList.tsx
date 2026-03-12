'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiEdit, FiTrash2, FiUsers } from 'react-icons/fi';

interface Team {
  id: number;
  name: string;
  weekdayMorningSlots: number;
  weekdayIntermediateSlots: number;
  weekdayAfternoonSlots: number;
  weekdayNightSlots: number;
  weekendMorningSlots: number;
  weekendIntermediateSlots: number;
  weekendAfternoonSlots: number;
  weekendNightSlots: number;
  shiftValue: number | null | undefined;
}

export default function TeamList() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch('/api/teams');
        if (!response.ok) {
          throw new Error('Falha ao buscar dados');
        }
        const data = await response.json();
        setTeams(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  if (loading) return <p>Carregando...</p>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <>
      {/* Desktop: Tabela */}
      {!isMobile && (
        <div className="table-container">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Manhã (Útil/FDS)</th>
                <th>Intermediário (Útil/FDS)</th>
                <th>Tarde (Útil/FDS)</th>
                <th>Noite (Útil/FDS)</th>
                <th>Valor do Plantão</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td>{team.name}</td>
                  <td>{team.weekdayMorningSlots} / {team.weekendMorningSlots}</td>
                  <td>{team.weekdayIntermediateSlots} / {team.weekendIntermediateSlots}</td>
                  <td>{team.weekdayAfternoonSlots} / {team.weekendAfternoonSlots}</td>
                  <td>{team.weekdayNightSlots} / {team.weekendNightSlots}</td>
                  <td>R$ {(Number(team.shiftValue) || 0).toFixed(2)}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => router.push(`/teams/edit/${team.id}`)}
                    >
                      <FiEdit />
                    </button>
                    <button className="btn btn-sm btn-outline-danger">
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile: Cards */}
      {isMobile && (
        <div className="space-y-3">
          {teams.map((team) => (
            <div key={team.id} className="bg-white rounded-lg border shadow-sm p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <FiUsers className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-base">{team.name}</h3>
                  <p className="text-sm text-green-600 font-medium">R$ {(Number(team.shiftValue) || 0).toFixed(2)}</p>
                </div>
              </div>
              
              <div className="space-y-2 mb-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Vagas por Período (Útil / FDS)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-600">🌅 Manhã</p>
                      <p className="font-semibold text-gray-900">{team.weekdayMorningSlots} / {team.weekendMorningSlots}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">☀️ Intermediário</p>
                      <p className="font-semibold text-gray-900">{team.weekdayIntermediateSlots} / {team.weekendIntermediateSlots}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">🌤️ Tarde</p>
                      <p className="font-semibold text-gray-900">{team.weekdayAfternoonSlots} / {team.weekendAfternoonSlots}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">🌙 Noite</p>
                      <p className="font-semibold text-gray-900">{team.weekdayNightSlots} / {team.weekendNightSlots}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/teams/edit/${team.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors"
                >
                  <FiEdit className="w-4 h-4" />
                  Editar
                </button>
                <button
                  className="flex items-center justify-center px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium hover:bg-red-100 active:bg-red-200 transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
