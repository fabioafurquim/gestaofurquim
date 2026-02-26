import { ShiftPeriod } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const periodLabel: Record<ShiftPeriod, string> = {
    MORNING: 'Manhã',
    INTERMEDIATE: 'Interm.',
    AFTERNOON: 'Tarde',
    NIGHT: 'Noite',
};

const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

async function getData(year: number, month: number, teamId?: number, physioId?: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const shifts = await prisma.shift.findMany({
        where: {
            date: { gte: start, lt: end },
            ...(teamId ? { shiftTeamId: teamId } : {}),
            ...(physioId ? { physiotherapistId: physioId } : {}),
        },
        include: { physiotherapist: true, shiftTeam: true },
        orderBy: { date: 'asc' },
    });

    // Buscar valores customizados
    const physiotherapistTeams = await prisma.physiotherapistTeam.findMany();
    const customValueMap = new Map<string, number | null>();
    for (const pt of physiotherapistTeams) {
        const key = `${pt.physiotherapistId}-${pt.shiftTeamId}`;
        const customValue = (pt as any).customShiftValue;
        customValueMap.set(key, customValue ? Number(customValue) : null);
    }

    // Agrupar dados por fisioterapeuta e equipe
    const byPhysio: Record<number, {
        id: number;
        name: string;
        teamBreakdown: Record<number, {
            teamId: number;
            teamName: string;
            periods: Record<ShiftPeriod, number>;
            shiftValue: number;
            totalShifts: number;
            totalValue: number;
        }>;
        totalShifts: number;
        totalValue: number;
        additionalValue: number;
    }> = {};

    for (const shift of shifts) {
        const physio = shift.physiotherapist;
        const team = shift.shiftTeam;
        
        if (!team || !physio) continue;

        const customValueKey = `${physio.id}-${team.id}`;
        const customValue = customValueMap.get(customValueKey);
        const shiftValue = customValue !== null && customValue !== undefined 
            ? customValue 
            : (team.shiftValue?.toNumber() || 0);
        const additionalValue = physio.additionalValue?.toNumber() || 0;

        if (!byPhysio[physio.id]) {
            byPhysio[physio.id] = {
                id: physio.id,
                name: physio.name,
                teamBreakdown: {},
                totalShifts: 0,
                totalValue: 0,
                additionalValue: additionalValue
            };
        }

        if (!byPhysio[physio.id].teamBreakdown[team.id]) {
            byPhysio[physio.id].teamBreakdown[team.id] = {
                teamId: team.id,
                teamName: team.name,
                periods: { MORNING: 0, INTERMEDIATE: 0, AFTERNOON: 0, NIGHT: 0 },
                shiftValue: shiftValue,
                totalShifts: 0,
                totalValue: 0
            };
        }

        const teamBreakdown = byPhysio[physio.id].teamBreakdown[team.id];
        teamBreakdown.periods[shift.period]++;
        teamBreakdown.totalShifts++;
        teamBreakdown.totalValue += shiftValue;

        byPhysio[physio.id].totalShifts++;
        byPhysio[physio.id].totalValue += shiftValue;
    }

    return byPhysio;
}

