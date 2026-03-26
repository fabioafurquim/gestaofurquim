'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

import { applyCurrencyMask, removeCurrencyMask } from '@/lib/input-masks';

type TeamHistoryItem = {
  id: number;
  shiftValue: number;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
  changeReason: string | null;
  createdByName: string | null;
  updatedByName: string | null;
  isCurrent: boolean;
  isFuture: boolean;
};

type TeamPriceHistoryResponse = {
  team: {
    id: number;
    name: string;
    currentShiftValue: number;
    currentHistoryId: number | null;
    nextScheduledValue: number | null;
    nextScheduledFrom: string | null;
  };
  history: TeamHistoryItem[];
};

type PriceImpactPreview = {
  startDate: string;
  endDate: string | null;
  affectedShiftCount: number;
  affectedPhysiotherapistCount: number;
  affectedMonths: string[];
  lockedMonths: Array<{
    month: string;
    controlStatus: string | null;
    hasPaidRecords: boolean;
  }>;
};

const formatCurrency = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

const formatDateTime = (value: string | null) => {
  if (!value) return '-';

  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};

const toDateTimeLocalValue = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  const timezoneOffset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - timezoneOffset * 60 * 1000);
  return adjusted.toISOString().slice(0, 16);
};

export default function TeamPriceHistoryManager({ teamId }: { teamId: number }) {
  const { data: session } = useSession();
  const [data, setData] = useState<TeamPriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PriceImpactPreview | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [shiftValueInput, setShiftValueInput] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(toDateTimeLocalValue());
  const [changeReason, setChangeReason] = useState('');

  const isAdmin = session?.user?.role === 'ADMIN';

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/teams/${teamId}/price-history`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao carregar histórico.');
      }

      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [teamId]);

  const resetForm = () => {
    setFormMode(null);
    setHistoryId(null);
    setShiftValueInput('');
    setEffectiveFrom(toDateTimeLocalValue());
    setChangeReason('');
    setPreview(null);
  };

  const startCreate = () => {
    setFormMode('create');
    setHistoryId(null);
    setShiftValueInput(applyCurrencyMask(String(Math.round((data?.team.currentShiftValue ?? 0) * 100))));
    setEffectiveFrom(toDateTimeLocalValue());
    setChangeReason('');
    setPreview(null);
  };

  const startEdit = (item: TeamHistoryItem) => {
    setFormMode('edit');
    setHistoryId(item.id);
    setShiftValueInput(applyCurrencyMask(String(Math.round(item.shiftValue * 100))));
    setEffectiveFrom(toDateTimeLocalValue(item.effectiveFrom));
    setChangeReason(item.changeReason ?? '');
    setPreview(null);
  };

  const currentSummary = useMemo(() => data?.team ?? null, [data]);

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      setError(null);

      const response = await fetch(`/api/teams/${teamId}/price-history/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historyId,
          effectiveFrom,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao calcular impacto.');
      }

      setPreview(payload);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Erro ao calcular impacto.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const url =
        formMode === 'edit' && historyId
          ? `/api/teams/${teamId}/price-history/${historyId}`
          : `/api/teams/${teamId}/price-history`;
      const method = formMode === 'edit' ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftValue: removeCurrencyMask(shiftValueInput),
          effectiveFrom,
          changeReason,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao salvar histórico.');
      }

      resetForm();
      await loadHistory();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao salvar histórico.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card mt-4">
        <div className="card-body">Carregando histórico de valores...</div>
      </div>
    );
  }

  return (
    <div className="card mt-4">
      <div className="card-header d-flex flex-column gap-2">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          <div>
            <h5 className="card-title mb-1">Histórico de Valores da Equipe</h5>
            <p className="text-muted mb-0">
              Visualize vigências, agende novos valores e corrija histórico com impacto antes de salvar.
            </p>
          </div>
          <button type="button" className="btn btn-outline-primary" onClick={startCreate}>
            Nova vigência
          </button>
        </div>
      </div>

      <div className="card-body">
        {error && <div className="alert alert-danger">{error}</div>}

        {currentSummary && (
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <div className="text-muted small">Valor atual</div>
                <div className="fs-4 fw-semibold">{formatCurrency(currentSummary.currentShiftValue)}</div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <div className="text-muted small">Próxima vigência agendada</div>
                <div className="fw-semibold">
                  {currentSummary.nextScheduledValue !== null
                    ? `${formatCurrency(currentSummary.nextScheduledValue)} em ${formatDateTime(currentSummary.nextScheduledFrom)}`
                    : 'Nenhuma vigência futura cadastrada'}
                </div>
              </div>
            </div>
          </div>
        )}

        {formMode && (
          <form onSubmit={handleSubmit} className="border rounded p-3 mb-4 bg-light">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h6 className="mb-1">
                  {formMode === 'edit' ? 'Corrigir registro histórico' : 'Cadastrar nova vigência'}
                </h6>
                <p className="text-muted small mb-0">
                  Vigências retroativas e correções de histórico são restritas a administradores.
                </p>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>
                Fechar
              </button>
            </div>

            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Valor do plantão</label>
                <input
                  type="text"
                  className="form-control"
                  value={shiftValueInput}
                  onChange={(event) => setShiftValueInput(applyCurrencyMask(event.target.value))}
                  placeholder="R$ 0,00"
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Vigência a partir de</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Motivo</label>
                <input
                  type="text"
                  className="form-control"
                  value={changeReason}
                  onChange={(event) => setChangeReason(event.target.value)}
                  placeholder="Ex.: reajuste anual, correção de vigência"
                  required
                />
              </div>
            </div>

            <div className="d-flex gap-2 mt-3">
              <button type="button" className="btn btn-outline-secondary" onClick={handlePreview} disabled={previewLoading}>
                {previewLoading ? 'Calculando impacto...' : 'Pré-visualizar impacto'}
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando...' : formMode === 'edit' ? 'Salvar correção' : 'Salvar vigência'}
              </button>
            </div>

            {preview && (
              <div className="alert alert-info mt-3 mb-0">
                <div className="fw-semibold mb-1">Impacto estimado</div>
                <div>
                  {preview.affectedShiftCount} plantão(ões) potencialmente afetado(s) em {preview.affectedPhysiotherapistCount}{' '}
                  fisioterapeuta(s).
                </div>
                <div>Janela: {formatDateTime(preview.startDate)} até {formatDateTime(preview.endDate)}</div>
                <div>
                  Meses envolvidos:{' '}
                  {preview.affectedMonths.length > 0 ? preview.affectedMonths.join(', ') : 'nenhum plantão encontrado na faixa.'}
                </div>
                {preview.lockedMonths.length > 0 && (
                  <div className="mt-2 text-danger">
                    Atenção: há meses já processados/pagos nesta faixa ({preview.lockedMonths
                      .map((month) => month.month)
                      .join(', ')}).
                  </div>
                )}
              </div>
            )}
          </form>
        )}

        <div className="table-responsive">
          <table className="table table-striped align-middle">
            <thead>
              <tr>
                <th>Vigência</th>
                <th>Valor</th>
                <th>Situação</th>
                <th>Motivo</th>
                <th>Registrado por</th>
                <th>Última edição</th>
                <th className="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data?.history.length ? (
                data.history.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.effectiveFrom)}</td>
                    <td className="fw-semibold">{formatCurrency(item.shiftValue)}</td>
                    <td>
                      {item.isCurrent ? (
                        <span className="badge bg-success">Atual</span>
                      ) : item.isFuture ? (
                        <span className="badge bg-primary">Futuro</span>
                      ) : (
                        <span className="badge bg-secondary">Histórico</span>
                      )}
                    </td>
                    <td>{item.changeReason || '-'}</td>
                    <td>{item.createdByName || 'Sistema'}</td>
                    <td>
                      {formatDateTime(item.updatedAt)}
                      {item.updatedByName ? <div className="small text-muted">{item.updatedByName}</div> : null}
                    </td>
                    <td className="text-end">
                      {isAdmin ? (
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => startEdit(item)}>
                          Corrigir
                        </button>
                      ) : (
                        <span className="text-muted small">Somente admin</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    Ainda não há histórico registrado para esta equipe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
