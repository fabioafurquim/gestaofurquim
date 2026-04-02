'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import AuthLayout from '@/components/AuthLayout';

type FinancialDocumentWarning = {
  driveWarning?: string | null;
  folderId?: string | null;
  folderPath?: string[] | null;
  rootFolderName?: string | null;
};

type FinancialRpaData = {
  valorServicoPrestado?: number;
  outrosDescontos?: number;
  iss?: number;
  irrf?: number;
  inss?: number;
  totalDescontos?: number;
  valorLiquido?: number;
  systemGrossValue?: number;
  grossDifference?: number;
  grossMismatch?: boolean;
  grossMismatchMessage?: string | null;
  parserStatus?: 'AUTO_OK' | 'AUTO_FAILED' | 'MANUAL_CONFIRMED';
  parserMessage?: string | null;
  manualOverride?: boolean;
  appliedToClosing?: boolean;
  appliedAt?: string | null;
};

type FinancialDocument = {
  id: number;
  type: string;
  status?: string;
  fileName: string;
  fileId?: string | null;
  fileUrl: string | null;
  uploadedAt?: string | null;
  createdAt?: string;
  extractedData?: FinancialRpaData | null;
  metadata?: FinancialDocumentWarning | null;
};
type PaymentBatch = { id: string; provider?: string; status: string; recordCount?: number; totalValue?: string | number; generatedAt?: string | null; createdAt?: string; payments?: number; netValue?: number; receipts?: number; externalStatus?: string };
type BankBatchSummary = {
  id: string;
  referenceMonth: string;
  status: string;
  transport: string;
  createdAt: string;
  updatedAt: string;
  payments: number;
  grossValue: number;
  netValue: number;
  receipts: number;
  externalStatus?: string | null;
};
type AuditEvent = {
  id: number;
  type: string;
  message: string | null;
  createdAt: string;
  actorUser?: { name: string | null } | null;
};
type ToastState = {
  type: 'success' | 'warning' | 'error';
  message: string;
};
type FinancialClosingLine = {
  id: number;
  physiotherapistId: number;
  physiotherapistName: string;
  physiotherapistEmail: string | null;
  contractType: string;
  totalShifts: number;
  grossCalculatedValue: string | number;
  adjustmentTotalValue: string | number;
  additionalValue: string | number;
  netValue: string | number;
  status: string;
  documents?: FinancialDocument[];
};
type ClosingDetail = { id: number; referenceMonth: string; status: string; notes?: string | null; totalPhysiotherapists: number; totalGrossValue: string | number; totalAdjustmentValue: string | number; totalNetValue: string | number; lines: FinancialClosingLine[]; documents: FinancialDocument[]; paymentBatches: PaymentBatch[]; auditEvents?: AuditEvent[] };
type AdjustmentType = 'BONUS' | 'CREDIT' | 'DEBIT' | 'DISCOUNT' | 'CORRECTION' | 'OTHER';

const closingStatusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  UNDER_REVIEW: 'Em conferência',
  APPROVED_FOR_PAYMENT: 'Aprovado para pagamento',
  BANK_FILE_GENERATED: 'Lote gerado',
  BANK_SUBMITTED: 'Enviado ao banco',
  PAYMENT_CONFIRMED: 'Confirmado',
  CLOSED: 'Fechado',
  REOPENED: 'Reaberto',
  ARCHIVED: 'Arquivado',
};
const closingStatusNotes: Record<string, string> = {
  DRAFT: 'A competência foi criada, mas ainda não passou pela conferência manual.',
  UNDER_REVIEW: 'Momento ideal para revisar plantões, anexos e ajustes com motivo.',
  APPROVED_FOR_PAYMENT: 'A competência já está pronta para gerar o lote do Banco Inter.',
  BANK_FILE_GENERATED: 'O lote foi preparado e pode ser submetido ao banco.',
  BANK_SUBMITTED: 'O arquivo já foi enviado ao banco e aguarda retorno e comprovantes.',
  PAYMENT_CONFIRMED: 'Os comprovantes foram sincronizados com o fechamento.',
  CLOSED: 'Fechamento travado para auditoria e consulta.',
  REOPENED: 'A competência foi reaberta para correção controlada.',
  ARCHIVED: 'Fechamento arquivado.',
};
const lineStatusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  UNDER_REVIEW: 'Em conferência',
  APPROVED: 'Aprovado',
  LOCKED: 'Travado',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
};
const batchStatusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  READY_FOR_SUBMISSION: 'Pronto para envio',
  SUBMITTED: 'Enviado',
  SYNCED: 'Com comprovantes',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
};
const batchTransportLabels: Record<string, string> = {
  INTER_API: 'API do Banco Inter',
  CNAB_FALLBACK: 'CNAB de contingência',
  UNKNOWN: 'Não identificado',
};
const adjustmentTypeLabels: Record<AdjustmentType, string> = {
  BONUS: 'Bônus',
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  DISCOUNT: 'Desconto',
  CORRECTION: 'Correção',
  OTHER: 'Outro',
};

