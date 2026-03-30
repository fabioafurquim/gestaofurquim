'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ShiftPeriod, ShiftSlotDayType } from '@prisma/client';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
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
import { Calendar, Users, TrendingUp, Clock, FileDown, Loader2 } from 'lucide-react';
import { SHIFT_PERIOD_LABELS } from '@/lib/shift-team-slots';
// Removido import getCurrentUser - agora usamos API route

interface TeamSlot {
  id: number;
  period: ShiftPeriod;
  dayType: ShiftSlotDayType;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

interface Team {
  id: number;
  name: string;
  weekdayMorningSlots: number;
  weekdayIntermediateSlots: number;
  weekdayAfternoonSlots: number;
  weekdayNightSlots: number;
  weekendMorningSlots: number;
  weekendIntermediateSlots: number;
  weekendAfternoonSlots: number;
  weekendNightSlots: number;
  shiftSlots: TeamSlot[];
}

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

const recurrenceWeekdayOptions = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

const seriesScopeOptions = [
  { value: 'THIS', label: 'Somente este plantão' },
  { value: 'THIS_AND_FUTURE', label: 'Este e os próximos' },
  { value: 'ALL', label: 'Série inteira' },
] as const;

export default function ShiftCalendar() {
  const { data: session } = useSession();
  const calendarRef = useRef<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [allPhysiotherapists, setAllPhysiotherapists] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [viewingTeamId, setViewingTeamId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<ShiftPeriod>('MORNING');
  const [selectedPhysioId, setSelectedPhysioId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const [editScope, setEditScope] = useState<'THIS' | 'THIS_AND_FUTURE' | 'ALL'>('THIS');
  const [deleteScope, setDeleteScope] = useState<'THIS' | 'THIS_AND_FUTURE' | 'ALL'>('THIS');
  const [seriesEndDate, setSeriesEndDate] = useState('');
  const [seriesWeekdays, setSeriesWeekdays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isMobileView, setIsMobileView] = useState(false);
  const [viewAllTeams, setViewAllTeams] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showMobileCalendar, setShowMobileCalendar] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());

  const currentUser = session?.user;
  const canManageShifts = !!currentUser && currentUser.role !== 'USER';

  const extractApiError = (payload: unknown, fallbackMessage: string) => {
    if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
      return payload.error;
    }

    return fallbackMessage;
  };

  const canRequestSwapForShift = (physioId?: number) => {
    if (!currentUser || currentUser.role !== 'USER') return false;
    return Number(currentUser.physiotherapistId) === Number(physioId);
  };

  const selectedEventSeriesId = selectedEvent?.extendedProps?.seriesId;
  const selectedEventBelongsToSeries = Boolean(selectedEventSeriesId);
  const activeTeamId = useMemo(() => {
    if (selectedEvent?.extendedProps?.teamId) {
      return String(selectedEvent.extendedProps.teamId);
    }

    return viewingTeamId;
  }, [selectedEvent, viewingTeamId]);

  const activeTeam = useMemo(
    () => teams.find((team) => team.id === Number(activeTeamId)) ?? null,
    [activeTeamId, teams]
  );

  const visibleTeams = useMemo(() => {
    if (!currentUser || currentUser.role !== 'USER' || !currentUser.physiotherapistId) {
      return teams;
    }

    const currentPhysio = allPhysiotherapists.find(
      (physio) => Number(physio.id) === Number(currentUser.physiotherapistId)
    );
    const allowedTeamIds = new Set(
      (currentPhysio?.teams ?? []).map((team: any) => Number(team.shiftTeamId))
    );

    return teams.filter((team) => allowedTeamIds.has(team.id));
  }, [allPhysiotherapists, currentUser, teams]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [physiosRes, teamsRes] = await Promise.all([
          fetch('/api/physiotherapists'),
          fetch('/api/teams'),
        ]);
        const physiotherapists = await physiosRes.json();
        const teamsData = await teamsRes.json();
        const holidaysRes = await fetch('/api/holidays');
        const holidaysData = holidaysRes.ok ? await holidaysRes.json() : [];
        
        setAllPhysiotherapists(physiotherapists);
        setTeams(teamsData);
        setHolidayDates(
          new Set(
            holidaysData.map((holiday: { date: string }) => {
              const date = new Date(holiday.date);
              return [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, '0'),
                String(date.getDate()).padStart(2, '0'),
              ].join('-');
            })
          )
        );

