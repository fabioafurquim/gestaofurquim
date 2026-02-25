'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FiEdit, FiUserX, FiUserCheck } from 'react-icons/fi';
import { Physiotherapist, ShiftTeam } from '@prisma/client';

interface PhysioWithTeam extends Physiotherapist {
  shiftTeam: ShiftTeam;
}

function translateContractType(ct: string) {
  if (ct === 'NO_CONTRACT') return 'Sem vínculo';
  return ct; // PJ e RPA já são termos usuais
}

export default function PhysiotherapistList() {
  const [physiotherapists, setPhysiotherapists] = useState<PhysioWithTeam[]>([]);
  const [teams, setTeams] = useState<ShiftTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [searchName, setSearchName] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [physiosRes, teamsRes] = await Promise.all([
          fetch('/api/physiotherapists'),
          fetch('/api/teams'),
        ]);
        if (!physiosRes.ok) throw new Error('Falha ao buscar fisioterapeutas');
        if (!teamsRes.ok) throw new Error('Falha ao buscar equipes');
        const [physios, teams] = await Promise.all([physiosRes.json(), teamsRes.json()]);
        setPhysiotherapists(physios);
        setTeams(teams);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filteredPhysios = useMemo(() => {
    let data = physiotherapists;
    if (statusFilter) data = data.filter(p => p.status === statusFilter);
    if (teamFilter) data = data.filter(p => (p.shiftTeam?.id ?? 0) === Number(teamFilter));
    if (searchName.trim()) {
      const q = searchName.toLowerCase();
      data = data.filter(p => p.name.toLowerCase().includes(q));
    }
    return data;
  }, [physiotherapists, statusFilter, teamFilter, searchName]);

  const handleDeactivate = async (physio: Physiotherapist) => {
    const today = new Date();
    const defaultDate = today.toISOString().slice(0, 10);
    const input = window.prompt(
      `Informe a data de saída para ${physio.name} (AAAA-MM-DD)`,
      defaultDate
    );
    if (!input) return;
    const exitDate = input;

    try {
      const response = await fetch(`/api/physiotherapists/${physio.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE', exitDate }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Falha ao desligar o funcionário.');

      setPhysiotherapists(prev =>
        prev.map(p =>
          p.id === physio.id ? { ...p, status: 'INACTIVE', exitDate: new Date(exitDate) as any } : p
        ) as any
      );
      alert('Funcionário desligado com sucesso.');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReactivate = async (physio: Physiotherapist) => {
    try {
      const response = await fetch(`/api/physiotherapists/${physio.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE', exitDate: null }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Falha ao reativar o funcionário.');

      setPhysiotherapists(prev =>
        prev.map(p => (p.id === physio.id ? { ...p, status: 'ACTIVE', exitDate: null as any } : p)) as any
      );
      alert('Funcionário reativado com sucesso.');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatDate = (d: any) => {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return '—';
    return date.toISOString().slice(0, 10);
  };

  if (loading) return <p>Carregando...</p>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <div className="row g-3 mb-3 align-items-end">
        <div className="col-auto">
          <label className="form-label mb-0">Buscar por nome</label>
          <input
            type="text"
            className="form-control"
            placeholder="Digite o nome"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>
        <div className="col-auto">
          <label className="form-label mb-0">Status</label>
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>
        <div className="col-auto">
          <label className="form-label mb-0">Equipe</label>
          <select className="form-select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">Todas</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
      </div>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>Nome</th>
            <th>CREFITO</th>
            <th>Tipo Contrato</th>
            <th>Status</th>
            <th>Saída</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filteredPhysios.map((physio) => (
            <tr key={physio.id}>
              <td>{physio.name}</td>
              <td>{physio.crefito}</td>
              <td>{translateContractType(physio.contractType as any)}</td>
              <td>
                <span className={`badge ${physio.status === 'ACTIVE' ? 'bg-success' : 'bg-secondary'}`}>
                  {physio.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td>{formatDate((physio as any).exitDate)}</td>
              <td>
                <button
                  className="btn btn-sm btn-light me-2"
                  onClick={() => router.push(`/physiotherapists/edit/${physio.id}`)}
                  title="Editar"
                >
                  <FiEdit />
                </button>
                {physio.status === 'ACTIVE' ? (
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDeactivate(physio)}
                    title="Desligar"
                  >
                    <FiUserX />
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-outline-success"
                    onClick={() => handleReactivate(physio)}
                    title="Reativar"
                  >
                    <FiUserCheck />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}