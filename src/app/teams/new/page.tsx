'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';

export default function NewTeamPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  
  // Campos antigos (mantidos por compatibilidade)
  const [morningSlots, setMorningSlots] = useState(0);
  const [intermediateSlots, setIntermediateSlots] = useState(0);
  const [afternoonSlots, setAfternoonSlots] = useState(0);
  const [nightSlots, setNightSlots] = useState(0);
  
  // Novos campos para dias úteis
  const [weekdayMorningSlots, setWeekdayMorningSlots] = useState(0);
  const [weekdayIntermediateSlots, setWeekdayIntermediateSlots] = useState(0);
  const [weekdayAfternoonSlots, setWeekdayAfternoonSlots] = useState(0);
  const [weekdayNightSlots, setWeekdayNightSlots] = useState(0);
  
  // Novos campos para fins de semana/feriados
  const [weekendMorningSlots, setWeekendMorningSlots] = useState(0);
  const [weekendIntermediateSlots, setWeekendIntermediateSlots] = useState(0);
  const [weekendAfternoonSlots, setWeekendAfternoonSlots] = useState(0);
  const [weekendNightSlots, setWeekendNightSlots] = useState(0);
  
  const [shiftValue, setShiftValue] = useState(0);
  const [shiftValueDisplay, setShiftValueDisplay] = useState('0,00');
  const [error, setError] = useState<string | null>(null);

  // Função para formatar valor monetário
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Função para converter string formatada em número
  const parseCurrency = (value: string): number => {
    const cleanValue = value.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };

  // Handler para o campo de valor do plantão
  const handleShiftValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Remove tudo exceto números e vírgula
    const cleanValue = inputValue.replace(/[^\d,]/g, '');
    
    // Limita a 2 casas decimais
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
          // Campos antigos (mantidos por compatibilidade)
          morningSlots, 
          intermediateSlots, 
          afternoonSlots, 
          nightSlots, 
          // Novos campos
          weekdayMorningSlots,
          weekdayIntermediateSlots,
          weekdayAfternoonSlots,
          weekdayNightSlots,
          weekendMorningSlots,
          weekendIntermediateSlots,
          weekendAfternoonSlots,
          weekendNightSlots,
          shiftValue 
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao criar equipe');
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
          <input type="text" className="form-control" id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        
        {/* Seção para Dias Úteis (Segunda a Sexta) */}
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Vagas para Dias Úteis (Segunda a Sexta)</h5>
            <small className="text-muted">Defina o número de vagas para cada período nos dias úteis</small>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-3 mb-3">
                <label htmlFor="weekdayMorningSlots" className="form-label">Manhã</label>
                <input type="number" className="form-control" id="weekdayMorningSlots" value={weekdayMorningSlots} onChange={(e) => setWeekdayMorningSlots(parseInt(e.target.value, 10) || 0)} min="0" />
              </div>
              <div className="col-md-3 mb-3">
                <label htmlFor="weekdayIntermediateSlots" className="form-label">Intermediário</label>
                <input type="number" className="form-control" id="weekdayIntermediateSlots" value={weekdayIntermediateSlots} onChange={(e) => setWeekdayIntermediateSlots(parseInt(e.target.value, 10) || 0)} min="0" />
              </div>
              <div className="col-md-3 mb-3">
                <label htmlFor="weekdayAfternoonSlots" className="form-label">Tarde</label>
                <input type="number" className="form-control" id="weekdayAfternoonSlots" value={weekdayAfternoonSlots} onChange={(e) => setWeekdayAfternoonSlots(parseInt(e.target.value, 10) || 0)} min="0" />
              </div>
              <div className="col-md-3 mb-3">
                <label htmlFor="weekdayNightSlots" className="form-label">Noite</label>
                <input type="number" className="form-control" id="weekdayNightSlots" value={weekdayNightSlots} onChange={(e) => setWeekdayNightSlots(parseInt(e.target.value, 10) || 0)} min="0" />
              </div>
            </div>
          </div>
        </div>

        {/* Seção para Fins de Semana e Feriados */}
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Vagas para Fins de Semana e Feriados</h5>
            <small className="text-muted">Defina o número de vagas para cada período nos fins de semana e feriados</small>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-3 mb-3">
                <label htmlFor="weekendMorningSlots" className="form-label">Manhã</label>
                <input type="number" className="form-control" id="weekendMorningSlots" value={weekendMorningSlots} onChange={(e) => setWeekendMorningSlots(parseInt(e.target.value, 10) || 0)} min="0" />
              </div>
              <div className="col-md-3 mb-3">
                <label htmlFor="weekendIntermediateSlots" className="form-label">Intermediário</label>
                <input type="number" className="form-control" id="weekendIntermediateSlots" value={weekendIntermediateSlots} onChange={(e) => setWeekendIntermediateSlots(parseInt(e.target.value, 10) || 0)} min="0" />
              </div>
              <div className="col-md-3 mb-3">
                <label htmlFor="weekendAfternoonSlots" className="form-label">Tarde</label>
                <input type="number" className="form-control" id="weekendAfternoonSlots" value={weekendAfternoonSlots} onChange={(e) => setWeekendAfternoonSlots(parseInt(e.target.value, 10) || 0)} min="0" />
              </div>
              <div className="col-md-3 mb-3">
                <label htmlFor="weekendNightSlots" className="form-label">Noite</label>
                <input type="number" className="form-control" id="weekendNightSlots" value={weekendNightSlots} onChange={(e) => setWeekendNightSlots(parseInt(e.target.value, 10) || 0)} min="0" />
              </div>
            </div>
          </div>
        </div>

        {/* Campos antigos (mantidos por compatibilidade - ocultos) */}
        <input type="hidden" value={morningSlots} />
        <input type="hidden" value={intermediateSlots} />
        <input type="hidden" value={afternoonSlots} />
        <input type="hidden" value={nightSlots} />
        
        <div className="mb-3">
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
        <button type="submit" className="btn btn-primary">Salvar</button>
        <button type="button" className="btn btn-secondary ms-2" onClick={() => router.back()}>
          Cancelar
        </button>
      </form>
    </AuthLayout>
  );
}
