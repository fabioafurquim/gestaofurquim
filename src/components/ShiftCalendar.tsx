'use client';

import { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import { ShiftTeam, ShiftPeriod } from '@prisma/client';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
// Removido import getCurrentUser - agora usamos API route

const periodColor: Record<ShiftPeriod, string> = {
  MORNING: '#0d6efd', // azul
  INTERMEDIATE: '#6f42c1', // roxo sutil para intermediário
  AFTERNOON: '#198754', // verde
  NIGHT: '#dc3545', // vermelho
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
      alert('Por favor, selecione uma equipe antes de adicionar um plantão.');
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
      alert("Por favor, preencha todos os campos.");
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
      alert(json.message || 'Plantão criado com sucesso');
    } catch (error: any) {
      console.error(error);
      alert(error.message);
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
      alert(json.message || 'Plantão atualizado com sucesso');
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Não foi possível atualizar o plantão.');
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
        alert(json.message || 'Plantão excluído com sucesso');
      } catch (error: any) {
        console.error(error);
        alert(error.message || 'Não foi possível excluir o plantão.');
      }
    }
  };

  const handleEventDrop = (dropInfo: any) => console.log('Event dropped:', dropInfo);
  const handleEventReceive = (info: any) => console.log('Event received:', info);
  const handleEventRemove = (info: any) => console.log('Event removed:', info);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Row className="mb-4 align-items-center">
        <Col md={4}>
          <Form.Group>
            <Form.Label className="fw-bold">Selecione a Equipe</Form.Label>
            <Form.Select 
              value={viewingTeamId} 
              onChange={(e) => setViewingTeamId(e.target.value)}
              disabled={currentUser?.role === 'USER'}
            >
              <option value="">-- Visualizar Equipe --</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </Form.Select>
            {currentUser?.role === 'USER' && (
              <Form.Text className="text-muted">
                Você está visualizando sua equipe
              </Form.Text>
            )}
          </Form.Group>
        </Col>
      </Row>

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

      {/* Add Shift Modal */}
      <Modal show={showAddModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Adicionar Plantão - {selectedDate}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Período</Form.Label>
              <Form.Select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value as ShiftPeriod)}>
                <option value={ShiftPeriod.MORNING}>Manhã</option>
                {(() => {
                  const team = teams.find(t => t.id === Number(viewingTeamId));
                  if (team && (team as any).intermediateSlots > 0) {
                    return <option value={ShiftPeriod.INTERMEDIATE}>Intermediário</option>;
                  }
                  return null;
                })()}
                <option value={ShiftPeriod.AFTERNOON}>Tarde</option>
                <option value={ShiftPeriod.NIGHT}>Noite</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Fisioterapeuta</Form.Label>
              <Form.Select 
                value={selectedPhysioId} 
                onChange={(e) => setSelectedPhysioId(e.target.value)}
                disabled={currentUser?.role === 'USER'}
              >
                <option value="">Selecione um fisioterapeuta</option>
                {availablePhysios.map(physio => (
                  <option key={physio.id} value={physio.id}>{physio.name}</option>
                ))}
              </Form.Select>
              {currentUser?.role === 'USER' && (
                <Form.Text className="text-muted">
                  Você só pode criar plantões para si mesmo
                </Form.Text>
              )}
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>Fechar</Button>
          <Button variant="primary" onClick={handleSaveShift}>Salvar Plantão</Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Shift Modal */}
      {selectedEvent && (
        <Modal show={showEditModal} onHide={handleCloseEditModal} centered>
          <Modal.Header closeButton>
            <Modal.Title>Editar Plantão - {new Date(selectedEvent.start).toLocaleDateString()}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Período</Form.Label>
                <Form.Select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value as ShiftPeriod)}>
                  <option value={ShiftPeriod.MORNING}>Manhã</option>
                  {(() => {
                    const team = teams.find(t => t.id === Number(viewingTeamId));
                    if (team && (team as any).intermediateSlots > 0) {
                      return <option value={ShiftPeriod.INTERMEDIATE}>Intermediário</option>;
                    }
                    return null;
                  })()}
                  <option value={ShiftPeriod.AFTERNOON}>Tarde</option>
                  <option value={ShiftPeriod.NIGHT}>Noite</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Fisioterapeuta</Form.Label>
                <Form.Select 
                  value={selectedPhysioId} 
                  onChange={(e) => setSelectedPhysioId(e.target.value)}
                  disabled={currentUser?.role === 'USER'}
                >
                  <option value="">Selecione um fisioterapeuta</option>
                  {availablePhysios.map(physio => (
                    <option key={physio.id} value={physio.id}>{physio.name}</option>
                  ))}
                </Form.Select>
                {currentUser?.role === 'USER' && (
                  <Form.Text className="text-muted">
                    Você só pode editar seus próprios plantões
                  </Form.Text>
                )}
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="danger" onClick={handleDeleteShift}>Excluir</Button>
            <Button variant="secondary" onClick={handleCloseEditModal}>Fechar</Button>
            <Button variant="primary" onClick={handleUpdateShift}>Salvar Alterações</Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}