'use client';

import { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ShiftTeam, ShiftPeriod } from '@prisma/client';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
// Removido import getCurrentUser - agora usamos API route

const periodColor: Record<ShiftPeriod, string> = {
  MORNING: '#3B82F6', // azul moderno
  INTERMEDIATE: '#8B5CF6', // violeta
  AFTERNOON: '#10B981', // emerald
  NIGHT: '#EF4444', // vermelho
};

const periodOrderMap: Record<ShiftPeriod, number> = {
  MORNING: 1,
  INTERMEDIATE: 2,
  AFTERNOON: 3,
  NIGHT: 4,
};

export default function ShiftCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [allPhysiotherapists, setAllPhysiotherapists] = useState<any[]>([]);
  const [teams, setTeams] = useState<ShiftTeam[]>([]);
  const [viewingTeamId, setViewingTeamId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<ShiftPeriod>('MORNING');
  const [selectedPhysioId, setSelectedPhysioId] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Buscar usuário logado através da API
        const userResponse = await fetch('/api/auth/me');
        let user = null;
        if (userResponse.ok) {
          const userData = await userResponse.json();
          user = userData.user;
          setCurrentUser(user);
        }

        const [physiosRes, teamsRes] = await Promise.all([
          fetch('/api/physiotherapists'),
          fetch('/api/teams')
        ]);
        const physiotherapists = await physiosRes.json();
        const teamsData = await teamsRes.json();
        
        setAllPhysiotherapists(physiotherapists);
        setTeams(teamsData);

        // Se o usuário é USER (fisioterapeuta), pré-selecionar sua primeira equipe
        if (user && user.role === 'USER' && user.physiotherapistId) {
          const userPhysio = physiotherapists.find((p: any) => p.id === user.physiotherapistId);
          if (userPhysio && userPhysio.teams && userPhysio.teams.length > 0) {
            setViewingTeamId(userPhysio.teams[0].shiftTeamId.toString());
          }
        }
      } catch (error) {
        console.error("Falha ao buscar dados iniciais:", error);
        alert('Erro ao carregar dados iniciais.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!viewingTeamId) {
      setEvents([]);
      return;
    }
    fetchShifts(viewingTeamId);
  }, [viewingTeamId]);

  const fetchShifts = async (teamId: string) => {
    try {
      const response = await fetch(`/api/shifts?teamId=${teamId}`);
      const shifts = await response.json();
      const formattedEvents = shifts.map((shift: any) => ({
        id: shift.id.toString(),
        title: shift.physiotherapist.name,
        start: shift.date,
        allDay: true,
        backgroundColor: periodColor[shift.period as ShiftPeriod],
        borderColor: periodColor[shift.period as ShiftPeriod],
        extendedProps: {
          physioId: shift.physiotherapistId,
          teamId: shift.shiftTeamId,
          period: shift.period,
          periodOrder: periodOrderMap[shift.period as ShiftPeriod],
        },
      }));
      setEvents(formattedEvents);
    } catch (error) {
      console.error("Falha ao buscar plantões:", error);
      alert('Erro ao carregar plantões.');
    }
  };

  const availablePhysios = useMemo(() => {
    if (!viewingTeamId) return [];
    const team = teams.find(t => t.id === parseInt(viewingTeamId));
    if (!team) return [];
    
    // Filtrar fisioterapeutas que pertencem à equipe selecionada (many-to-many)
    let physios = allPhysiotherapists.filter(p => 
      p.teams && p.teams.some((t: any) => t.shiftTeamId === team.id)
    );
    
    // Se o usuário é USER (fisioterapeuta), só pode ver a si mesmo
    if (currentUser && currentUser.role === 'USER' && currentUser.physiotherapistId) {
      physios = physios.filter(p => p.id === currentUser.physiotherapistId);
    }
    
    return physios;
  }, [viewingTeamId, allPhysiotherapists, teams, currentUser]);

  const handleCloseModal = () => setShowAddModal(false);
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedEvent(null);
  };

  const handleDateClick = (arg: any) => {
    if (!viewingTeamId) {
      toast.warning('Por favor, selecione uma equipe antes de adicionar um plantão.');
      return;
    }
    setSelectedDate(arg.dateStr);
    
    // Se o usuário é USER, pré-selecionar ele mesmo
    if (currentUser?.role === 'USER' && currentUser.physiotherapistId) {
      setSelectedPhysioId(currentUser.physiotherapistId.toString());
    } else {
      setSelectedPhysioId('');
    }
    
    setSelectedPeriod('MORNING');
    setShowAddModal(true);
  };

  const handleEventClick = (clickInfo: any) => {
    setSelectedEvent(clickInfo.event);
    setSelectedPhysioId(clickInfo.event.extendedProps.physioId.toString());
    setSelectedPeriod(clickInfo.event.extendedProps.period);
    setShowEditModal(true);
  };

  const handleSaveShift = async () => {
    if (!selectedPhysioId || !selectedDate || !viewingTeamId) {
      toast.warning('Por favor, preencha todos os campos.');
      return;
    }
    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          period: selectedPeriod,
          physiotherapistId: parseInt(selectedPhysioId),
          shiftTeamId: parseInt(viewingTeamId),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Falha ao salvar o plantão');
      }
      await fetchShifts(viewingTeamId);
      handleCloseModal();
      toast.success(json.message || 'Plantão criado com sucesso');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    }
  };

  const handleUpdateShift = async () => {
    if (!selectedEvent) return;
    try {
      const response = await fetch(`/api/shifts/${selectedEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physiotherapistId: parseInt(selectedPhysioId),
          period: selectedPeriod,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Falha ao atualizar o plantão');
      await fetchShifts(viewingTeamId);
      handleCloseEditModal();
      toast.success(json.message || 'Plantão atualizado com sucesso');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Não foi possível atualizar o plantão.');
    }
  };

  const handleDeleteShift = async () => {
    if (!selectedEvent) return;
    if (confirm(`Tem certeza que deseja excluir o plantão de ${selectedEvent.title}?`)) {
      try {
        const response = await fetch(`/api/shifts/${selectedEvent.id}`, {
          method: 'DELETE',
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Falha ao excluir o plantão');
        await fetchShifts(viewingTeamId);
        handleCloseEditModal();
        toast.success(json.message || 'Plantão excluído com sucesso');
      } catch (error: any) {
        console.error(error);
        toast.error(error.message || 'Não foi possível excluir o plantão.');
      }
    }
  };

  const handleEventDrop = (dropInfo: any) => console.log('Event dropped:', dropInfo);
  const handleEventReceive = (info: any) => console.log('Event received:', info);
  const handleEventRemove = (info: any) => console.log('Event removed:', info);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const hasIntermediateSlots = () => {
    const team = teams.find(t => t.id === Number(viewingTeamId));
    return team && (team as any).intermediateSlots > 0;
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Equipe */}
      <div className="flex items-center gap-4">
        <div className="w-full max-w-xs">
          <Label className="font-semibold mb-2 block">Selecione a Equipe</Label>
          <Select
            value={viewingTeamId}
            onValueChange={setViewingTeamId}
            disabled={currentUser?.role === 'USER'}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="-- Visualizar Equipe --" />
            </SelectTrigger>
            <SelectContent>
              {teams.map(team => (
                <SelectItem key={team.id} value={team.id.toString()}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentUser?.role === 'USER' && (
            <p className="text-sm text-muted-foreground mt-1">
              Você está visualizando sua equipe
            </p>
          )}
        </div>
      </div>

      {/* Calendário */}
      <div className="bg-white rounded-lg border p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          weekends={true}
          events={events}
          locale={ptBrLocale}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          editable={true}
          droppable={true}
          eventDrop={handleEventDrop}
          eventReceive={handleEventReceive}
          eventRemove={handleEventRemove}
          eventOrder={(a: any, b: any) => {
            const ao = a?.extendedProps?.periodOrder ?? 999;
            const bo = b?.extendedProps?.periodOrder ?? 999;
            if (ao !== bo) return ao - bo;
            return (a.title || '').localeCompare(b.title || '');
          }}
        />
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: periodColor.MORNING }}></div>
          <span>Manhã</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: periodColor.INTERMEDIATE }}></div>
          <span>Intermediário</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: periodColor.AFTERNOON }}></div>
          <span>Tarde</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: periodColor.NIGHT }}></div>
          <span>Noite</span>
        </div>
      </div>

      {/* Modal Adicionar Plantão */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Plantão - {selectedDate}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as ShiftPeriod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING">Manhã</SelectItem>
                  {hasIntermediateSlots() && (
                    <SelectItem value="INTERMEDIATE">Intermediário</SelectItem>
                  )}
                  <SelectItem value="AFTERNOON">Tarde</SelectItem>
                  <SelectItem value="NIGHT">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fisioterapeuta</Label>
              <Select 
                value={selectedPhysioId} 
                onValueChange={setSelectedPhysioId}
                disabled={currentUser?.role === 'USER'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fisioterapeuta" />
                </SelectTrigger>
                <SelectContent>
                  {availablePhysios.map(physio => (
                    <SelectItem key={physio.id} value={physio.id.toString()}>
                      {physio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentUser?.role === 'USER' && (
                <p className="text-sm text-muted-foreground">
                  Você só pode criar plantões para si mesmo
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Fechar
            </Button>
            <Button onClick={handleSaveShift}>
              Salvar Plantão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Plantão */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar Plantão - {selectedEvent ? new Date(selectedEvent.start).toLocaleDateString() : ''}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as ShiftPeriod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING">Manhã</SelectItem>
                  {hasIntermediateSlots() && (
                    <SelectItem value="INTERMEDIATE">Intermediário</SelectItem>
                  )}
                  <SelectItem value="AFTERNOON">Tarde</SelectItem>
                  <SelectItem value="NIGHT">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fisioterapeuta</Label>
              <Select 
                value={selectedPhysioId} 
                onValueChange={setSelectedPhysioId}
                disabled={currentUser?.role === 'USER'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fisioterapeuta" />
                </SelectTrigger>
                <SelectContent>
                  {availablePhysios.map(physio => (
                    <SelectItem key={physio.id} value={physio.id.toString()}>
                      {physio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentUser?.role === 'USER' && (
                <p className="text-sm text-muted-foreground">
                  Você só pode editar seus próprios plantões
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="destructive" onClick={handleDeleteShift}>
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCloseEditModal}>
                Fechar
              </Button>
              <Button onClick={handleUpdateShift}>
                Salvar Alterações
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}