function formatCurrency(value: string | number | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

async function readJsonSafely(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function parseMoneyInput(value: string) {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) {
    return NaN;
  }

  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');

  let normalized = trimmed;

  if (hasComma && hasDot) {
    const lastComma = trimmed.lastIndexOf(',');
    const lastDot = trimmed.lastIndexOf('.');
    normalized = lastComma > lastDot
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed.replace(/,/g, '');
  } else if (hasComma) {
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = trimmed;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatDocumentWarning(document: FinancialDocument | null | undefined) {
  const warning = document?.metadata?.driveWarning;
  return typeof warning === 'string' && warning.trim() ? warning.trim() : null;
}

function getLatestDocumentByType(line: FinancialClosingLine, type: 'RPA' | 'INVOICE') {
  const candidates = (line.documents || [])
    .filter((document) => document.type === type)
    .sort((a, b) => {
      const aTime = new Date(a.uploadedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.uploadedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  return candidates[0] ?? null;
}

function hasDocumentAttachment(document: FinancialDocument | null | undefined) {
  return Boolean(document?.fileId || document?.fileUrl);
}

function getLineRowClass(status: string) {
  switch (status) {
    case 'UNDER_REVIEW':
      return 'bg-amber-50/80';
    case 'APPROVED':
      return 'bg-emerald-50/80';
    case 'LOCKED':
      return 'bg-emerald-100/70';
    case 'PAID':
      return 'bg-sky-50/80';
    case 'CANCELLED':
      return 'bg-rose-50/80';
    case 'DRAFT':
    default:
      return 'bg-slate-50/80';
  }
}

export default function FinancialClosingMonthPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const month = Array.isArray(params.month) ? params.month[0] : (params.month as string);

  const [closing, setClosing] = useState<ClosingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [auditMessage, setAuditMessage] = useState('');
  const [adjustmentLine, setAdjustmentLine] = useState<FinancialClosingLine | null>(null);
  const [bankBatches, setBankBatches] = useState<BankBatchSummary[]>([]);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('CORRECTION');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentDescription, setAdjustmentDescription] = useState('');
  const [rpaEditorLine, setRpaEditorLine] = useState<FinancialClosingLine | null>(null);
  const [rpaEditorDocumentId, setRpaEditorDocumentId] = useState<number | null>(null);
  const [rpaValorServico, setRpaValorServico] = useState('');
  const [rpaOutrosDescontos, setRpaOutrosDescontos] = useState('');
  const [rpaIss, setRpaIss] = useState('');
  const [rpaIrrf, setRpaIrrf] = useState('');
  const [rpaInss, setRpaInss] = useState('');
  const [rpaTotalDescontos, setRpaTotalDescontos] = useState('');
  const [rpaValorLiquido, setRpaValorLiquido] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const canAccess = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';
  const canMutate = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';

  const linesById = useMemo(() => new Map((closing?.lines || []).map((line) => [line.id, line] as const)), [closing]);
  const stats = useMemo(() => {
    const lines = closing?.lines || [];
    return {
      pendingDocs: lines.filter((line) => {
        const latestRpaDocument = getLatestDocumentByType(line, 'RPA');
        const latestInvoiceDocument = getLatestDocumentByType(line, 'INVOICE');
        return (line.contractType === 'RPA' && !hasDocumentAttachment(latestRpaDocument)) || (line.contractType === 'PJ' && !hasDocumentAttachment(latestInvoiceDocument));
      }).length,
      underReview: lines.filter((line) => line.status === 'UNDER_REVIEW').length,
      approved: lines.filter((line) => ['APPROVED', 'LOCKED', 'PAID'].includes(line.status)).length,
    };
  }, [closing]);
  const latestBatchId = bankBatches[0]?.id ?? null;

  const fetchClosingData = useCallback(async () => {
    const response = await fetch(`/api/financial-closing/${month}`);
    const data = await readJsonSafely(response);
    if (!response.ok) {
      throw new Error((data as { error?: string } | null)?.error || 'Erro ao carregar competência.');
    }
    return data as ClosingDetail;
  }, [month]);

  const fetchBankBatches = useCallback(async () => {
    const response = await fetch(`/api/financial-closing/${month}/bank-batches`);
    const data = await readJsonSafely(response);
    if (!response.ok) {
      throw new Error((data as { error?: string } | null)?.error || 'Erro ao carregar lotes bancários.');
    }
    return (((data as { batches?: BankBatchSummary[] } | null)?.batches) || []) as BankBatchSummary[];
  }, [month]);

  const syncPageData = useCallback(async () => {
    const [closingData, batchesData] = await Promise.all([fetchClosingData(), fetchBankBatches()]);
    setClosing(closingData);
    setBankBatches(batchesData);
  }, [fetchBankBatches, fetchClosingData]);

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await syncPageData();
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao carregar competência.');
    } finally {
      setLoading(false);
    }
  }, [syncPageData]);

  const refreshPageData = useCallback(async () => {
    try {
      await syncPageData();
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao atualizar os dados do fechamento.');
    }
  }, [syncPageData]);

  async function sendJson(path: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
    const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await readJsonSafely(response);
    if (!response.ok) throw new Error((data as { error?: string } | null)?.error || 'Operação não concluída.');
    return data;
  }

  async function updateStatus(status: string) {
    try {
      setBusy(`closing-${status}`);
      setSuccessMessage(null);
      await sendJson(`/api/financial-closing/${month}`, { status }, 'PATCH');
      await refreshPageData();
      setSuccessMessage('Status da competência atualizado.');
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao atualizar status.');
    } finally {
      setBusy(null);
    }
  }

  async function updateLineStatus(lineId: number, status: string) {
    try {
      setBusy(`line-${lineId}-${status}`);
      setSuccessMessage(null);
      await sendJson(`/api/financial-closing/${month}/lines/${lineId}`, { status }, 'PATCH');
      await refreshPageData();
      setSuccessMessage('Linha atualizada com sucesso.');
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao atualizar linha.');
    } finally {
      setBusy(null);
    }
  }

  async function createBatch() {
    try {
      setBusy('batch');
      setSuccessMessage(null);
      await sendJson(`/api/financial-closing/${month}/bank-batches`, {});
      await refreshPageData();
      setSuccessMessage('Lote bancário gerado com sucesso.');
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao gerar lote.');
    } finally {
      setBusy(null);
    }
  }

  async function runBatchAction(batchId: string, action: 'submit' | 'sync' | 'emails') {
    try {
      setBusy(`${action}-${batchId}`);
      setSuccessMessage(null);
      const response = await fetch(`/api/financial-closing/${month}/bank-batches/${batchId}/${action}`, { method: 'POST' });
      const data = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error || 'Erro ao executar ação do lote.');
      }
      await refreshPageData();
      if (action === 'submit') {
        setSuccessMessage('Lote marcado como enviado ao banco com sucesso.');
      } else if (action === 'sync') {
        const syncedReceipts = (((data as { syncedReceipts?: unknown[] } | null)?.syncedReceipts) || []) as unknown[];
        setSuccessMessage(
          syncedReceipts.length > 0
            ? `Comprovantes sincronizados: ${syncedReceipts.length}.`
            : 'Sincronização concluída. Se o banco ainda não liberou comprovantes, tente novamente depois.'
        );
      } else {
        const result = data as { success?: number; failed?: number } | null;
        setSuccessMessage(`Envio concluído. Sucessos: ${result?.success || 0}. Falhas: ${result?.failed || 0}.`);
      }
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao executar ação do lote.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadBatchExport(batchId: string) {
    try {
      setBusy(`export-${batchId}`);
      setError(null);
      setWarningMessage(null);
      const response = await fetch(`/api/financial-closing/${month}/bank-batches/${batchId}/export`);
      if (!response.ok) {
        const data = await readJsonSafely(response);
        throw new Error((data as { error?: string } | null)?.error || 'Erro ao baixar arquivo CNAB.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const match = contentDisposition.match(/filename=\"?([^"]+)\"?/i);
      const fileName = match?.[1] || `lote-${batchId}.txt`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setSuccessMessage('Arquivo CNAB baixado com sucesso.');
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao baixar arquivo CNAB.');
    } finally {
      setBusy(null);
    }
  }

  async function registerAudit() {
    if (!auditMessage.trim()) return setError('Escreva uma observação antes de registrar.');
    try {
      setBusy('audit');
      setSuccessMessage(null);
      await sendJson(`/api/financial-closing/${month}/audit`, { type: 'AUDIT_NOTE', message: auditMessage.trim() });
      setAuditMessage('');
      await refreshPageData();
      setSuccessMessage('Observação registrada na auditoria.');
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao registrar observação.');
    } finally {
      setBusy(null);
    }
  }

  async function uploadDocument(lineId: number, documentType: 'RPA' | 'INVOICE', file: File) {
    const line = linesById.get(lineId);
    if (!line) return;
    try {
      setBusy(`upload-${lineId}-${documentType}`);
      setError(null);
      setWarningMessage(null);
      setSuccessMessage(null);
      const formData = new FormData();
      formData.append('lineId', String(lineId));
      formData.append('documentType', documentType);
      formData.append('physiotherapistId', String(line.physiotherapistId));
      formData.append('physiotherapistName', line.physiotherapistName);
      formData.append('file', file);
      const response = await fetch(`/api/financial-closing/${month}/documents`, { method: 'POST', body: formData });
      const data = await readJsonSafely(response);
      if (!response.ok) throw new Error((data as { error?: string } | null)?.error || 'Erro ao anexar documento.');
      await refreshPageData();
      const result = data as { warnings?: string[]; appliedToClosing?: boolean; extractedData?: FinancialRpaData | null } | null;
      const warnings = result?.warnings || [];
      if (documentType === 'RPA' && result?.extractedData?.grossMismatchMessage) {
        warnings.push(result.extractedData.grossMismatchMessage);
      }
      if (warnings.length > 0) {
        setWarningMessage(warnings.join(' '));
      }

      if (documentType === 'RPA' && result?.appliedToClosing) {
        setSuccessMessage('RPA anexada, lida automaticamente e aplicada ao fechamento.');
      } else if (documentType === 'RPA' && result?.extractedData?.parserStatus === 'AUTO_FAILED') {
        setSuccessMessage('RPA anexada. Revise e preencha os valores manualmente para concluir.');
      } else {
        setSuccessMessage('Documento anexado com sucesso.');
      }
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao anexar documento.');
    } finally {
      setBusy(null);
    }
  }

  function openAdjustment(line: FinancialClosingLine | null) {
    setAdjustmentLine(line);
    setAdjustmentType('CORRECTION');
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setAdjustmentDescription('');
  }

  function openRpaEditor(line: FinancialClosingLine) {
    const rpaDocument = getLatestDocumentByType(line, 'RPA');
    const extracted = rpaDocument?.extractedData;

    setRpaEditorLine(line);
    setRpaEditorDocumentId(rpaDocument?.id ?? null);
    setRpaValorServico(String(extracted?.valorServicoPrestado ?? Number(line.grossCalculatedValue || 0)));
    setRpaOutrosDescontos(String(extracted?.outrosDescontos ?? 0));
    setRpaIss(String(extracted?.iss ?? 0));
    setRpaIrrf(String(extracted?.irrf ?? 0));
    setRpaInss(String(extracted?.inss ?? 0));
    setRpaTotalDescontos(String(extracted?.totalDescontos ?? 0));
    setRpaValorLiquido(String(extracted?.valorLiquido ?? Number(line.netValue || 0)));
  }

  function closeRpaEditor() {
    setRpaEditorLine(null);
    setRpaEditorDocumentId(null);
    setRpaValorServico('');
    setRpaOutrosDescontos('');
    setRpaIss('');
    setRpaIrrf('');
    setRpaInss('');
    setRpaTotalDescontos('');
    setRpaValorLiquido('');
  }

  async function saveAdjustment() {
    if (!adjustmentLine) return;
    const amount = parseMoneyInput(adjustmentAmount);
    if (!Number.isFinite(amount) || amount === 0) return setError('Informe um valor diferente de zero.');
    if (!adjustmentReason.trim()) return setError('Informe o motivo do ajuste.');
    try {
      setBusy(`adjustment-${adjustmentLine.id}`);
      setSuccessMessage(null);
      await sendJson(`/api/financial-closing/${month}/adjustments`, {
        financialClosingLineId: adjustmentLine.id,
        type: adjustmentType,
        amount,
        reason: adjustmentReason.trim(),
        description: adjustmentDescription.trim() || undefined,
      });
      setAdjustmentLine(null);
      await refreshPageData();
      setSuccessMessage('Ajuste manual registrado com sucesso.');
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao registrar ajuste.');
    } finally {
      setBusy(null);
    }
  }

  async function saveManualRpaData() {
    if (!rpaEditorLine) {
      setError('Selecione uma linha RPA antes de informar os valores manualmente.');
      return;
    }

    const valorServicoPrestado = parseMoneyInput(rpaValorServico);
    const outrosDescontos = parseMoneyInput(rpaOutrosDescontos);
    const iss = parseMoneyInput(rpaIss);
    const irrf = parseMoneyInput(rpaIrrf);
    const inss = parseMoneyInput(rpaInss);
    const totalDescontos = parseMoneyInput(rpaTotalDescontos);
    const valorLiquido = parseMoneyInput(rpaValorLiquido);

    if (![valorServicoPrestado, outrosDescontos, iss, irrf, inss, totalDescontos, valorLiquido].every(Number.isFinite)) {
      setError('Preencha os campos numéricos da RPA corretamente.');
      return;
    }

    try {
      const busyKey = `rpa-line-${rpaEditorLine.id}`;
      setBusy(busyKey);
      setError(null);
      setWarningMessage(null);
      setSuccessMessage(null);
      const response = await fetch(`/api/financial-closing/${month}/lines/${rpaEditorLine.id}/rpa-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valorServicoPrestado,
          outrosDescontos,
          iss,
          irrf,
          inss,
          totalDescontos,
          valorLiquido,
          applyToClosing: true,
        }),
      });
      const data = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error || 'Erro ao salvar os dados da RPA.');
      }
      await refreshPageData();
      closeRpaEditor();
      const result = data as { document?: FinancialDocument | null } | null;
      const mismatchMessage = result?.document?.extractedData?.grossMismatchMessage;
      if (mismatchMessage) {
        setWarningMessage(mismatchMessage);
      }
      setSuccessMessage('Dados da RPA salvos e aplicados ao fechamento. O anexo pode ser feito depois.');
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao salvar os dados da RPA.');
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (canAccess) void loadPageData();
    else setLoading(false);
  }, [canAccess, loadPageData]);

  useEffect(() => {
    if (error) {
      setToast({ type: 'error', message: error });
    }
  }, [error]);

  useEffect(() => {
    if (warningMessage) {
      setToast({ type: 'warning', message: warningMessage });
    }
  }, [warningMessage]);

  useEffect(() => {
    if (successMessage) {
      setToast({ type: 'success', message: successMessage });
    }
  }, [successMessage]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!rpaEditorLine) {
      return;
    }

    const valorServicoPrestado = parseMoneyInput(rpaValorServico);
    const outrosDescontos = parseMoneyInput(rpaOutrosDescontos);
    const iss = parseMoneyInput(rpaIss);
    const irrf = parseMoneyInput(rpaIrrf);
    const inss = parseMoneyInput(rpaInss);

    if (![valorServicoPrestado, outrosDescontos, iss, irrf, inss].every(Number.isFinite)) {
      return;
    }

    const totalDescontosCalculado = outrosDescontos + iss + irrf + inss;
    const valorLiquidoCalculado = valorServicoPrestado - totalDescontosCalculado;

    setRpaTotalDescontos(totalDescontosCalculado.toFixed(2));
    setRpaValorLiquido(valorLiquidoCalculado.toFixed(2));
  }, [rpaEditorLine, rpaValorServico, rpaOutrosDescontos, rpaIss, rpaIrrf, rpaInss]);

  if (!canAccess) {
    return (
      <AuthLayout title="Fechamento Financeiro" fullWidth>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Apenas gestores e administradores podem acessar o módulo financeiro.
        </div>
      </AuthLayout>
    );
  }

  if (loading || !closing) {
    return (
      <AuthLayout title={`Fechamento Financeiro ${month}`} fullWidth>
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
          Carregando competência...
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={`Fechamento Financeiro ${month}`} fullWidth>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button type="button" onClick={() => router.push('/financial-closing')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Voltar</button>
          <a href="#resumo" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Resumo</a>
          <a href="#conferencia" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Conferência</a>
          <a href="#documentos" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Documentos</a>
          <a href="#lotes" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Lotes</a>
          <a href="#auditoria" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Auditoria</a>
          {canMutate ? <button type="button" onClick={() => openAdjustment(null)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">Novo ajuste</button> : null}
          {canMutate ? <button type="button" onClick={createBatch} disabled={busy === 'batch'} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">{busy === 'batch' ? 'Gerando...' : 'Gerar lote do Banco Inter'}</button> : null}
          {canMutate ? <button type="button" onClick={() => updateStatus('REOPENED')} disabled={busy === 'closing-REOPENED'} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Reabrir</button> : null}
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {warningMessage ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{warningMessage}</div> : null}
        {successMessage ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}
        {toast ? (
          <div className="fixed right-4 top-20 z-[60] w-full max-w-sm">
            <div
              className={`rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
                toast.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : toast.type === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 text-sm font-medium">{toast.message}</div>
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-slate-900">Competência {closing.referenceMonth}</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {closingStatusLabels[closing.status] || closing.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{closingStatusNotes[closing.status] || 'Use esta competência para revisar e fechar o mês.'}</p>
            {closing.notes ? <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{closing.notes}</p> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Profissionais</p><p className="mt-2 text-2xl font-semibold text-slate-900">{closing.totalPhysiotherapists}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Bruto</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(closing.totalGrossValue)}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Ajustes</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(closing.totalAdjustmentValue)}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Líquido</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(closing.totalNetValue)}</p></div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-700">Conferência manual em aberto: <strong>{stats.underReview}</strong></p>
            <p className="text-sm text-slate-700">Linhas já aprovadas: <strong>{stats.approved}</strong></p>
            <p className="text-sm text-slate-700">Pendências de documento: <strong>{stats.pendingDocs}</strong></p>
            {canMutate ? <button type="button" onClick={() => updateStatus('UNDER_REVIEW')} className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Marcar em conferência</button> : null}
          </div>
        </section>

        {canMutate ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Observação de conferência</h3>
            <textarea value={auditMessage} onChange={(e) => setAuditMessage(e.target.value)} rows={3} className="mt-4 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={registerAudit} disabled={busy === 'audit'} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{busy === 'audit' ? 'Registrando...' : 'Registrar'}</button>
              <button type="button" onClick={() => setAuditMessage('')} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Limpar</button>
            </div>
          </section>
        ) : null}

        <section id="conferencia" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Linhas do fechamento</h3></div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Fisioterapeuta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Plantões</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Bruto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Líquido</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Docs</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {closing.lines.map((line) => {
                  const documents = line.documents || [];
                  const latestRpaDocument = getLatestDocumentByType(line, 'RPA');
                  const latestInvoiceDocument = getLatestDocumentByType(line, 'INVOICE');
                  const rpaData = latestRpaDocument?.extractedData || null;
                  const requiredLabel = line.contractType === 'RPA' ? 'RPA obrigatória' : line.contractType === 'PJ' ? 'NF obrigatória' : 'Sem exigência';
                  const missingRequired = (line.contractType === 'RPA' && !hasDocumentAttachment(latestRpaDocument)) || (line.contractType === 'PJ' && !hasDocumentAttachment(latestInvoiceDocument));
                  const driveWarning = formatDocumentWarning(line.contractType === 'RPA' ? latestRpaDocument : latestInvoiceDocument);
                  const hasManualRpaData = line.contractType === 'RPA' && Boolean(rpaData && Number(rpaData.valorLiquido || 0) > 0);
                  return (
                    <tr key={line.id} className={`align-top transition-colors ${getLineRowClass(line.status)}`}>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-slate-900">{line.physiotherapistName}</div>
                        <div className="text-sm text-slate-500">{line.physiotherapistEmail || 'Sem e-mail'}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                            {line.contractType}
                          </span>
                          {missingRequired ? (
                            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                              {requiredLabel} pendente
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              {requiredLabel} atendida
                            </span>
                          )}
                          {line.contractType === 'RPA' && hasManualRpaData && !hasDocumentAttachment(latestRpaDocument) ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                              Valores informados; anexo pendente
                            </span>
                          ) : null}
                          {line.contractType === 'RPA' && rpaData?.parserStatus === 'AUTO_OK' ? (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                              RPA lida automaticamente
                            </span>
                          ) : null}
                          {line.contractType === 'RPA' && rpaData?.parserStatus === 'AUTO_FAILED' ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                              Leitura automática falhou
                            </span>
                          ) : null}
                          {line.contractType === 'RPA' && rpaData?.parserStatus === 'MANUAL_CONFIRMED' ? (
                            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">
                              Dados confirmados manualmente
                            </span>
                          ) : null}
                          {line.contractType === 'RPA' && rpaData?.grossMismatch ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                              Bruto da RPA diverge do sistema
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{line.totalShifts}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{formatCurrency(line.grossCalculatedValue)}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <div className="font-medium text-slate-900">{formatCurrency(line.netValue)}</div>
                        {line.contractType === 'RPA' && rpaData ? (
                          <div className="mt-2 space-y-1 text-xs text-slate-500">
                            <div>Bruto do sistema: {formatCurrency(rpaData.systemGrossValue ?? line.grossCalculatedValue)}</div>
                            <div>Serviço na RPA: {formatCurrency(rpaData.valorServicoPrestado)}</div>
                            {rpaData.grossMismatch ? <div className="font-medium text-amber-700">Diferença de bruto: {formatCurrency(rpaData.grossDifference)}</div> : null}
                            <div>Descontos da RPA: {formatCurrency(rpaData.totalDescontos)}</div>
                            <div>Líquido da RPA: {formatCurrency(rpaData.valorLiquido)}</div>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <div className="font-medium text-slate-900">{lineStatusLabels[line.status] || line.status}</div>
                        {line.contractType === 'RPA' && rpaData?.parserMessage ? (
                          <div className="mt-2 max-w-xs text-xs text-slate-500">{rpaData.parserMessage}</div>
                        ) : null}
                        {line.contractType === 'RPA' && rpaData?.grossMismatchMessage ? (
                          <div className="mt-2 max-w-xs rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                            {rpaData.grossMismatchMessage}
                          </div>
                        ) : null}
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => updateLineStatus(line.id, 'UNDER_REVIEW')} disabled={busy === `line-${line.id}-UNDER_REVIEW`} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700">Conferir</button>
                          <button type="button" onClick={() => updateLineStatus(line.id, 'APPROVED')} disabled={busy === `line-${line.id}-APPROVED`} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700">Aprovar</button>
                          {canMutate ? <button type="button" onClick={() => openAdjustment(line)} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">Ajuste</button> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {documents.length > 0 ? (
                          <div className="space-y-1">
                            {documents.slice(0, 2).map((document) => <div key={document.id} className="text-xs text-slate-600">{document.type}: {document.fileUrl ? <Link href={document.fileUrl} target="_blank" className="font-medium text-blue-600 hover:text-blue-700">{document.fileName}</Link> : <span>{document.fileName}</span>}</div>)}
                            <div className="text-xs text-slate-500">
                              {line.contractType === 'RPA' && hasManualRpaData && missingRequired
                                ? 'RPA com valores já informados; anexo ainda pendente.'
                                : `${requiredLabel}${missingRequired ? ' pendente' : ' atendida'}`}
                            </div>
                            {driveWarning ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">{driveWarning}</div> : null}
                          </div>
                        ) : <span className="text-slate-400">Sem anexos</span>}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {line.contractType === 'RPA' ? <><button type="button" onClick={() => fileInputRefs.current[`rpa-${line.id}`]?.click()} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Anexar RPA</button><input ref={(el) => { fileInputRefs.current[`rpa-${line.id}`] = el; }} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => { const nextFile = event.target.files?.[0]; if (nextFile) void uploadDocument(line.id, 'RPA', nextFile); }} /></> : null}
                        {line.contractType === 'RPA' ? <button type="button" onClick={() => openRpaEditor(line)} className="mt-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">{latestRpaDocument ? (rpaData?.parserStatus === 'AUTO_FAILED' ? 'Preencher dados da RPA' : 'Revisar dados da RPA') : 'Informar valores da RPA'}</button> : null}
                        {line.contractType === 'PJ' ? <><button type="button" onClick={() => fileInputRefs.current[`nf-${line.id}`]?.click()} className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Anexar NF</button><input ref={(el) => { fileInputRefs.current[`nf-${line.id}`] = el; }} type="file" accept=".pdf,.png,.jpg,.jpeg,.xml" className="hidden" onChange={(event) => { const nextFile = event.target.files?.[0]; if (nextFile) void uploadDocument(line.id, 'INVOICE', nextFile); }} /></> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section id="lotes" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Lotes bancários</h3></div>
          <div className="space-y-3 px-6 py-4">
            <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3">
              <button type="button" onClick={createBatch} disabled={busy === 'batch'} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white">
                {busy === 'batch' ? 'Gerando...' : 'Gerar lote'}
              </button>
              <button type="button" onClick={() => latestBatchId && void downloadBatchExport(latestBatchId)} disabled={!latestBatchId || busy === `export-${latestBatchId}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
                Baixar CNAB
              </button>
              <button type="button" onClick={() => latestBatchId && void runBatchAction(latestBatchId, 'submit')} disabled={!latestBatchId || busy === `submit-${latestBatchId}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
                Marcar como enviado
              </button>
              <button type="button" onClick={() => latestBatchId && void runBatchAction(latestBatchId, 'sync')} disabled={!latestBatchId || busy === `sync-${latestBatchId}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
                Sincronizar comprovantes
              </button>
              <button type="button" onClick={() => latestBatchId && void runBatchAction(latestBatchId, 'emails')} disabled={!latestBatchId || busy === `emails-${latestBatchId}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
                Enviar e-mails
              </button>
            </div>
            {bankBatches.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum lote gerado ainda.</p>
            ) : (
              bankBatches.map((batch) => (
                <div key={batch.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">Lote {batch.id}</div>
                      <div className="text-xs text-slate-500">{batchTransportLabels[batch.transport] || batch.transport} • competência {batch.referenceMonth}</div>
                    </div>
                    <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold">{batchStatusLabels[batch.status] || batch.status}</div>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-4">
                    <div><span className="block text-xs uppercase tracking-wide text-slate-500">Pagamentos</span><strong className="text-slate-900">{batch.payments}</strong></div>
                    <div><span className="block text-xs uppercase tracking-wide text-slate-500">Bruto</span><strong className="text-slate-900">{formatCurrency(batch.grossValue)}</strong></div>
                    <div><span className="block text-xs uppercase tracking-wide text-slate-500">Líquido</span><strong className="text-slate-900">{formatCurrency(batch.netValue)}</strong></div>
                    <div><span className="block text-xs uppercase tracking-wide text-slate-500">Comprovantes</span><strong className="text-slate-900">{batch.receipts}</strong></div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Fluxo sugerido: baixar o CNAB, fazer o pagamento no banco, marcar o lote como enviado, depois sincronizar comprovantes e por último enviar os e-mails.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void downloadBatchExport(batch.id)} disabled={busy === `export-${batch.id}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">Baixar CNAB</button>
                    <button type="button" onClick={() => void runBatchAction(batch.id, 'submit')} disabled={busy === `submit-${batch.id}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">Marcar como enviado</button>
                    <button type="button" onClick={() => void runBatchAction(batch.id, 'sync')} disabled={busy === `sync-${batch.id}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">Sincronizar comprovantes</button>
                    <button type="button" onClick={() => void runBatchAction(batch.id, 'emails')} disabled={busy === `emails-${batch.id}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">Enviar e-mails</button>
                    {batch.externalStatus ? <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Status externo: {batch.externalStatus}</span> : null}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Atualizado em {new Date(batch.updatedAt).toLocaleString('pt-BR')}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section id="documentos" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Documentação da competência</h3>
            </div>
            <div className="space-y-3 px-6 py-4">
              {closing.documents.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum documento anexado ainda para esta competência.</p>
              ) : (
                closing.documents.slice(0, 12).map((document) => (
                  <div key={document.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-900">{document.fileName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {document.type}
                      {document.uploadedAt || document.createdAt ? ` • ${new Date(document.uploadedAt || document.createdAt || '').toLocaleString('pt-BR')}` : ''}
                    </div>
                    {document.type === 'RPA' && document.extractedData?.parserStatus ? (
                      <div className="mt-2 text-xs text-slate-600">
                        {document.extractedData.parserStatus === 'AUTO_OK' ? 'Leitura automática concluída.' : null}
                        {document.extractedData.parserStatus === 'AUTO_FAILED' ? 'Leitura automática falhou; revisão manual pode ser necessária.' : null}
                        {document.extractedData.parserStatus === 'MANUAL_CONFIRMED' ? 'Valores confirmados manualmente.' : null}
                      </div>
                    ) : null}
                    {document.type === 'RPA' && document.extractedData?.grossMismatchMessage ? (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                        {document.extractedData.grossMismatchMessage}
                      </div>
                    ) : null}
                    {formatDocumentWarning(document) ? (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                        {formatDocumentWarning(document)}
                      </div>
                    ) : null}
                    {document.fileUrl ? (
                      <Link href={document.fileUrl} target="_blank" className="mt-2 inline-block text-xs font-medium text-blue-600 hover:text-blue-700">
                        Abrir no Drive
                      </Link>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section id="auditoria" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Auditoria recente</h3>
            </div>
            <div className="space-y-3 px-6 py-4">
              {!closing.auditEvents || closing.auditEvents.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma observação ou evento de auditoria registrado ainda.</p>
              ) : (
                closing.auditEvents.slice(-10).reverse().map((event) => (
                  <div key={event.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-900">{event.message || event.type}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(event.createdAt).toLocaleString('pt-BR')}
                      {event.actorUser?.name ? ` • ${event.actorUser.name}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {rpaEditorLine ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
            <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">RPA da competência</p>
                  <h3 className="mt-1 text-2xl font-semibold text-slate-900">{rpaEditorLine.physiotherapistName}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Use esta tela para corrigir manualmente os valores da RPA quando a leitura automática não for suficiente.
                  </p>
                </div>
                <button type="button" onClick={closeRpaEditor} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700">Fechar</button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Valor do serviço</label>
                  <input type="number" step="0.01" value={rpaValorServico} onChange={(e) => setRpaValorServico(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Outros descontos</label>
                  <input type="number" step="0.01" value={rpaOutrosDescontos} onChange={(e) => setRpaOutrosDescontos(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">ISS</label>
                  <input type="number" step="0.01" value={rpaIss} onChange={(e) => setRpaIss(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">IRRF</label>
                  <input type="number" step="0.01" value={rpaIrrf} onChange={(e) => setRpaIrrf(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">INSS</label>
                  <input type="number" step="0.01" value={rpaInss} onChange={(e) => setRpaInss(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Total de descontos</label>
                  <input type="number" step="0.01" value={rpaTotalDescontos} readOnly className="w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-900" />
                  <p className="mt-1 text-xs text-slate-500">Calculado automaticamente a partir dos descontos informados.</p>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Valor líquido final</label>
                <input type="number" step="0.01" value={rpaValorLiquido} onChange={(e) => setRpaValorLiquido(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
                <p className="mt-2 text-xs text-slate-500">
                  Ao salvar, o sistema reaplica o valor líquido da RPA na linha do fechamento e registra a auditoria da correção manual.
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <button type="button" onClick={saveManualRpaData} disabled={busy === `rpa-line-${rpaEditorLine.id}`} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
                  {busy === `rpa-line-${rpaEditorLine.id}` ? 'Salvando...' : 'Salvar dados da RPA'}
                </button>
                <button type="button" onClick={closeRpaEditor} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
              </div>
            </div>
          </div>
        ) : null}

        {adjustmentLine ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ajuste manual</p>
                  <h3 className="mt-1 text-2xl font-semibold text-slate-900">{adjustmentLine.physiotherapistName}</h3>
                </div>
                <button type="button" onClick={() => setAdjustmentLine(null)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700">Fechar</button>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label><select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value as AdjustmentType)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900">{Object.entries(adjustmentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Valor</label><input type="number" step="0.01" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" /></div>
              </div>
              <div className="mt-4 grid gap-4">
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Motivo</label><input value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Detalhes</label><textarea rows={4} value={adjustmentDescription} onChange={(e) => setAdjustmentDescription(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" /></div>
              </div>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={saveAdjustment} disabled={busy === `adjustment-${adjustmentLine.id}`} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{busy === `adjustment-${adjustmentLine.id}` ? 'Salvando...' : 'Salvar'}</button>
                <button type="button" onClick={() => setAdjustmentLine(null)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}








