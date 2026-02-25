'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';

interface Team {
    id: number;
    name: string;
    morningSlots: number;
    intermediateSlots: number;
    afternoonSlots: number;
    nightSlots: number;
    // Novos campos para dias úteis
    weekdayMorningSlots: number;
    weekdayIntermediateSlots: number;
    weekdayAfternoonSlots: number;
    weekdayNightSlots: number;
    // Novos campos para fins de semana/feriados
    weekendMorningSlots: number;
    weekendIntermediateSlots: number;
    weekendAfternoonSlots: number;
    weekendNightSlots: number;
    shiftValue: number;
}

export default function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [id, setId] = useState<string>('');
    const [team, setTeam] = useState<Team | null>(null);
    const [name, setName] = useState('');
    // Estados para campos antigos (mantidos por compatibilidade)
    const [morningSlots, setMorningSlots] = useState(0);
    const [intermediateSlots, setIntermediateSlots] = useState(0);
    const [afternoonSlots, setAfternoonSlots] = useState(0);
    const [nightSlots, setNightSlots] = useState(0);
    // Estados para dias úteis
    const [weekdayMorningSlots, setWeekdayMorningSlots] = useState(0);
    const [weekdayIntermediateSlots, setWeekdayIntermediateSlots] = useState(0);
    const [weekdayAfternoonSlots, setWeekdayAfternoonSlots] = useState(0);
    const [weekdayNightSlots, setWeekdayNightSlots] = useState(0);
    // Estados para fins de semana/feriados
    const [weekendMorningSlots, setWeekendMorningSlots] = useState(0);
    const [weekendIntermediateSlots, setWeekendIntermediateSlots] = useState(0);
    const [weekendAfternoonSlots, setWeekendAfternoonSlots] = useState(0);
    const [weekendNightSlots, setWeekendNightSlots] = useState(0);
    const [shiftValue, setShiftValue] = useState(0);
    const [shiftValueDisplay, setShiftValueDisplay] = useState('0,00');
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        const resolveParams = async () => {
            const resolvedParams = await params;
            setId(resolvedParams.id);
        };
        resolveParams();
    }, [params]);

    useEffect(() => {
        if (id) {
            const fetchTeam = async () => {
                try {
                    const response = await fetch(`/api/teams/${id}`);
                    if (!response.ok) {
                        throw new Error('Falha ao buscar equipe');
                    }
                    const data = await response.json();
                    setTeam(data);
                    setName(data.name);
                    // Campos antigos (mantidos por compatibilidade)
                    setMorningSlots(data.morningSlots || 0);
                    setIntermediateSlots(data.intermediateSlots || 0);
                    setAfternoonSlots(data.afternoonSlots || 0);
                    setNightSlots(data.nightSlots || 0);
                    // Novos campos para dias úteis
                    setWeekdayMorningSlots(data.weekdayMorningSlots || data.morningSlots || 0);
                    setWeekdayIntermediateSlots(data.weekdayIntermediateSlots || data.intermediateSlots || 0);
                    setWeekdayAfternoonSlots(data.weekdayAfternoonSlots || data.afternoonSlots || 0);
                    setWeekdayNightSlots(data.weekdayNightSlots || data.nightSlots || 0);
                    // Novos campos para fins de semana/feriados
                    setWeekendMorningSlots(data.weekendMorningSlots || data.morningSlots || 0);
                    setWeekendIntermediateSlots(data.weekendIntermediateSlots || data.intermediateSlots || 0);
                    setWeekendAfternoonSlots(data.weekendAfternoonSlots || data.afternoonSlots || 0);
                    setWeekendNightSlots(data.weekendNightSlots || data.nightSlots || 0);
                    const shiftVal = data.shiftValue || 0;
                    setShiftValue(shiftVal);
                    setShiftValueDisplay(formatCurrency(shiftVal));
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            fetchTeam();
        }
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
                    // Campos antigos (mantidos por compatibilidade)
                    morningSlots,
                    intermediateSlots,
                    afternoonSlots,
                    nightSlots,
                    // Novos campos para dias úteis
                    weekdayMorningSlots,
                    weekdayIntermediateSlots,
                    weekdayAfternoonSlots,
                    weekdayNightSlots,
                    // Novos campos para fins de semana/feriados
                    weekendMorningSlots,
                    weekendIntermediateSlots,
                    weekendAfternoonSlots,
                    weekendNightSlots,
                    shiftValue,
                }),
            });

            if (!response.ok) {
                throw new Error('Falha ao atualizar equipe');
            }

            router.push('/teams');
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (loading) return <p>Carregando...</p>;
    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!team) return <p>Equipe não encontrada.</p>;

    return (
        <AuthLayout title="Editar Equipe">
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label htmlFor="name" className="form-label">Nome da Equipe</label>
                    <input type="text" className="form-control" id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>

                {/* Seção para Dias Úteis (Segunda a Sexta) */}
                <div className="mb-4">
                    <h5 className="text-primary">Vagas para Dias Úteis (Segunda a Sexta)</h5>
                    <div className="row">
                        <div className="col-md-3 mb-3">
                            <label htmlFor="weekdayMorningSlots" className="form-label">Vagas Manhã</label>
                            <input type="number" className="form-control" id="weekdayMorningSlots" value={weekdayMorningSlots} onChange={(e) => setWeekdayMorningSlots(parseInt(e.target.value, 10) || 0)} min="0" />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label htmlFor="weekdayIntermediateSlots" className="form-label">Vagas Intermediário</label>
                            <input type="number" className="form-control" id="weekdayIntermediateSlots" value={weekdayIntermediateSlots} onChange={(e) => setWeekdayIntermediateSlots(parseInt(e.target.value, 10) || 0)} min="0" />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label htmlFor="weekdayAfternoonSlots" className="form-label">Vagas Tarde</label>
                            <input type="number" className="form-control" id="weekdayAfternoonSlots" value={weekdayAfternoonSlots} onChange={(e) => setWeekdayAfternoonSlots(parseInt(e.target.value, 10) || 0)} min="0" />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label htmlFor="weekdayNightSlots" className="form-label">Vagas Noite</label>
                            <input type="number" className="form-control" id="weekdayNightSlots" value={weekdayNightSlots} onChange={(e) => setWeekdayNightSlots(parseInt(e.target.value, 10) || 0)} min="0" />
                        </div>
                    </div>
                </div>

                {/* Seção para Fins de Semana e Feriados */}
                <div className="mb-4">
                    <h5 className="text-success">Vagas para Fins de Semana e Feriados</h5>
                    <div className="row">
                        <div className="col-md-3 mb-3">
                            <label htmlFor="weekendMorningSlots" className="form-label">Vagas Manhã</label>
                            <input type="number" className="form-control" id="weekendMorningSlots" value={weekendMorningSlots} onChange={(e) => setWeekendMorningSlots(parseInt(e.target.value, 10) || 0)} min="0" />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label htmlFor="weekendIntermediateSlots" className="form-label">Vagas Intermediário</label>
                            <input type="number" className="form-control" id="weekendIntermediateSlots" value={weekendIntermediateSlots} onChange={(e) => setWeekendIntermediateSlots(parseInt(e.target.value, 10) || 0)} min="0" />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label htmlFor="weekendAfternoonSlots" className="form-label">Vagas Tarde</label>
                            <input type="number" className="form-control" id="weekendAfternoonSlots" value={weekendAfternoonSlots} onChange={(e) => setWeekendAfternoonSlots(parseInt(e.target.value, 10) || 0)} min="0" />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label htmlFor="weekendNightSlots" className="form-label">Vagas Noite</label>
                            <input type="number" className="form-control" id="weekendNightSlots" value={weekendNightSlots} onChange={(e) => setWeekendNightSlots(parseInt(e.target.value, 10) || 0)} min="0" />
                        </div>
                    </div>
                </div>

                {/* Campos antigos mantidos como ocultos para compatibilidade */}
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
                <button type="submit" className="btn btn-primary">Salvar Alterações</button>
                <button type="button" className="btn btn-secondary ms-2" onClick={() => router.back()}>
                    Cancelar
                </button>
            </form>
        </AuthLayout>
    );
}