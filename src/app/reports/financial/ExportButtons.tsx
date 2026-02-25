'use client';

import React from 'react';

type Props = {
    year: number;
    month: number;
    teamId?: number;
    physioId?: number;
};

export default function ExportButtons({ year, month, teamId, physioId }: Props) {
    const qs = new URLSearchParams({
        year: String(year),
        month: String(month),
        ...(teamId ? { teamId: String(teamId) } : {}),
        ...(physioId ? { physioId: String(physioId) } : {}),
    }).toString();

    const csvUrl = `/api/reports/financial?${qs}`;
    const printUrl = `/reports/financial/print?${qs}`;

    return (
        <div className="d-flex gap-2">
            <a href={csvUrl} className="btn btn-outline-secondary" target="_blank" rel="noopener noreferrer">
                Exportar CSV
            </a>
            <a href={printUrl} className="btn btn-outline-secondary" target="_blank" rel="noopener noreferrer">
                Exportar PDF
            </a>
        </div>
    );
} 