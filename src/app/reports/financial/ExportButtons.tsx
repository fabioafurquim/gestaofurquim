'use client';

import React from 'react';
import { FileText, FileSpreadsheet, Printer } from 'lucide-react';

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

    const printUrl = `/reports/financial/print?${qs}`;
    const excelUrl = `/api/reports/financial/excel?${qs}`;

    return (
        <div className="flex flex-wrap gap-3 mb-6">
            <a 
                href={printUrl} 
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
                target="_blank" 
                rel="noopener noreferrer"
            >
                <Printer className="w-4 h-4" />
                Imprimir / PDF
            </a>
            <a 
                href={excelUrl} 
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 border border-emerald-600 rounded-lg text-white hover:bg-emerald-700 transition-colors shadow-sm"
                target="_blank" 
                rel="noopener noreferrer"
            >
                <FileSpreadsheet className="w-4 h-4" />
                Exportar Excel
            </a>
        </div>
    );
}