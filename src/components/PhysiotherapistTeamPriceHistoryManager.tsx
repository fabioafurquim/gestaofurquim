'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

import { applyCurrencyMask, removeCurrencyMask } from '@/lib/input-masks';

type CustomHistoryItem = {
  id: number;
  customShiftValue: number | null;
  effectiveFrom: string;
  updatedAt: string;
  changeReason: string | null;
  createdByName: string | null;
  updatedByName: string | null;
  isCurrent: boolean;
  isFuture: boolean;
};

type AssignmentHistory = {
  physiotherapistTeamId: number;
  shiftTeamId: number;
  teamName: string;
  teamDefaultValue: number;
  currentCustomValue: number | null;
  currentHistoryId: number | null;
  nextScheduledValue: number | null;
  nextScheduledFrom: string | null;
  history: CustomHistoryItem[];
};

type CustomHistoryResponse = {
  physiotherapist: { id: number; name: string };
  assignments: AssignmentHistory[];
};

type Preview = {
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
  value === null || value === undefined
    ? 'Usando valor padrão da equipe'
    : value.toLocaleString('pt-BR', {
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

export default function PhysiotherapistTeamPriceHistoryManager({
  physiotherapistId,
}: {
  physiotherapistId: number;
}) {
  const { data: session } = useSession();
  const [data, setData] = useState<CustomHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formAssignmentId, setFormAssignmentId] = useState<number | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null);
  const [customValueInput, setCustomValueInput] = useState('');
  const [useDefaultValue, setUseDefaultValue] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(toDateTimeLocalValue());
  const [changeReason, setChangeReason] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN';

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/physiotherapists/${physiotherapistId}/team-price-history`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao carregar histórico customizado.');
      }

      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar histórico customizado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [physiotherapistId]);

  const resetForm = () => {
    setFormAssignmentId(null);
    setEditingHistoryId(null);
    setCustomValueInput('');
    setUseDefaultValue(false);
    setEffectiveFrom(toDateTimeLocalValue());
    setChangeReason('');
    setPreview(null);
  };

  const openCreateForm = (assignment: AssignmentHistory) => {
    setFormAssignmentId(assignment.shiftTeamId);
    setEditingHistoryId(null);
    setUseDefaultValue(assignment.currentCustomValue === null);
    setCustomValueInput(
      assignment.currentCustomValue !== null
        ? applyCurrencyMask(String(Math.round(assignment.currentCustomValue * 100)))
        : ''
    );
    setEffectiveFrom(toDateTimeLocalValue());
    setChangeReason('');
    setPreview(null);
  };

  const openEditForm = (assignment: AssignmentHistory, history: CustomHistoryItem) => {
    setFormAssignmentId(assignment.shiftTeamId);
    setEditingHistoryId(history.id);
    setUseDefaultValue(history.customShiftValue === null);
    setCustomValueInput(
      history.customShiftValue !== null
        ? applyCurrencyMask(String(Math.round(history.customShiftValue * 100)))
        : ''
    );
    setEffectiveFrom(toDateTimeLocalValue(history.effectiveFrom));
    setChangeReason(history.changeReason ?? '');
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!formAssignmentId) return;

    try {
      setPreviewLoading(true);
      setError(null);

      const response = await fetch(`/api/physiotherapists/${physiotherapistId}/team-price-history/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftTeamId: formAssignmentId,
          historyId: editingHistoryId,
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

    if (!formAssignmentId) return;

    try {
      setSaving(true);
      setError(null);

      const url = editingHistoryId
        ? `/api/physiotherapists/${physiotherapistId}/team-price-history/${editingHistoryId}`
        : `/api/physiotherapists/${physiotherapistId}/team-price-history`;
      const method = editingHistoryId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftTeamId: formAssignmentId,
          customShiftValue: useDefaultValue ? null : removeCurrencyMask(customValueInput),
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
        <div className="card-body">Carregando histórico customizado...</div>
      </div>
    );
  }

  return (
    <div className="card mt-4">
      <div className="card-header">
        <h5 className="card-title mb-1">Histórico de Valores Customizados</h5>
        <p className="text-muted mb-0">
          Gerencie exceções por equipe para este fisioterapeuta. Deixar o valor como padrão faz o sistema voltar ao valor da equipe.
        </p>
      </div>
      <div className="card-body">
        {error && <div className="alert alert-danger">{error}</div>}

        {!data?.assignments.length && (
          <div className="alert alert-info mb-0">
            Este fisioterapeuta ainda não possui vínculos ativos salvos com equipes. O histórico customizado aparecerá após salvar os vínculos.
          </div>
        )}

        {data?.assignments.map((assignment) => (
          <div key={assignment.physiotherapistTeamId} className="border rounded p-3 mb-4">
            <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-3">
              <div>
                <h6 className="mb-1">{assignment.teamName}</h6>
                <div className="small text-muted">Valor padrão da equipe: {formatCurrency(assignment.teamDefaultValue)}</div>
                <div className="small text-muted">Valor customizado atual: {formatCurrency(assignment.currentCustomValue)}</div>
                <div className="small text-muted">
                  Próxima vigência: {assignment.nextScheduledFrom
                    ? `${formatCurrency(assignment.nextScheduledValue)} em ${formatDateTime(assignment.nextScheduledFrom)}`
                    : 'nenhuma'}
                </div>
              </div>
              <div className="d-flex align-items-start">
                <button type="button" className="btn btn-outline-primary" onClick={() => openCreateForm(assignment)}>
                  Nova vigência customizada
                </button>
              </div>
            </div>

            {formAssignmentId === assignment.shiftTeamId && (
              <form onSubmit={handleSubmit} className="border rounded p-3 mb-3 bg-light">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h6 className="mb-1">
                      {editingHistoryId ? 'Corrigir histórico customizado' : 'Cadastrar vigência customizada'}
                    </h6>
                    <p className="text-muted small mb-0">
                      Correções retroativas e edição de histórico permanecem restritas a administradores.
                    </p>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>
                    Fechar
                  </button>
                </div>

                <div className="row g-3">
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
                    <label className="form-label">Valor customizado</label>
                    <input
                      type="text"
                      className="form-control"
                      value={customValueInput}
                      onChange={(event) => setCustomValueInput(applyCurrencyMask(event.target.value))}
                      placeholder="R$ 0,00"
                      disabled={useDefaultValue}
                    />
                    <div className="form-check mt-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`use-default-${assignment.physiotherapistTeamId}`}
                        checked={useDefaultValue}
                        onChange={(event) => setUseDefaultValue(event.target.checked)}
                      />
                      <label className="form-check-label" htmlFor={`use-default-${assignment.physiotherapistTeamId}`}>
                        Voltar a usar o valor padrão da equipe
                      </label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Motivo</label>
                    <input
                      type="text"
                      className="form-control"
                      value={changeReason}
                      onChange={(event) => setChangeReason(event.target.value)}
                      placeholder="Ex.: exceção contratual, correção retroativa"
                      required
                    />
                  </div>
                </div>

                <div className="d-flex gap-2 mt-3">
                  <button type="button" className="btn btn-outline-secondary" onClick={handlePreview} disabled={previewLoading}>
                    {previewLoading ? 'Calculando impacto...' : 'Pré-visualizar impacto'}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Salvando...' : editingHistoryId ? 'Salvar correção' : 'Salvar vigência'}
                  </button>
                </div>

                {preview && (
                  <div className="alert alert-info mt-3 mb-0">
                    <div className="fw-semibold mb-1">Impacto estimado</div>
                    <div>{preview.affectedShiftCount} plantão(ões) deste vínculo podem ser afetados.</div>
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
              <table className="table table-striped align-middle mb-0">
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
                  {assignment.history.length ? (
                    assignment.history.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDateTime(item.effectiveFrom)}</td>
                        <td className="fw-semibold">{formatCurrency(item.customShiftValue)}</td>
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
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openEditForm(assignment, item)}>
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
                      <td colSpan={7} className="text-center text-muted py-3">
                        Ainda não há histórico customizado para esta equipe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
