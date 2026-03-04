'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiEdit, FiTrash2 } from 'react-icons/fi';

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
  );
}