export default async function FinancialPrintPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; teamId?: string; physioId?: string }> }) {
    const sp = await searchParams;
    const now = new Date();
    const year = sp?.year ? Number(sp.year) : now.getFullYear();
    const month = sp?.month ? Number(sp.month) : now.getMonth() + 1;
    const teamId = sp?.teamId ? Number(sp.teamId) : undefined;
    const physioId = sp?.physioId ? Number(sp.physioId) : undefined;

    const data = await getData(year, month, teamId, physioId);
    const entries = Object.values(data);

    let grandTotalShifts = 0;
    let grandTotalValue = 0;
    let grandTotalAdditional = 0;

    entries.forEach(physio => {
        grandTotalShifts += physio.totalShifts;
        grandTotalValue += physio.totalValue;
        grandTotalAdditional += physio.additionalValue;
    });

    const grandTotal = grandTotalValue + grandTotalAdditional;

    return (
        <html lang="pt-BR">
            <head>
                <title>Relatório Financeiro - {monthNames[month - 1]} {year}</title>
                <style>{`
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        padding: 20px; 
                        font-size: 11px;
                        color: #333;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 2px solid #4F46E5;
                    }
                    .header h1 {
                        font-size: 18px;
                        color: #4F46E5;
                        margin-bottom: 5px;
                    }
                    .header p {
                        color: #666;
                        font-size: 12px;
                    }
                    .physio-section {
                        margin-bottom: 20px;
                        page-break-inside: avoid;
                    }
                    .physio-header {
                        background: #4F46E5;
                        color: white;
                        padding: 8px 12px;
                        font-weight: bold;
                        font-size: 12px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 0;
                    }
                    th {
                        background: #f3f4f6;
                        padding: 6px 8px;
                        text-align: center;
                        font-weight: 600;
                        border: 1px solid #e5e7eb;
                        font-size: 10px;
                    }
                    th:first-child { text-align: left; }
                    th:last-child, th:nth-last-child(2) { text-align: right; }
                    td {
                        padding: 5px 8px;
                        border: 1px solid #e5e7eb;
                        text-align: center;
                    }
                    td:first-child { text-align: left; font-weight: 500; }
                    td:last-child, td:nth-last-child(2) { text-align: right; }
                    .subtotal-row {
                        background: #f9fafb;
                        font-weight: 600;
                    }
                    .additional-row {
                        background: #ecfdf5;
                        color: #059669;
                        font-weight: 600;
                    }
                    .total-row {
                        background: #eef2ff;
                        color: #4F46E5;
                        font-weight: bold;
                    }
                    .grand-total {
                        margin-top: 20px;
                        padding: 15px;
                        background: #4F46E5;
                        color: white;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 14px;
                    }
                    .grand-total-label { font-weight: bold; }
                    .grand-total-value { font-size: 18px; font-weight: bold; }
                    .footer {
                        margin-top: 30px;
                        padding-top: 15px;
                        border-top: 1px solid #e5e7eb;
                        text-align: center;
                        color: #666;
                        font-size: 10px;
                    }
                    @media print {
                        body { padding: 10px; }
                        .no-print { display: none; }
                        .physio-section { page-break-inside: avoid; }
                    }
                `}</style>
            </head>
            <body>
                <div className="header">
                    <h1>Relatório Financeiro</h1>
                    <p>{monthNames[month - 1]} de {year}</p>
                </div>

                {entries.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                        Sem plantões para o período selecionado.
                    </p>
                ) : (
                    <>
                        {entries.map((physio) => {
                            const teamBreakdowns = Object.values(physio.teamBreakdown);
                            const totalPhysio = physio.totalValue + physio.additionalValue;

                            return (
                                <div key={physio.id} className="physio-section">
                                    <div className="physio-header">
                                        {physio.name}
                                    </div>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Equipe</th>
                                                <th>Manhã</th>
                                                <th>Interm.</th>
                                                <th>Tarde</th>
                                                <th>Noite</th>
                                                <th>Total</th>
                                                <th>Valor Unit.</th>
                                                <th>Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {teamBreakdowns.map((team) => {
                                                const totalShiftsTeam = team.periods.MORNING + team.periods.INTERMEDIATE + team.periods.AFTERNOON + team.periods.NIGHT;
                                                return (
                                                    <tr key={team.teamId}>
                                                        <td>{team.teamName}</td>
                                                        <td>{team.periods.MORNING || '-'}</td>
                                                        <td>{team.periods.INTERMEDIATE || '-'}</td>
                                                        <td>{team.periods.AFTERNOON || '-'}</td>
                                                        <td>{team.periods.NIGHT || '-'}</td>
                                                        <td><strong>{totalShiftsTeam}</strong></td>
                                                        <td>R$ {team.shiftValue.toFixed(2)}</td>
                                                        <td><strong>R$ {team.totalValue.toFixed(2)}</strong></td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="subtotal-row">
                                                <td>Subtotal Plantões</td>
                                                <td>{teamBreakdowns.reduce((sum, t) => sum + t.periods.MORNING, 0) || '-'}</td>
                                                <td>{teamBreakdowns.reduce((sum, t) => sum + t.periods.INTERMEDIATE, 0) || '-'}</td>
                                                <td>{teamBreakdowns.reduce((sum, t) => sum + t.periods.AFTERNOON, 0) || '-'}</td>
                                                <td>{teamBreakdowns.reduce((sum, t) => sum + t.periods.NIGHT, 0) || '-'}</td>
                                                <td><strong>{physio.totalShifts}</strong></td>
                                                <td>-</td>
                                                <td><strong>R$ {physio.totalValue.toFixed(2)}</strong></td>
                                            </tr>
                                            {physio.additionalValue > 0 && (
                                                <tr className="additional-row">
                                                    <td colSpan={7}>Valor Adicional</td>
                                                    <td>R$ {physio.additionalValue.toFixed(2)}</td>
                                                </tr>
                                            )}
                                            <tr className="total-row">
                                                <td colSpan={7}>TOTAL {physio.name.toUpperCase()}</td>
                                                <td>R$ {totalPhysio.toFixed(2)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}

                        <div className="grand-total">
                            <span className="grand-total-label">
                                TOTAL GERAL ({grandTotalShifts} plantões)
                            </span>
                            <span className="grand-total-value">
                                R$ {grandTotal.toFixed(2)}
                            </span>
                        </div>
                    </>
                )}

                <div className="footer">
                    Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} • Gestão Furquim
                </div>

                <script dangerouslySetInnerHTML={{ __html: 'window.onload = () => window.print();' }} />
            </body>
        </html>
    );
}