        // Se o usuário é USER (fisioterapeuta), pré-selecionar sua primeira equipe
        if (currentUser && currentUser.role === 'USER' && currentUser.physiotherapistId) {
          const userPhysio = physiotherapists.find((p: any) => Number(p.id) === Number(currentUser.physiotherapistId));
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
  }, [currentUser]);

  const fetchShifts = async (teamId: string) => {
    try {
      const response = await fetch(`/api/shifts?teamId=${teamId}`);
      const shifts = await response.json();

      if (!response.ok) {
        throw new Error(extractApiError(shifts, 'Erro ao carregar plantões.'));
      }

      if (!Array.isArray(shifts)) {
        throw new Error(extractApiError(shifts, 'Resposta inválida ao carregar plantões.'));
      }

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
          editable: canManageShifts,
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
            slotId: shift.shiftTeamSlotId,
            slotDescription: shift.shiftTeamSlot?.description ?? '',
            seriesId: shift.shiftSeries?.id ?? null,
            seriesStartDate: shift.shiftSeries?.startDate ?? null,
            seriesEndDate: shift.shiftSeries?.endDate ?? null,
            seriesWeekdays: shift.shiftSeries?.weekdays ?? [],
            isSeriesException: shift.isSeriesException ?? false,
            seriesExceptionType: shift.seriesException?.type ?? null,
            canManage: canManageShifts,
            canRequestSwap: canRequestSwapForShift(shift.physiotherapistId),
          },
        };
      });
      setEvents(formattedEvents);
    } catch (error) {
      console.error("Falha ao buscar plantões:", error);
      setEvents([]);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar plantões.');
    }
  };

  const fetchAllTeamsShifts = async () => {
    try {
      // Buscar plantões de todas as equipes
      const allShiftsPromises = teams.map(async (team) => {
        const response = await fetch(`/api/shifts?teamId=${team.id}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(extractApiError(payload, `Erro ao carregar plantões da equipe ${team.name}.`));
        }

        if (!Array.isArray(payload)) {
          throw new Error(
            extractApiError(payload, `Resposta inválida ao carregar plantões da equipe ${team.name}.`)
          );
        }

        return payload;
      }
      );
      
      const allShiftsArrays = await Promise.all(allShiftsPromises);
      const allShifts = allShiftsArrays.flat();
      
      const periodNames: Record<ShiftPeriod, string> = {
        MORNING: 'Manhã',
        INTERMEDIATE: 'Intermediário',
        AFTERNOON: 'Tarde',
        NIGHT: 'Noite',
      };
      
      const formattedEvents = allShifts.map((shift: any) => {
        const dateObj = new Date(shift.date);
        const dateStr = dateObj.toISOString().split('T')[0];
        
        return {
          id: shift.id.toString(),
          title: `${shift.physiotherapist.name} (${shift.shiftTeam.name})`,
          start: dateStr,
          allDay: true,
          editable: canManageShifts,
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
            slotId: shift.shiftTeamSlotId,
            slotDescription: shift.shiftTeamSlot?.description ?? '',
            seriesId: shift.shiftSeries?.id ?? null,
            seriesStartDate: shift.shiftSeries?.startDate ?? null,
            seriesEndDate: shift.shiftSeries?.endDate ?? null,
            seriesWeekdays: shift.shiftSeries?.weekdays ?? [],
            isSeriesException: shift.isSeriesException ?? false,
            seriesExceptionType: shift.seriesException?.type ?? null,
            canManage: canManageShifts,
            canRequestSwap: canRequestSwapForShift(shift.physiotherapistId),
          },
        };
      });
      
      setEvents(formattedEvents);
    } catch (error) {
      console.error("Falha ao buscar plantões de todas as equipes:", error);
      setEvents([]);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar plantões.');
    }
  };

  useEffect(() => {
    if (viewAllTeams) {
      fetchAllTeamsShifts();
    } else if (viewingTeamId) {
      fetchShifts(viewingTeamId);
    } else {
      setEvents([]);
    }
  }, [viewingTeamId, viewAllTeams, teams, currentUser, canManageShifts]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'USER') {
      return;
    }

    if (visibleTeams.length === 0) {
      setViewingTeamId('');
      return;
    }

    const currentSelectionStillVisible = visibleTeams.some((team) => String(team.id) === viewingTeamId);
    if (!currentSelectionStillVisible) {
      setViewingTeamId(String(visibleTeams[0].id));
    }
  }, [currentUser, viewingTeamId, visibleTeams]);

  // Detectar tamanho da tela para alternar vista mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Forçar re-render do calendário quando eventos mudarem
  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [events]);

  const availablePhysios = useMemo(() => {
    if (!activeTeamId) return [];
    const team = teams.find(t => t.id === parseInt(activeTeamId));
    if (!team) return [];
    
    // Filtrar fisioterapeutas que pertencem à equipe selecionada (many-to-many)
    const physios = allPhysiotherapists.filter(p => 
      p.teams && p.teams.some((t: any) => t.shiftTeamId === team.id)
    );

    return physios;
  }, [activeTeamId, allPhysiotherapists, teams]);

  const canManageSelectedEvent = useMemo(() => {
    return canManageShifts;
  }, [canManageShifts]);

  const canRequestSwapSelectedEvent = useMemo(() => {
    return canRequestSwapForShift(selectedEvent?.extendedProps?.physioId);
  }, [selectedEvent, currentUser]);

  const handleCloseModal = () => {
    setShowAddModal(false);
    setSelectedSlotId('');
    setRecurrenceEnabled(false);
    setRecurrenceEndDate('');
    setRecurrenceWeekdays([]);
  };
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedEvent(null);
    setSelectedSlotId('');
    setEditScope('THIS');
    setDeleteScope('THIS');
    setSeriesEndDate('');
    setSeriesWeekdays([]);
  };

  const restoreCalendarDate = (date?: Date | null) => {
    if (!date) {
      return;
    }

    setTimeout(() => {
      if (calendarRef.current) {
        calendarRef.current.getApi().gotoDate(date);
      }
    }, 100);
  };

  const refreshVisibleCalendar = async (preserveDate?: Date | null) => {
    if (viewAllTeams) {
      await fetchAllTeamsShifts();
    } else if (viewingTeamId) {
      await fetchShifts(viewingTeamId);
    }

    restoreCalendarDate(preserveDate);
  };

  const handleExportMonthlyPdf = async () => {
    if (!viewingTeamId || viewAllTeams) {
      toast.warning('Selecione uma equipe específica para exportar a escala.');
      return;
    }

    const monthParam = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

    try {
      setExportingPdf(true);

      const response = await fetch(
        `/api/shifts/export-monthly?teamId=${viewingTeamId}&month=${monthParam}`
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error || 'Não foi possível exportar a escala em PDF.');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const fileName = response.headers
        .get('Content-Disposition')
        ?.match(/filename="(.+)"/)?.[1] || `escala-${monthParam}.pdf`;

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success('Escala mensal exportada em PDF.');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Falha ao exportar a escala mensal.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleDateClick = (arg: any) => {
    if (!canManageShifts) {
      return;
    }
    if (!viewingTeamId) {
      toast.warning('Por favor, selecione uma equipe antes de adicionar um plantão.');
      return;
    }
    setSelectedDate(arg.dateStr);
    
    setSelectedPhysioId('');

    setSelectedPeriod('MORNING');
    setSelectedSlotId('');
    setRecurrenceEnabled(false);
    setRecurrenceEndDate(arg.dateStr);
    setRecurrenceWeekdays([arg.date.getDay()]);
    setShowAddModal(true);
  };

  const handleEventClick = (clickInfo: any) => {
    setSelectedEvent(clickInfo.event);
    setSelectedDate(clickInfo.event.startStr);
    setSelectedPhysioId(clickInfo.event.extendedProps.physioId.toString());
    setSelectedPeriod(clickInfo.event.extendedProps.period);
    setSelectedSlotId(String(clickInfo.event.extendedProps.slotId ?? ''));
    setEditScope('THIS');
    setDeleteScope('THIS');
    setSeriesEndDate(
      clickInfo.event.extendedProps.seriesEndDate
        ? new Date(clickInfo.event.extendedProps.seriesEndDate).toISOString().split('T')[0]
        : clickInfo.event.startStr
    );
    setSeriesWeekdays(clickInfo.event.extendedProps.seriesWeekdays ?? []);
    setShowEditModal(true);
  };

  const handleSaveShift = async () => {
    if (!canManageShifts) {
      toast.error('A criação de plantões é exclusiva da gestão.');
      return;
    }
    if (!selectedPhysioId || !selectedDate || !viewingTeamId || !selectedSlotId) {
      toast.warning('Por favor, preencha todos os campos.');
      return;
    }
    if (recurrenceEnabled && !recurrenceEndDate) {
      toast.warning('Informe a data final da recorrência.');
      return;
    }
    if (recurrenceEnabled && recurrenceWeekdays.length === 0) {
      toast.warning('Selecione ao menos um dia da semana para a recorrência.');
      return;
    }

    try {
      const currentCalendarDate = calendarRef.current?.getApi().getDate();
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          period: selectedPeriod,
          physiotherapistId: parseInt(selectedPhysioId),
          shiftTeamId: parseInt(viewingTeamId),
          shiftTeamSlotId: parseInt(selectedSlotId),
          recurrence: recurrenceEnabled
            ? {
                frequency: recurrenceWeekdays.length === 1 ? 'WEEKLY' : 'CUSTOM_WEEKLY',
                untilDate: recurrenceEndDate,
                weekdays: recurrenceWeekdays,
              }
            : undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Falha ao salvar o plantão');
      }

      await refreshVisibleCalendar(currentCalendarDate);
      handleCloseModal();
      toast.success(json.message || 'Plantão criado com sucesso');

      if (json.summary?.mode === 'RECURRING' && json.summary?.skipped?.length > 0) {
        toast.warning(
          `${json.summary.skipped.length} ocorrência(s) foram puladas por conflito, indisponibilidade ou falta de vaga.`
        );
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    }
  };

  const handleUpdateShift = async () => {
    const usingSeriesScope = selectedEventBelongsToSeries ? editScope : 'THIS';
    if (!selectedEvent) return;
    if (!canManageSelectedEvent) {
      toast.error('A alteração de plantões é exclusiva da gestão.');
      return;
    }
    if (!selectedPhysioId || !selectedSlotId) {
      toast.warning('Selecione o fisioterapeuta e a vaga para continuar.');
      return;
    }
    if (usingSeriesScope !== 'THIS' && !seriesEndDate) {
      toast.warning('Informe a data final da série.');
      return;
    }
    if (usingSeriesScope !== 'THIS' && seriesWeekdays.length === 0) {
      toast.warning('Selecione ao menos um dia da semana para a série.');
      return;
    }

    try {
      const currentCalendarDate = calendarRef.current?.getApi().getDate();
      const response = await fetch(`/api/shifts/${selectedEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physiotherapistId: parseInt(selectedPhysioId),
          period: selectedPeriod,
          shiftTeamSlotId: parseInt(selectedSlotId),
          scope: usingSeriesScope,
          recurrence:
            usingSeriesScope !== 'THIS'
              ? {
                  endDate: seriesEndDate,
                  weekdays: seriesWeekdays,
                }
              : undefined,
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Falha ao atualizar o plantão');

      await refreshVisibleCalendar(currentCalendarDate);
      handleCloseEditModal();

      if (json.summary?.skipped?.length > 0) {
        toast.warning(
          `${json.summary.skipped.length} ocorrência(s) não puderam ser sincronizadas automaticamente e ficaram como exceção.`
        );
      }

      toast.success(json.message || 'Plantão atualizado com sucesso');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Não foi possível atualizar o plantão.');
    }
  };

  const handleDeleteShift = async () => {
    if (!canManageSelectedEvent) {
      toast.error('A exclusão de plantões é exclusiva da gestão.');
      return;
    }
    if (!selectedEvent) return;

    const deleteLabel =
      selectedEventBelongsToSeries && deleteScope === 'ALL'
        ? 'a série inteira'
        : selectedEventBelongsToSeries && deleteScope === 'THIS_AND_FUTURE'
          ? 'este plantão e os próximos da série'
          : `o plantão de ${selectedEvent.title}`;

    if (confirm(`Tem certeza que deseja excluir ${deleteLabel}?`)) {
      try {
        const currentCalendarDate = calendarRef.current?.getApi().getDate();
        const response = await fetch(
          `/api/shifts/${selectedEvent.id}?scope=${selectedEventBelongsToSeries ? deleteScope : 'THIS'}`,
          {
            method: 'DELETE',
          }
        );
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Falha ao excluir o plantão');

        await refreshVisibleCalendar(currentCalendarDate);
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
    if (!canManageShifts || !event.extendedProps?.canManage) {
      revert();
      toast.error('A movimentação de plantões é exclusiva da gestão.');
      return;
    }
    
    // Salvar a data atual do calendário antes de recarregar
    const currentCalendarDate = calendarRef.current?.getApi().getDate();
    
    console.log('Drag and drop - salvando:', { shiftId, newDate, physioId: event.extendedProps.physioId, period: event.extendedProps.period });
    
    try {
      const response = await fetch(`/api/shifts/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newDate,
          physiotherapistId: event.extendedProps.physioId,
          period: event.extendedProps.period,
          shiftTeamSlotId: event.extendedProps.slotId,
          scope: 'THIS',
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
        await refreshVisibleCalendar(currentCalendarDate);

        // Forçar re-render do calendário para atualizar badges
        setRefreshKey(prev => prev + 1);
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

  // Calcular vagas disponíveis por data e período (incluindo todas as datas do mês)
  const availableSlots = useMemo(() => {
    if (!viewingTeamId) return {};
    
    const team = teams.find(t => t.id === parseInt(viewingTeamId));
    if (!team) return {};
    
    const slots: Record<string, Record<ShiftPeriod, { used: number; total: number; available: number }>> = {};
    
    // Inicializar todas as datas do mês atual
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const isWeekendDay = getSlotDayType(d) === 'WEEKEND';
      
      slots[dateStr] = {
        MORNING: { 
          used: 0, 
          total: isWeekendDay ? team.weekendMorningSlots : team.weekdayMorningSlots,
          available: isWeekendDay ? team.weekendMorningSlots : team.weekdayMorningSlots
        },
        INTERMEDIATE: { 
          used: 0, 
          total: isWeekendDay ? team.weekendIntermediateSlots : team.weekdayIntermediateSlots,
          available: isWeekendDay ? team.weekendIntermediateSlots : team.weekdayIntermediateSlots
        },
        AFTERNOON: { 
          used: 0, 
          total: isWeekendDay ? team.weekendAfternoonSlots : team.weekdayAfternoonSlots,
          available: isWeekendDay ? team.weekendAfternoonSlots : team.weekdayAfternoonSlots
        },
        NIGHT: { 
          used: 0, 
          total: isWeekendDay ? team.weekendNightSlots : team.weekdayNightSlots,
          available: isWeekendDay ? team.weekendNightSlots : team.weekdayNightSlots
        },
      };
    }
    
    // Contar plantões existentes
    events.forEach(event => {
      const date = event.start;
      const period = event.extendedProps?.period as ShiftPeriod;
      
      if (slots[date] && period) {
        slots[date][period].used++;
        slots[date][period].available = slots[date][period].total - slots[date][period].used;
      }
    });
    
    return slots;
  }, [events, viewingTeamId, teams, currentMonth, holidayDates]);

  // Handler para quando o calendário muda de mês
  const handleDatesSet = (dateInfo: any) => {
    // Pegar o meio do range visível para determinar o mês
    const start = new Date(dateInfo.start);
    const end = new Date(dateInfo.end);
    const middle = new Date((start.getTime() + end.getTime()) / 2);
    setCurrentMonth(middle);
  };

  const hasIntermediateSlots = () => {
    return !!activeTeam && (activeTeam.weekdayIntermediateSlots > 0 || activeTeam.weekendIntermediateSlots > 0);
  };

  function getSlotDayType(dateValue: string | Date): ShiftSlotDayType {
    const date = typeof dateValue === 'string'
      ? (() => {
          const [year, month, day] = dateValue.split('-').map(Number);
          return new Date(year, month - 1, day);
        })()
      : dateValue;
    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');

    return date.getDay() === 0 || date.getDay() === 6 || holidayDates.has(dateKey) ? 'WEEKEND' : 'WEEKDAY';
  }

  const availableSlotOptions = useMemo(() => {
    if (!activeTeamId || !selectedDate || !activeTeam) return [];

    const dayType = getSlotDayType(selectedDate);
    const occupiedSlotIds = new Set(
      events
        .filter((event) => {
          const sameDate = event.start === selectedDate;
          const samePeriod = event.extendedProps?.period === selectedPeriod;
          const sameTeam = Number(event.extendedProps?.teamId) === Number(activeTeamId);
          const differentShift = selectedEvent ? String(event.id) !== String(selectedEvent.id) : true;
          return sameDate && samePeriod && sameTeam && differentShift;
        })
        .map((event) => Number(event.extendedProps?.slotId))
    );

    return (activeTeam.shiftSlots ?? [])
      .filter((slot) => slot.isActive && slot.period === selectedPeriod && slot.dayType === dayType)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((slot) => ({
        ...slot,
        occupied: occupiedSlotIds.has(slot.id),
      }));
  }, [activeTeam, activeTeamId, events, selectedDate, selectedEvent, selectedPeriod]);

  useEffect(() => {
    if (availableSlotOptions.length === 0) {
      setSelectedSlotId('');
      return;
    }

    const currentSelectionStillValid = availableSlotOptions.some((slot) => String(slot.id) === selectedSlotId);
    if (!currentSelectionStillValid) {
      setSelectedSlotId(String(availableSlotOptions[0].id));
    }
  }, [availableSlotOptions, selectedSlotId]);

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
      .map(date => {
        // Corrigir timezone: criar Date com ano, mês, dia separados
        const [year, month, day] = date.split('-').map(Number);
        return {
          date,
          dateObj: new Date(year, month - 1, day),
          shifts: grouped[date],
        };
      });
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
          <div className="flex-1 max-w-sm space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Equipe
              </Label>
              <Select
                value={viewAllTeams ? 'all' : viewingTeamId}
                onValueChange={(value) => {
                  if (value === 'all') {
                    setViewAllTeams(true);
                    setViewingTeamId('');
                  } else {
                    setViewAllTeams(false);
                    setViewingTeamId(value);
                  }
                }}
                disabled={currentUser?.role === 'USER' && visibleTeams.length <= 1}
              >
                <SelectTrigger className="w-full h-11 bg-gray-50 border-gray-200">
                  <SelectValue placeholder="Selecione uma equipe" />
                </SelectTrigger>
                <SelectContent>
                  {currentUser?.role === 'ADMIN' && (
                    <SelectItem value="all" className="font-semibold text-indigo-600">
                      📊 Todas as Equipes (Visão Gerencial)
                    </SelectItem>
                  )}
                  {visibleTeams.map(team => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentUser?.role === 'USER' && (
                <p className="text-xs text-gray-500 mt-1.5">
                  {visibleTeams.length > 1 ? 'Selecione uma das suas equipes' : 'Visualizando sua equipe'}
                </p>
              )}
              {viewAllTeams && currentUser?.role === 'ADMIN' && (
                <p className="text-xs text-indigo-600 mt-1.5 font-medium">
                  ✓ Visualizando todas as equipes
                </p>
              )}
            </div>
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
              
              // Calcular vagas disponíveis (apenas para ADMIN)
              const daySlots = availableSlots[date];
              let totalAvailable = 0;
              let totalSlots = 0;
              if (currentUser?.role === 'ADMIN' && daySlots && !viewAllTeams) {
                totalAvailable = Object.values(daySlots).reduce((sum, slot) => sum + slot.available, 0);
                totalSlots = Object.values(daySlots).reduce((sum, slot) => sum + slot.total, 0);
              }
              const hasEmptySlots = totalAvailable > 0 && totalAvailable < totalSlots;
              const isCritical = totalAvailable > 0 && totalAvailable <= 2;
              
              return (
                <Card key={date} className={isToday ? 'border-indigo-500 border-2' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg ${isToday ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                          <span className="text-xs font-medium uppercase">{dayName}</span>
                          <span className="text-xl font-bold">{dayNumber}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 capitalize">
                            {dateObj.toLocaleDateString('pt-BR', { weekday: 'long' })}
                          </p>
                          <p className="text-sm text-gray-500 capitalize">
                            {dayNumber} de {monthName}
                          </p>
                          {/* Alerta de vagas disponíveis - ADMIN only - COMPACTO MOBILE */}
                          {currentUser?.role === 'ADMIN' && hasEmptySlots && !viewAllTeams && (
                            <div className={`mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              isCritical 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {isCritical ? '⚠️' : '⚡'} {totalAvailable} vaga{totalAvailable !== 1 ? 's' : ''}
                            </div>
                          )}
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
                          className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-98"
                          style={{ borderLeftWidth: '3px', borderLeftColor: shift.backgroundColor }}
                        >
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs"
                            style={{ backgroundColor: shift.backgroundColor }}
                          >
                            {shift.title.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{shift.title}</p>
                            <p className="text-xs text-gray-500">
                              {shift.extendedProps.periodName}
                              {shift.extendedProps.slotDescription ? ` • ${shift.extendedProps.slotDescription}` : ''}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                    
                    {/* Botão para adicionar plantão neste dia */}
                    {canManageShifts && (
                      <button
                        onClick={() => {
                          setSelectedDate(date);
                          setSelectedPhysioId('');
                          setSelectedPeriod('MORNING');
                          setSelectedSlotId('');
                          setShowAddModal(true);
                        }}
                        className="w-full mt-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                      >
                        + Adicionar plantão neste dia
                      </button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
          
          {/* Botão Flutuante para Adicionar Plantão - Mobile com Calendário */}
          {canManageShifts && (
            <button
              onClick={() => setShowMobileCalendar(true)}
              className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50"
              style={{ boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)' }}
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          
          {/* Mini Calendário Mobile para Seleção de Data */}
          {showMobileCalendar && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end" onClick={() => setShowMobileCalendar(false)}>
              <div className="bg-white w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Selecione a Data</h3>
                  <button onClick={() => setShowMobileCalendar(false)} className="text-gray-500 hover:text-gray-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Navegação de Mês */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="font-semibold capitalize">
                    {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                {/* Grid de Calendário */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const year = currentMonth.getFullYear();
                    const month = currentMonth.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const today = new Date().toISOString().split('T')[0];
                    const days = [];
                    
                    // Dias vazios antes do primeiro dia
                    for (let i = 0; i < firstDay; i++) {
                      days.push(<div key={`empty-${i}`} className="aspect-square" />);
                    }
                    
                    // Dias do mês
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(year, month, day);
                      const dateStr = date.toISOString().split('T')[0];
                      const isToday = dateStr === today;
                      const hasShifts = events.some(e => e.start.split('T')[0] === dateStr);
                      
                      days.push(
                        <button
                          key={day}
                          onClick={() => {
                            if (!canManageShifts) {
                              return;
                            }
                            setSelectedDate(dateStr);
                            setSelectedPhysioId('');
                            setSelectedPeriod('MORNING');
                            setSelectedSlotId('');
                            setShowMobileCalendar(false);
                            setShowAddModal(true);
                          }}
                          className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                            isToday
                              ? 'bg-indigo-600 text-white'
                              : hasShifts
                              ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                              : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    }
                    
                    return days;
                  })()}
                </div>
                
                {canManageShifts && (
                  <div className="mt-4 pt-4 border-t">
                    <button
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setSelectedDate(today);
                        setSelectedPhysioId('');
                        setSelectedPeriod('MORNING');
                        setSelectedSlotId('');
                        setRecurrenceEnabled(false);
                        setRecurrenceEndDate(today);
                        setRecurrenceWeekdays([new Date().getDay()]);
                        setShowMobileCalendar(false);
                        setShowAddModal(true);
                      }}
                      className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 active:bg-indigo-800"
                    >
                      Adicionar Plantão Hoje
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendário Desktop */}
      {!isMobileView && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50/80 px-4 py-3 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  Calendário mensal
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {currentMonthName}
                </p>
              </div>

              {viewingTeamId && !viewAllTeams && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportMonthlyPdf}
                  disabled={exportingPdf}
                  className="h-9 border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                >
                  {exportingPdf ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-2 h-4 w-4" />
                  )}
                  Exportar PDF
                </Button>
              )}
            </div>
          </div>

          <div className="p-4 md:p-6">
            <FullCalendar
            ref={calendarRef}
            key={`calendar-${viewingTeamId}-${viewAllTeams}-${refreshKey}`}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={currentMonth}
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
              const slotDescription = event.extendedProps?.slotDescription || '';
              
              return (
                <div 
                  className="fc-event-main-frame"
                  title={`${event.title}\n${periodName}${slotDescription ? ` • ${slotDescription}` : ''}\nEquipe: ${teamName}\nClique para visualizar`}
                >
                  <div className="fc-event-title-container">
                    <div className="fc-event-title fc-sticky">
                      {event.title}
                    </div>
                    {slotDescription && (
                      <div className="text-[10px] opacity-90 truncate">
                        {slotDescription}
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
            dayCellDidMount={(arg) => {
              if (currentUser?.role !== 'ADMIN' || viewAllTeams || !viewingTeamId) return;
              
              const team = teams.find(t => t.id === parseInt(viewingTeamId));
              if (!team) return;
              
              const dateStr = arg.date.toISOString().split('T')[0];
              const isWeekendDay = getSlotDayType(arg.date) === 'WEEKEND';
              
              // Total de vagas no dia = soma de todos os slots de todos os períodos
              const totalSlots = 
                (isWeekendDay ? team.weekendMorningSlots : team.weekdayMorningSlots) +
                (isWeekendDay ? team.weekendIntermediateSlots : team.weekdayIntermediateSlots) +
                (isWeekendDay ? team.weekendAfternoonSlots : team.weekdayAfternoonSlots) +
                (isWeekendDay ? team.weekendNightSlots : team.weekdayNightSlots);
              
              // Contar APENAS plantões DESTA EQUIPE neste dia
              const shiftsInDay = events.filter(e => 
                e.start === dateStr && 
                e.extendedProps?.teamId === parseInt(viewingTeamId)
              ).length;
              
              // Vagas disponíveis = total de vagas - plantões cadastrados
              const available = totalSlots - shiftsInDay;
              
              // Badge aparece quando: há plantões cadastrados E ainda sobram vagas
              const hasEmptySlots = shiftsInDay > 0 && available > 0 && available < totalSlots;
              const isCritical = available > 0 && available <= 2;
              
              if (hasEmptySlots) {
                const badge = document.createElement('div');
                badge.className = `vacancy-badge inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-medium ${
                  isCritical 
                    ? 'bg-red-100 text-red-700 border border-red-300' 
                    : 'bg-amber-100 text-amber-700 border border-amber-300'
                }`;
                badge.title = `${available} vaga(s) disponível(is) de ${totalSlots}\n${shiftsInDay} plantão(ões) cadastrado(s) nesta equipe`;
                badge.textContent = `${isCritical ? '⚠️' : '!'} ${available}`;
                
                const dayTop = arg.el.querySelector('.fc-daygrid-day-top');
                if (dayTop) {
                  dayTop.appendChild(badge);
                } else {
                  arg.el.style.position = 'relative';
                  arg.el.appendChild(badge);
                }
              }
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
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] p-4 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Adicionar Plantão
            </DialogTitle>
            <p className="text-sm text-gray-500">
              {selectedDate && (() => {
                const [year, month, day] = selectedDate.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                return date.toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                });
              })()}
            </p>
          </DialogHeader>
          
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-base font-medium">Período</Label>
              <Select
                value={selectedPeriod}
                onValueChange={(value) => setSelectedPeriod(value as ShiftPeriod)}
              >
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
              <Label className="text-base font-medium">Vaga / Cobertura</Label>
              <Select value={selectedSlotId} onValueChange={setSelectedSlotId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione a vaga" />
                </SelectTrigger>
                <SelectContent>
                  {availableSlotOptions.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id.toString()} className="h-12 text-base" disabled={slot.occupied}>
                      {slot.description}{slot.occupied ? ' (ocupada)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableSlotOptions.length === 0 && (
                <p className="text-sm text-amber-600">
                  Nenhuma vaga disponível para este período nesta data.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Fisioterapeuta</Label>
              <Select 
                value={selectedPhysioId} 
                onValueChange={setSelectedPhysioId}
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
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start gap-3">
                <input
                  id="recurrence-enabled"
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                  checked={recurrenceEnabled}
                  onChange={(event) => {
                    setRecurrenceEnabled(event.target.checked);
                    if (event.target.checked && !recurrenceEndDate) {
                      setRecurrenceEndDate(selectedDate);
                    }
                  }}
                />
                <div className="space-y-1">
                  <Label htmlFor="recurrence-enabled" className="text-base font-medium">
                    Criar recorrência
                  </Label>
                  <p className="text-sm text-gray-500">
                    Gera plantões em uma faixa de datas usando os dias da semana selecionados.
                  </p>
                </div>
              </div>

              {recurrenceEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="recurrence-end-date" className="text-sm font-medium">
                    Repetir até
                  </Label>
                  <input
                    id="recurrence-end-date"
                    type="date"
                    className="form-control"
                    min={selectedDate}
                    value={recurrenceEndDate}
                    onChange={(event) => setRecurrenceEndDate(event.target.value)}
                  />
                  <p className="text-sm text-gray-500">
                    O sistema tenta criar cada ocorrência na faixa e pula automaticamente datas com conflito, vaga ocupada ou indisponibilidade.
                  </p>

                  <div className="pt-2">
                    <Label className="text-sm font-medium">Dias da semana</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recurrenceWeekdayOptions.map((weekday) => {
                        const selected = recurrenceWeekdays.includes(weekday.value);

                        return (
                          <button
                            key={weekday.value}
                            type="button"
                            onClick={() =>
                              setRecurrenceWeekdays((current) =>
                                current.includes(weekday.value)
                                  ? current.filter((value) => value !== weekday.value)
                                  : [...current, weekday.value].sort((a, b) => a - b)
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                              selected
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                          >
                            {weekday.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setRecurrenceWeekdays(selectedDate ? [new Date(`${selectedDate}T12:00:00`).getDay()] : [])}
                      >
                        Apenas dia inicial
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setRecurrenceWeekdays([1, 2, 3, 4, 5])}
                      >
                        Seg a sex
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setRecurrenceWeekdays([0, 1, 2, 3, 4, 5, 6])}
                      >
                        Todos os dias
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={handleCloseModal}
              className="h-12 text-base w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveShift}
              disabled={availableSlotOptions.length === 0 || (recurrenceEnabled && !recurrenceEndDate)}
              className="h-12 text-base w-full sm:w-auto"
            >
              {recurrenceEnabled ? 'Criar Recorrência' : 'Salvar Plantão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Plantão */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] p-4 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {canManageSelectedEvent ? 'Editar Plantão' : 'Visualizar Plantão'}
            </DialogTitle>
            <p className="text-sm text-gray-500">
              {(() => {
                if (!selectedEvent?.start) return null;
                const dt = new Date(selectedEvent.start);
                return isNaN(dt.getTime())
                  ? null
                  : dt.toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    });
              })()}
            </p>
          </DialogHeader>
          
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-base font-medium">Período</Label>
              <Select
                value={selectedPeriod}
                onValueChange={(value) => setSelectedPeriod(value as ShiftPeriod)}
                disabled={!canManageSelectedEvent}
              >
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
              <Label className="text-base font-medium">Vaga / Cobertura</Label>
              <Select
                value={selectedSlotId}
                onValueChange={setSelectedSlotId}
                disabled={!canManageSelectedEvent}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione a vaga" />
                </SelectTrigger>
                <SelectContent>
                  {availableSlotOptions.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id.toString()} className="h-12 text-base" disabled={slot.occupied}>
                      {slot.description}{slot.occupied ? ' (ocupada)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Fisioterapeuta</Label>
              <Select 
                value={selectedPhysioId} 
                onValueChange={setSelectedPhysioId}
                disabled={!canManageSelectedEvent}
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
              {!canManageSelectedEvent && (
                <p className="text-sm text-gray-500">
                  Alterações e exclusões são feitas apenas pela gestão.
                </p>
              )}
            </div>
            {selectedEventBelongsToSeries && (
              <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-indigo-900">Série recorrente</p>
                  <p className="text-sm text-indigo-800">
                    Este plantão faz parte de uma série. Você pode alterar somente esta ocorrência, este ponto em diante ou a série inteira.
                  </p>
                  {selectedEvent?.extendedProps?.isSeriesException && (
                    <p className="text-sm text-amber-700">
                      Esta ocorrência já está marcada como exceção da série.
                    </p>
                  )}
                </div>

                {canManageSelectedEvent && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Aplicar alteração em</Label>
                    <Select
                      value={editScope}
                      onValueChange={(value) => setEditScope(value as "THIS" | "THIS_AND_FUTURE" | "ALL")}
                    >
                      <SelectTrigger className="h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesScopeOptions.map((option) => (
                          <SelectItem key={`edit-${option.value}`} value={option.value} className="text-sm">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-indigo-700">
                      Use <strong>Somente este plantão</strong> para criar uma exceção pontual. Os outros modos atualizam a série recorrente.
                    </p>
                  </div>
                )}

                {editScope !== "THIS" && (
                  <div className="space-y-4 rounded-lg border border-white/80 bg-white p-3">
                    <div className="space-y-2">
                      <Label htmlFor="series-end-date" className="text-sm font-medium">
                        Data final da série
                      </Label>
                      <input
                        id="series-end-date"
                        type="date"
                        className="form-control"
                        min={selectedDate}
                        value={seriesEndDate}
                        onChange={(event) => setSeriesEndDate(event.target.value)}
                        disabled={!canManageSelectedEvent}
                      />
                      <p className="text-xs text-gray-500">
                        Se você encurtar a data final, as ocorrências posteriores deixam de fazer parte da série.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Dias da semana da série</Label>
                      <div className="flex flex-wrap gap-2">
                        {recurrenceWeekdayOptions.map((weekday) => {
                          const selected = seriesWeekdays.includes(weekday.value);

                          return (
                            <button
                              key={`series-${weekday.value}`}
                              type="button"
                              onClick={() =>
                                setSeriesWeekdays((current) =>
                                  current.includes(weekday.value)
                                    ? current.filter((value) => value !== weekday.value)
                                    : [...current, weekday.value].sort((a, b) => a - b)
                                )
                              }
                              disabled={!canManageSelectedEvent}
                              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                                selected
                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                  : "border-gray-300 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-600"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              {weekday.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setSeriesWeekdays(selectedDate ? [new Date(`${selectedDate}T12:00:00`).getDay()] : [])}
                          disabled={!canManageSelectedEvent}
                        >
                          Apenas dia inicial
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setSeriesWeekdays([1, 2, 3, 4, 5])}
                          disabled={!canManageSelectedEvent}
                        >
                          Seg a sex
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setSeriesWeekdays([0, 1, 2, 3, 4, 5, 6])}
                          disabled={!canManageSelectedEvent}
                        >
                          Todos os dias
                        </button>
                      </div>

                      <p className="text-xs text-gray-500">
                        Os dias selecionados definem quais datas a série mantém ou recria dentro do intervalo informado.
                      </p>
                    </div>
                  </div>
                )}

                {canManageSelectedEvent && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Excluir em</Label>
                    <Select
                      value={deleteScope}
                      onValueChange={(value) => setDeleteScope(value as "THIS" | "THIS_AND_FUTURE" | "ALL")}
                    >
                      <SelectTrigger className="h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesScopeOptions.map((option) => (
                          <SelectItem key={`delete-${option.value}`} value={option.value} className="text-sm">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-indigo-700">
                      Para exclusões em lote, o sistema considera o mesmo escopo escolhido aqui e preserva o restante da série.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              {canManageSelectedEvent && (
                <Button 
                  onClick={handleUpdateShift}
                  disabled={!canManageSelectedEvent}
                  className="h-auto min-h-11 text-sm w-full whitespace-normal break-words px-3 py-3 text-center sm:flex-1"
                >
                  ✓ Salvar Alterações
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => {
                  if (selectedEvent?.id) {
                    window.location.href = `/swap-board?shiftId=${selectedEvent.id}`;
                  }
                }}
                disabled={!canRequestSwapSelectedEvent}
                className="h-auto min-h-11 text-sm w-full whitespace-normal break-words px-3 py-3 text-center sm:flex-1"
              >
                🔄 Solicitar Troca
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={handleCloseEditModal}
                className="h-auto min-h-11 text-sm w-full whitespace-normal break-words px-3 py-3 text-center sm:flex-1 sm:w-auto sm:flex-none"
              >
                Cancelar
              </Button>
              {canManageSelectedEvent && (
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteShift}
                  disabled={!canManageSelectedEvent}
                  className="h-auto min-h-11 text-sm w-full whitespace-normal break-words px-3 py-3 text-center sm:flex-1 sm:w-auto sm:flex-none"
                >
                  🗑️ Excluir
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
