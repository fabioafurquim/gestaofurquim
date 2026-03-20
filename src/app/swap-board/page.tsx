'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';

interface SwapRequest {
  id: number;
  shiftId: number;
  requesterId: number;
  targetPhysioId: number | null;
  status: 'PENDING' | 'PENDING_APPROVAL' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  responderId: number | null;
  approvedBy: number | null;
  approvedAt: string | null;
  shift: {
    id: number;
    date: string;
    period: 'MORNING' | 'INTERMEDIATE' | 'AFTERNOON' | 'NIGHT';
    shiftTeam: {
      id: number;
      name: string;
    };
    physiotherapist: {
      id: number;
      name: string;
    };
  };
  requester: {
    id: number;
    name: string;
  };
  targetPhysio: {
    id: number;
    name: string;
  } | null;
  responder: {
    id: number;
    name: string;
  } | null;
}

interface MyShift {
  id: number;
  date: string;
  period: 'MORNING' | 'INTERMEDIATE' | 'AFTERNOON' | 'NIGHT';
  shiftTeam: {
    id: number;
    name: string;
  };
}

interface TeamPhysio {
  id: number;
  name: string;
}

const periodLabels = {
  MORNING: 'Manhã',
  INTERMEDIATE: 'Intermediário',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

const statusLabels = {
  PENDING: 'Pendente',
  PENDING_APPROVAL: 'Aguardando Aprovação',
  ACCEPTED: 'Aceito',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
};

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PENDING_APPROVAL: 'bg-orange-100 text-orange-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
};

