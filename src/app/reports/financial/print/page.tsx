import { ShiftPeriod } from '@prisma/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { prisma } from '@/lib/prisma';

const periodLabel: Record<ShiftPeriod, string> = {
    MORNING: 'Manhã',
    INTERMEDIATE: 'Intermediário',
    AFTERNOON: 'Tarde',
    NIGHT: 'Noite',
};

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

    const byPhysio: Record<number, {
        name: string;
        team: string;
        items: Array<{ date: Date; period: ShiftPeriod; base: number }>;
        baseTotal: number;
        additionalOnce: number;
    }> = {};

    for (const s of shifts) {
        const physio = s.physiotherapist;
        // Usar o valor do plantão da equipe em vez do valor individual do fisioterapeuta
        const base = s.shiftTeam?.shiftValue?.toNumber() ?? 0;
        const additional = physio.additionalValue?.toNumber() ?? 0;

        if (!byPhysio[physio.id]) {
            byPhysio[physio.id] = { name: physio.name, team: s.shiftTeam?.name ?? '—', items: [], baseTotal: 0, additionalOnce: 0 };
        }
        byPhysio[physio.id].items.push({ date: s.date, period: s.period, base });
        byPhysio[physio.id].baseTotal += base;
        if (byPhysio[physio.id].additionalOnce === 0 && additional > 0) byPhysio[physio.id].additionalOnce = additional;
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
    const entries = Object.entries(data);

    const totals = entries.reduce(
        (acc, [, info]) => {
            acc.base += info.baseTotal;
            acc.add += info.additionalOnce || 0;
            return acc;
        },
        { base: 0, add: 0 }
    );
    const grandTotal = totals.base + totals.add;

    return (
        <html lang="pt-BR">
            <head>
                <title>Relatório Financeiro</title>
                <style>{`
          body { font-family: Arial, sans-serif; padding: 24px; }
          h1 { margin: 0 0 16px 0; }
          h2 { margin-top: 24px; }
          .row { display: flex; justify-content: space-between; margin: 4px 0; }
          .sep { height: 1px; background: #ddd; margin: 8px 0 16px 0; }
          @media print { .no-print { display: none; } }
        `}</style>
            </head>
            <body>
                <h1>Relatório Financeiro - {String(month).padStart(2, '0')}/{year}</h1>
                {entries.length === 0 ? (
                    <p>Sem plantões para o período selecionado.</p>
                ) : (
                    <>
                        {entries.map(([key, info]) => {
                            const total = info.baseTotal + (info.additionalOnce || 0);
                            return (
                                <div key={key}>
                                    <h2>{info.name} • {info.team}</h2>
                                    {info.items.map((i, idx) => (
                                        <div className="row" key={idx}>
                                            <div>{format(i.date, 'dd/MM/yyyy', { locale: ptBR })} • {periodLabel[i.period]}</div>
                                            <div>R$ {i.base.toFixed(2)}</div>
                                        </div>
                                    ))}
                                    <div className="row"><strong>Valor adicional</strong><strong>R$ {(info.additionalOnce || 0).toFixed(2)}</strong></div>
                                    <div className="row"><strong>Total no mês</strong><strong>R$ {total.toFixed(2)}</strong></div>
                                    <div className="sep" />
                                </div>
                            );
                        })}
                        <div className="row"><strong>Totais gerais - Base</strong><strong>R$ {totals.base.toFixed(2)}</strong></div>
                        <div className="row"><strong>Totais gerais - Adicional</strong><strong>R$ {totals.add.toFixed(2)}</strong></div>
                        <div className="row"><strong>Totais gerais - Total</strong><strong>R$ {grandTotal.toFixed(2)}</strong></div>
                    </>
                )}
                <script dangerouslySetInnerHTML={{ __html: 'window.onload = () => window.print();' }} />
            </body>
        </html>
    );
}