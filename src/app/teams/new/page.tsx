'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import AuthLayout from '@/components/AuthLayout';
import TeamSlotsForm from '@/components/TeamSlotsForm';
import { createEmptyTeamSlotPayload } from '@/lib/shift-team-slots';

export default function NewTeamPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slots, setSlots] = useState(createEmptyTeamSlotPayload());
  const [shiftValue, setShiftValue] = useState(0);
  const [shiftValueDisplay, setShiftValueDisplay] = useState('0,00');
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slots,
          shiftValue,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Falha ao criar equipe');
      }

      router.push('/teams');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <AuthLayout title="Nova Equipe">
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
        </div>

        <TeamSlotsForm value={slots} onChange={setSlots} />

        <div className="mt-4">
          <button type="submit" className="btn btn-primary">Salvar</button>
          <button type="button" className="btn btn-secondary ms-2" onClick={() => router.back()}>
            Cancelar
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