function SwapBoardContent() {
  const { data: session, status: sessionStatus } = useSession();
  const searchParams = useSearchParams();
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'pending-approval' | 'my-requests'>('pending');
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [myShifts, setMyShifts] = useState<MyShift[]>([]);
  const [teamPhysios, setTeamPhysios] = useState<TeamPhysio[]>([]);
  const [loadingPhysios, setLoadingPhysios] = useState(false);
  const [targetPhysioIdInput, setTargetPhysioIdInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchSwapRequests();
      fetchMyShifts();
    }
  }, [sessionStatus]);

  useEffect(() => {
    const shiftIdParam = searchParams.get('shiftId');
    const filterParam = searchParams.get('filter');

    if (filterParam === 'pending-approval') {
      setFilter('pending-approval');
    }

    if (shiftIdParam) {
      const shiftId = parseInt(shiftIdParam, 10);
      if (!isNaN(shiftId)) {
        setSelectedShiftId(shiftId);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedShiftId || myShifts.length === 0) {
      return;
    }

    void fetchTeamPhysiosForShift(selectedShiftId);
  }, [selectedShiftId, myShifts]);

  const fetchTeamPhysiosForShift = async (shiftId: number) => {
    const selectedShift = myShifts.find((shift) => shift.id === shiftId);
    if (!selectedShift) {
      setTeamPhysios([]);
      return;
    }

    try {
      setLoadingPhysios(true);
      setError('');
      const response = await fetch(`/api/teams/${selectedShift.shiftTeam.id}/physiotherapists`);

      if (!response.ok) {
        throw new Error('Erro ao carregar fisioterapeutas');
      }

      const data = await response.json();
      setTeamPhysios(data);
    } catch (err) {
      console.error('Erro ao carregar fisioterapeutas:', err);
      setError('Erro ao carregar fisioterapeutas da equipe');
    } finally {
      setLoadingPhysios(false);
    }
  };

  const fetchMyShifts = async () => {
    try {
      setLoadingShifts(true);
      const response = await fetch('/api/shifts/my');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar plantões');
      }

      const data = await response.json();
      setMyShifts(data);
    } catch (err) {
      console.error('Erro ao carregar plantões:', err);
    } finally {
      setLoadingShifts(false);
    }
  };

  const handleShiftSelect = async (shiftIdStr: string) => {
    const shiftId = shiftIdStr ? parseInt(shiftIdStr, 10) : null;
    setSelectedShiftId(shiftId);
    setTargetPhysioIdInput('');
    setTeamPhysios([]);

    if (!shiftId) return;

    await fetchTeamPhysiosForShift(shiftId);
  };

  const fetchSwapRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/swap-requests');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar solicitações de troca');
      }

      const data = await response.json();
      setSwapRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSwap = async () => {
    if (!selectedShiftId) {
      setError('Selecione um plantão');
      return;
    }

    setError('');
    setSuccessMessage('');

    try {
      const payload: any = {
        shiftId: selectedShiftId,
      };

      if (targetPhysioIdInput) {
        payload.targetPhysioId = parseInt(targetPhysioIdInput, 10);
      }

      if (reasonInput && reasonInput.trim()) {
        payload.reason = reasonInput.trim();
      }

      const response = await fetch('/api/swap-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao criar solicitação de troca');
      }

      setSuccessMessage('Solicitação de troca criada com sucesso!');
      setSelectedShiftId(null);
      setTargetPhysioIdInput('');
      setReasonInput('');
      setTeamPhysios([]);
      fetchSwapRequests();
      fetchMyShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar solicitação de troca');
    }
  };

  const handleAcceptSwap = async (swapId: number) => {
    if (!confirm('Tem certeza que deseja aceitar esta troca?')) {
      return;
    }

    try {
      const response = await fetch(`/api/swap-requests/${swapId}/accept`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao aceitar troca');
      }

      setSuccessMessage('Troca aceita com sucesso! Aguarde a aprovação pela gestão.');
      fetchSwapRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aceitar troca');
    }
  };

  const handleRejectSwap = async (swapId: number) => {
    if (!confirm('Tem certeza que deseja rejeitar esta troca?')) {
      return;
    }

    try {
      const response = await fetch(`/api/swap-requests/${swapId}/reject`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao rejeitar troca');
      }

      setSuccessMessage('Troca rejeitada com sucesso!');
      fetchSwapRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao rejeitar troca');
    }
  };

  const handleCancelSwap = async (swapId: number) => {
    if (!confirm('Tem certeza que deseja cancelar esta troca?')) {
      return;
    }

    try {
      const response = await fetch(`/api/swap-requests/${swapId}/cancel`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao cancelar troca');
      }

      setSuccessMessage('Troca cancelada com sucesso!');
      fetchSwapRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar troca');
    }
  };

  const handleApproveSwap = async (swapId: number) => {
    if (!confirm('Tem certeza que deseja aprovar esta troca?')) {
      return;
    }

    try {
      const response = await fetch(`/api/swap-requests/${swapId}/approve`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao aprovar troca');
      }

      setSuccessMessage('Troca aprovada com sucesso!');
      fetchSwapRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar troca');
    }
  };

  const filteredSwaps = swapRequests.filter(swap => {
    if (filter === 'pending') {
      return swap.status === 'PENDING';
    }
    if (filter === 'pending-approval') {
      return swap.status === 'PENDING_APPROVAL';
    }
    if (filter === 'my-requests') {
      if (!session?.user?.physiotherapistId) return false;
      const userPhysioId = typeof session.user.physiotherapistId === 'string' 
        ? parseInt(session.user.physiotherapistId) 
        : session.user.physiotherapistId;
      return swap.requesterId === userPhysioId;
    }
    return true;
  });

  if (sessionStatus === 'loading' || loading) {
    return (
      <AuthLayout title="Mural de Trocas">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Mural de Trocas">
      <div className="space-y-6">
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Solicitar Troca de Plantão</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                1. Selecione o plantão que deseja trocar
              </label>
              <select
                value={selectedShiftId ?? ''}
                onChange={(e) => handleShiftSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um plantão</option>
                {myShifts.map(shift => (
                  <option key={shift.id} value={shift.id}>
                    {new Date(shift.date).toLocaleDateString('pt-BR')} - {periodLabels[shift.period]} - {shift.shiftTeam.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedShiftId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  2. Para quem deseja oferecer? (opcional)
                </label>
                <select
                  value={targetPhysioIdInput}
                  onChange={(e) => setTargetPhysioIdInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingPhysios || !selectedShiftId}
                >
                  <option value="">Aberto para todos da equipe</option>
                  {teamPhysios.map(physio => (
                    <option key={physio.id} value={physio.id}>
                      {physio.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecione um nome para direcionar a troca ou deixe em branco para abrir para toda a equipe
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                3. Motivo da troca (opcional)
              </label>
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Ex: Compromisso pessoal, consulta médica, etc."
              />
            </div>

            <button
              onClick={handleCreateSwap}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Criar Solicitação
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pendentes
            </button>
            {(session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER') && (
              <button
                onClick={() => setFilter('pending-approval')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'pending-approval'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Aguardando Aprovação
              </button>
            )}
            <button
              onClick={() => setFilter('my-requests')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'my-requests'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Minhas Solicitações
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
          </div>
        </div>

        {filteredSwaps.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma troca encontrada</h3>
            <p className="mt-1 text-sm text-gray-500">
              Não há solicitações de troca {filter === 'pending' ? 'pendentes' : filter === 'my-requests' ? 'suas' : ''} no momento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSwaps.map((swap) => (
              <div key={swap.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {swap.requester.name}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[swap.status]}`}>
                          {statusLabels[swap.status]}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Plantão:</span>{' '}
                          {new Date(swap.shift.date).toLocaleDateString('pt-BR')} - {periodLabels[swap.shift.period]}
                        </p>
                        <p>
                          <span className="font-medium">Equipe:</span> {swap.shift.shiftTeam.name}
                        </p>
                        {swap.targetPhysio && (
                          <p>
                            <span className="font-medium">Para:</span> {swap.targetPhysio.name}
                          </p>
                        )}
                        {!swap.targetPhysio && (
                          <p>
                            <span className="font-medium">Para:</span> Aberto para todos
                          </p>
                        )}
                        {swap.reason && (
                          <p>
                            <span className="font-medium">Motivo:</span> {swap.reason}
                          </p>
                        )}
                        {swap.responder && (
                          <p>
                            <span className="font-medium">Aceito por:</span> {swap.responder.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(swap.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {swap.status === 'PENDING' && (
                      <>
                        {session?.user?.physiotherapistId && 
                         swap.requesterId !== (typeof session.user.physiotherapistId === 'string' 
                           ? parseInt(session.user.physiotherapistId) 
                           : session.user.physiotherapistId) && (
                          <button
                            onClick={() => handleAcceptSwap(swap.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                          >
                            Aceitar
                          </button>
                        )}
                        {session?.user?.physiotherapistId && 
                         swap.requesterId === (typeof session.user.physiotherapistId === 'string' 
                           ? parseInt(session.user.physiotherapistId) 
                           : session.user.physiotherapistId) && (
                          <button
                            onClick={() => handleCancelSwap(swap.id)}
                            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                      </>
                    )}

                    {swap.status === 'PENDING_APPROVAL' && 
                     (session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER') && (
                      <button
                        onClick={() => handleApproveSwap(swap.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Aprovar Troca
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

export default function SwapBoardPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Mural de Trocas">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AuthLayout>
    }>
      <SwapBoardContent />
    </Suspense>
  );
}
