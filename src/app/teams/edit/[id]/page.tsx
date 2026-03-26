'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AuthLayout from '@/components/AuthLayout';
import TeamPriceHistoryManager from '@/components/TeamPriceHistoryManager';
import TeamSlotsForm from '@/components/TeamSlotsForm';
import {
  buildTeamSlotPayloadFromSlots,
  createEmptyTeamSlotPayload,
  type ActiveShiftTeamSlot,
} from '@/lib/shift-team-slots';

interface Team {
  id: number;
  name: string;
  shiftValue: number;
  shiftSlots: ActiveShiftTeamSlot[];
}

export default function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string>('');
  const [team, setTeam] = useState<Team | null>(null);
  const [name, setName] = useState('');
  const [slots, setSlots] = useState(createEmptyTeamSlotPayload());
  const [shiftValue, setShiftValue] = useState(0);
  const [shiftValueDisplay, setShiftValueDisplay] = useState('0,00');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (value: number): string =>
    value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const parseCurrency = (value: string): number => {
    const cleanValue = value.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };

  const handleShiftValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const cleanValue = inputValue.replace(/[^\d,]/g, '');
    const parts = cleanValue.split(',');

    if (parts[1] && parts[1].length > 2) {
      parts[1] = parts[1].substring(0, 2);
    }

    const formattedValue = parts.join(',');
    setShiftValueDisplay(formattedValue);
    setShiftValue(parseCurrency(formattedValue));
  };

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };

    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;

    const fetchTeam = async () => {
      try {
        const response = await fetch(`/api/teams/${id}`);

        if (!response.ok) {
          throw new Error('Falha ao buscar equipe');
        }

        const data = (await response.json()) as Team;
        setTeam(data);
        setName(data.name);
        setSlots(buildTeamSlotPayloadFromSlots(data.shiftSlots ?? []));
        const teamShiftValue = Number(data.shiftValue || 0);
        setShiftValue(teamShiftValue);
        setShiftValueDisplay(formatCurrency(teamShiftValue));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch(`/api/teams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slots,
          shiftValue,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Falha ao atualizar equipe');
      }

      router.push('/teams');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <p>Carregando...</p>;
  if (error && !team) return <div className="alert alert-danger">{error}</div>;
  if (!team) return <p>Equipe não encontrada.</p>;

  return (
    <AuthLayout title="Editar Equipe">
      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="name" className="form-label">Nome da Equipe</label>
          <input
            type="text"
            className="form-control"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="shiftValue" className="form-label">Valor do Plantão (R$)</label>
          <input
            type="text"
            className="form-control"
            id="shiftValue"
            value={shiftValueDisplay}
            onChange={handleShiftValueChange}
            placeholder="0,00"
          />
          <small className="text-muted">
            Alterações por este campo valem imediatamente. Para agendar valores futuros ou corrigir vigências antigas, use o gerenciador de histórico abaixo.
          </small>
        </div>

        <TeamSlotsForm value={slots} onChange={setSlots} />

        <div className="mt-4">
          <button type="submit" className="btn btn-primary">Salvar Alterações</button>
          <button type="button" className="btn btn-secondary ms-2" onClick={() => router.back()}>
            Cancelar
          </button>
        </div>
      </form>

      <TeamPriceHistoryManager teamId={Number(id)} />
    </AuthLayout>
  );
}
