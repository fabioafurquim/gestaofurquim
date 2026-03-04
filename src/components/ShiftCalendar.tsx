'use client';

import { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ShiftTeam, ShiftPeriod } from '@prisma/client';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { toast } from 'sonner';
import '../app/plantoes/calendar-custom.css';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, TrendingUp, Clock } from 'lucide-react';
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
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isMobileView, setIsMobileView] = useState(false);

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

  // Detectar tamanho da tela para alternar vista mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchShifts = async (teamId: string) => {
    try {
      const response = await fetch(`/api/shifts?teamId=${teamId}`);
      const shifts = await response.json();
      const formattedEvents = shifts.map((shift: any) => {
        // Normalizar a data para formato YYYY-MM-DD para evitar problemas de timezone
        const dateObj = new Date(shift.date);
        const dateStr = dateObj.toISOString().split('T')[0];
        
        // Traduzir período para português
        const periodNames: Record<ShiftPeriod, string> = {
          MORNING: 'Manhã',
          INTERMEDIATE: 'Intermediário',
          AFTERNOON: 'Tarde',
          NIGHT: 'Noite',
        };
        
        return {
          id: shift.id.toString(),
          title: shift.physiotherapist.name,
          start: dateStr,
          allDay: true,
          backgroundColor: periodColor[shift.period as ShiftPeriod],
          borderColor: periodColor[shift.period as ShiftPeriod],
          extendedProps: {
            physioId: shift.physiotherapistId,
            teamId: shift.shiftTeamId,
            teamName: shift.shiftTeam.name,
            period: shift.period,
            periodName: periodNames[shift.period as ShiftPeriod],
            periodOrder: periodOrderMap[shift.period as ShiftPeriod],
            physioName: shift.physiotherapist.name,
          },
        };
      });
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

  const handleEventDrop = async (dropInfo: any) => {
    const { event, revert } = dropInfo;
    const shiftId = event.id;
    const newDate = event.startStr;
    
    console.log('Drag and drop - salvando:', { shiftId, newDate, physioId: event.extendedProps.physioId, period: event.extendedProps.period });
    
    try {
      const response = await fetch(`/api/shifts/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newDate,
          physiotherapistId: event.extendedProps.physioId,
          period: event.extendedProps.period,
        }),
      });
      
      const json = await response.json();
      console.log('Resposta da API:', json);
      
      if (!response.ok) {
        revert();
        toast.error(json.error || 'Falha ao mover o plantão');
      } else {
        toast.success('Plantão movido com sucesso');
        // Recarregar os plantões do servidor para garantir sincronização
        await fetchShifts(viewingTeamId);
      }
    } catch (error: any) {
      console.error('Erro no drag and drop:', error);
      revert();
      toast.error('Erro ao mover o plantão');
    }
  };
  
  const handleEventReceive = (info: any) => console.log('Event received:', info);
  const handleEventRemove = (info: any) => console.log('Event removed:', info);

  // Calcular estatísticas dos eventos filtrados pelo mês atual
  const stats = useMemo(() => {
    const counts = { MORNING: 0, INTERMEDIATE: 0, AFTERNOON: 0, NIGHT: 0, total: 0 };
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    events.forEach(e => {
      const eventDate = new Date(e.start);
      // Filtrar apenas eventos do mês atual
      if (eventDate >= monthStart && eventDate <= monthEnd) {
        const period = e.extendedProps?.period as ShiftPeriod;
        if (period && counts[period] !== undefined) {
          counts[period]++;
          counts.total++;
        }
      }
    });
    return counts;
  }, [events, currentMonth]);

  // Nome do mês atual para exibição
  const currentMonthName = useMemo(() => {
    return currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  // Estatísticas adicionais para o dashboard
  const dashboardStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const shiftsToday = events.filter(e => e.start === todayStr).length;
    
    // Fisioterapeutas únicos no mês
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const uniquePhysios = new Set();
    
    events.forEach(e => {
      const eventDate = new Date(e.start);
      if (eventDate >= monthStart && eventDate <= monthEnd) {
        uniquePhysios.add(e.extendedProps?.physioId);
      }
    });
    
    return {
      today: shiftsToday,
      uniquePhysios: uniquePhysios.size,
      monthTotal: stats.total,
    };
  }, [events, currentMonth, stats.total]);

  // Calcular vagas disponíveis por data e período
  const availableSlots = useMemo(() => {
    if (!viewingTeamId) return {};
    
    const team = teams.find(t => t.id === parseInt(viewingTeamId));
    if (!team) return {};
    
    const slots: Record<string, Record<ShiftPeriod, { used: number; total: number }>> = {};
    
    events.forEach(event => {
      const date = event.start;
      const period = event.extendedProps?.period as ShiftPeriod;
      
      if (!slots[date]) {
        slots[date] = {
          MORNING: { used: 0, total: 0 },
          INTERMEDIATE: { used: 0, total: 0 },
          AFTERNOON: { used: 0, total: 0 },
          NIGHT: { used: 0, total: 0 },
        };
      }
      
      if (period) {
        slots[date][period].used++;
      }
    });
    
    // Definir totais baseado em dia útil ou fim de semana/feriado
    Object.keys(slots).forEach(dateStr => {
      const date = new Date(dateStr);
      const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
      
      slots[dateStr].MORNING.total = isWeekendDay ? team.weekendMorningSlots : team.weekdayMorningSlots;
      slots[dateStr].INTERMEDIATE.total = isWeekendDay ? team.weekendIntermediateSlots : team.weekdayIntermediateSlots;
      slots[dateStr].AFTERNOON.total = isWeekendDay ? team.weekendAfternoonSlots : team.weekdayAfternoonSlots;
      slots[dateStr].NIGHT.total = isWeekendDay ? team.weekendNightSlots : team.weekdayNightSlots;
    });
    
    return slots;
  }, [events, viewingTeamId, teams]);

  // Handler para quando o calendário muda de mês
  const handleDatesSet = (dateInfo: any) => {
    // Pegar o meio do range visível para determinar o mês
    const start = new Date(dateInfo.start);
    const end = new Date(dateInfo.end);
    const middle = new Date((start.getTime() + end.getTime()) / 2);
    setCurrentMonth(middle);
  };

  const hasIntermediateSlots = () => {
    const team = teams.find(t => t.id === Number(viewingTeamId));
    return team && (team as any).intermediateSlots > 0;
  };

  // Agrupar plantões por data para vista mobile
  const shiftsGroupedByDate = useMemo(() => {
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    const grouped: Record<string, any[]> = {};
    
    events.forEach(event => {
      const eventDate = new Date(event.start);
      if (eventDate >= monthStart && eventDate <= monthEnd) {
        if (!grouped[event.start]) {
          grouped[event.start] = [];
        }
        grouped[event.start].push(event);
      }
    });
    
    // Ordenar por período dentro de cada data
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const orderA = a.extendedProps?.periodOrder ?? 999;
        const orderB = b.extendedProps?.periodOrder ?? 999;
        return orderA - orderB;
      });
    });
    
    // Retornar array ordenado por data
    return Object.keys(grouped)
      .sort()
      .map(date => ({
        date,
        dateObj: new Date(date),
        shifts: grouped[date],
      }));
  }, [events, currentMonth]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com seletor e estatísticas */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Seletor de Equipe */}
          <div className="flex-1 max-w-sm">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Equipe
            </Label>
            <Select
              value={viewingTeamId}
              onValueChange={setViewingTeamId}
              disabled={currentUser?.role === 'USER'}
            >
              <SelectTrigger className="w-full h-11 bg-gray-50 border-gray-200">
                <SelectValue placeholder="Selecione uma equipe" />
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
              <p className="text-xs text-gray-500 mt-1.5">
                Visualizando sua equipe
              </p>
            )}
          </div>

          {/* Resumo do mês */}
          {viewingTeamId && (
            <div className="flex flex-col items-end gap-2">
              <p className="text-xs text-gray-500 capitalize">
                Plantões em <span className="font-medium">{currentMonthName}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-md" title="Plantões no período da manhã">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-medium text-blue-700">{stats.MORNING}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 rounded-md" title="Plantões no período intermediário">
                  <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                  <span className="text-xs font-medium text-violet-700">{stats.INTERMEDIATE}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-md" title="Plantões no período da tarde">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium text-emerald-700">{stats.AFTERNOON}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-md" title="Plantões no período da noite">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-xs font-medium text-red-700">{stats.NIGHT}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 rounded-md" title="Total de plantões no mês">
                  <span className="text-xs font-bold text-indigo-700">{stats.total} plantões</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard de Resumo */}
      {viewingTeamId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Plantões Hoje
              </CardTitle>
              <Calendar className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {dashboardStats.today}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {dashboardStats.today === 0 ? 'Nenhum plantão' : dashboardStats.today === 1 ? '1 plantão agendado' : `${dashboardStats.today} plantões agendados`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Fisioterapeutas
              </CardTitle>
              <Users className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {dashboardStats.uniquePhysios}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Atuando este mês
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total no Mês
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {dashboardStats.monthTotal}
              </div>
              <p className="text-xs text-gray-500 mt-1 capitalize">
                {currentMonthName}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Média por Período
              </CardTitle>
              <Clock className="h-4 w-4 text-violet-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {dashboardStats.monthTotal > 0 ? Math.round(dashboardStats.monthTotal / 4) : 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Plantões por turno
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vista Mobile - Lista Compacta */}
      {isMobileView && viewingTeamId && (
        <div className="space-y-4">
          {/* Navegação de Mês - Mobile */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => {
                  const newMonth = new Date(currentMonth);
                  newMonth.setMonth(newMonth.getMonth() - 1);
                  setCurrentMonth(newMonth);
                }}
                className="flex items-center justify-center w-12 h-12 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-gray-900 capitalize">
                  {currentMonthName}
                </p>
                <p className="text-sm text-gray-500">
                  {dashboardStats.monthTotal} plantões
                </p>
              </div>
              
              <button
                onClick={() => {
                  const newMonth = new Date(currentMonth);
                  newMonth.setMonth(newMonth.getMonth() + 1);
                  setCurrentMonth(newMonth);
                }}
                className="flex items-center justify-center w-12 h-12 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {shiftsGroupedByDate.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Nenhum plantão neste mês</p>
              </CardContent>
            </Card>
          ) : (
            shiftsGroupedByDate.map(({ date, dateObj, shifts }) => {
              const isToday = date === new Date().toISOString().split('T')[0];
              const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
              const dayNumber = dateObj.getDate();
              const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'short' });
              
              return (
                <Card key={date} className={isToday ? 'border-indigo-500 border-2' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg ${isToday ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                          <span className="text-xs font-medium uppercase">{dayName}</span>
                          <span className="text-xl font-bold">{dayNumber}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 capitalize">
                            {dateObj.toLocaleDateString('pt-BR', { weekday: 'long' })}
                          </p>
                          <p className="text-sm text-gray-500 capitalize">
                            {dayNumber} de {monthName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-600">{shifts.length}</p>
                        <p className="text-xs text-gray-500">plantões</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {shifts.map(shift => (
                        <button
                          key={shift.id}
                          onClick={() => {
                            setSelectedEvent(shift);
                            setSelectedPhysioId(shift.extendedProps.physioId.toString());
                            setSelectedPeriod(shift.extendedProps.period);
                            setShowEditModal(true);
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-98"
                          style={{ borderLeftWidth: '4px', borderLeftColor: shift.backgroundColor }}
                        >
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm"
                            style={{ backgroundColor: shift.backgroundColor }}
                          >
                            {shift.title.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-gray-900">{shift.title}</p>
                            <p className="text-sm text-gray-500">{shift.extendedProps.periodName}</p>
                          </div>
                          <div className="text-right">
                            <div 
                              className="px-2 py-1 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: shift.backgroundColor }}
                            >
                              {shift.extendedProps.periodName}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    
                    {/* Botão para adicionar plantão neste dia */}
                    <button
                      onClick={() => {
                        setSelectedDate(date);
                        if (currentUser?.role === 'USER' && currentUser.physiotherapistId) {
                          setSelectedPhysioId(currentUser.physiotherapistId.toString());
                        } else {
                          setSelectedPhysioId('');
                        }
                        setSelectedPeriod('MORNING');
                        setShowAddModal(true);
                      }}
                      className="w-full mt-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    >
                      + Adicionar plantão neste dia
                    </button>
                  </CardContent>
                </Card>
              );
            })
          )}
          
          {/* Botão Flutuante para Adicionar Plantão - Mobile */}
          <button
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              setSelectedDate(today);
              if (currentUser?.role === 'USER' && currentUser.physiotherapistId) {
                setSelectedPhysioId(currentUser.physiotherapistId.toString());
              } else {
                setSelectedPhysioId('');
              }
              setSelectedPeriod('MORNING');
              setShowAddModal(true);
            }}
            className="fixed bottom-6 right-6 w-16 h-16 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50"
            style={{ boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)' }}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}

      {/* Calendário Desktop */}
      {!isMobileView && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 md:p-6">
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
            datesSet={handleDatesSet}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek'
            }}
            buttonText={{
              today: 'Hoje',
              month: 'Mês',
              week: 'Semana'
            }}
            dayMaxEvents={4}
            moreLinkText={(num) => `+${num} mais`}
            eventOrder={(a: any, b: any) => {
              const ao = a?.extendedProps?.periodOrder ?? 999;
              const bo = b?.extendedProps?.periodOrder ?? 999;
              if (ao !== bo) return ao - bo;
              return (a.title || '').localeCompare(b.title || '');
            }}
            eventContent={(arg) => {
              const { event } = arg;
              const periodName = event.extendedProps?.periodName || '';
              const teamName = event.extendedProps?.teamName || '';
              
              return (
                <div 
                  className="fc-event-main-frame"
                  title={`${event.title}\n${periodName}\nEquipe: ${teamName}\nClique para editar`}
                >
                  <div className="fc-event-title-container">
                    <div className="fc-event-title fc-sticky">
                      {event.title}
                    </div>
                  </div>
                </div>
              );
            }}
            height="auto"
            />
          </div>
          
          {/* Legenda no rodapé */}
          <div className="border-t bg-gray-50 px-6 py-4">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: periodColor.MORNING }}></div>
                <span className="text-gray-600">Manhã</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: periodColor.INTERMEDIATE }}></div>
                <span className="text-gray-600">Intermediário</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: periodColor.AFTERNOON }}></div>
                <span className="text-gray-600">Tarde</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: periodColor.NIGHT }}></div>
                <span className="text-gray-600">Noite</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Plantão */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Adicionar Plantão
            </DialogTitle>
            <p className="text-sm text-gray-500">
              {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </p>
          </DialogHeader>
          
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-base font-medium">Período</Label>
              <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as ShiftPeriod)}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING" className="h-12 text-base">🌅 Manhã</SelectItem>
                  {hasIntermediateSlots() && (
                    <SelectItem value="INTERMEDIATE" className="h-12 text-base">☀️ Intermediário</SelectItem>
                  )}
                  <SelectItem value="AFTERNOON" className="h-12 text-base">🌤️ Tarde</SelectItem>
                  <SelectItem value="NIGHT" className="h-12 text-base">🌙 Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Fisioterapeuta</Label>
              <Select 
                value={selectedPhysioId} 
                onValueChange={setSelectedPhysioId}
                disabled={currentUser?.role === 'USER'}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione um fisioterapeuta" />
                </SelectTrigger>
                <SelectContent>
                  {availablePhysios.map(physio => (
                    <SelectItem key={physio.id} value={physio.id.toString()} className="h-12 text-base">
                      {physio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentUser?.role === 'USER' && (
                <p className="text-sm text-gray-500">
                  Você só pode criar plantões para si mesmo
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={handleCloseModal}
              className="h-12 text-base flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveShift}
              className="h-12 text-base flex-1 sm:flex-none"
            >
              Salvar Plantão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Plantão */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Editar Plantão
            </DialogTitle>
            <p className="text-sm text-gray-500">
              {selectedEvent && new Date(selectedEvent.start + 'T12:00:00').toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </p>
          </DialogHeader>
          
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-base font-medium">Período</Label>
              <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as ShiftPeriod)}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING" className="h-12 text-base">🌅 Manhã</SelectItem>
                  {hasIntermediateSlots() && (
                    <SelectItem value="INTERMEDIATE" className="h-12 text-base">☀️ Intermediário</SelectItem>
                  )}
                  <SelectItem value="AFTERNOON" className="h-12 text-base">🌤️ Tarde</SelectItem>
                  <SelectItem value="NIGHT" className="h-12 text-base">🌙 Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Fisioterapeuta</Label>
              <Select 
                value={selectedPhysioId} 
                onValueChange={setSelectedPhysioId}
                disabled={currentUser?.role === 'USER'}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione um fisioterapeuta" />
                </SelectTrigger>
                <SelectContent>
                  {availablePhysios.map(physio => (
                    <SelectItem key={physio.id} value={physio.id.toString()} className="h-12 text-base">
                      {physio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentUser?.role === 'USER' && (
                <p className="text-sm text-gray-500">
                  Você só pode editar seus próprios plantões
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button 
              variant="destructive" 
              onClick={handleDeleteShift}
              className="h-12 text-base w-full sm:w-auto"
            >
              🗑️ Excluir Plantão
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={handleCloseEditModal}
                className="h-12 text-base flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateShift}
                className="h-12 text-base flex-1 sm:flex-none"
              >
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}