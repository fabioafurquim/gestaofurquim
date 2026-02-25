'use client';

import { useState, useEffect } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, Calendar } from 'lucide-react';
import { formatDateForDisplay } from '@/lib/date-utils';
import { toast } from 'sonner';

interface Holiday {
  id: number;
  date: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface HolidayFormData {
  date: string;
  name: string;
  description: string;
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState<HolidayFormData>({
    date: '',
    name: '',
    description: ''
  });

  // Carrega os feriados
  const loadHolidays = async () => {
    try {
      const response = await fetch('/api/holidays');
      if (response.ok) {
        const data = await response.json();
        setHolidays(data);
      } else {
        toast.error('Erro ao carregar feriados');
      }
    } catch (error) {
      console.error('Erro ao carregar feriados:', error);
      toast.error('Erro ao carregar feriados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  // Reseta o formulário
  const resetForm = () => {
    setFormData({
      date: '',
      name: '',
      description: ''
    });
    setEditingHoliday(null);
  };

  // Abre o diálogo para criar novo feriado
  const handleNewHoliday = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Abre o diálogo para editar feriado
  const handleEditHoliday = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      date: holiday.date.split('T')[0], // Converte para formato YYYY-MM-DD
      name: holiday.name,
      description: holiday.description || ''
    });
    setIsDialogOpen(true);
  };

  // Salva o feriado (criar ou editar)
  const handleSaveHoliday = async () => {
    if (!formData.date || !formData.name) {
      toast.error('Data e nome são obrigatórios');
      return;
    }

    try {
      // Se não está editando, valida antes de criar
      if (!editingHoliday) {
        // Primeiro, valida se há conflitos
        const validateResponse = await fetch('/api/holidays/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!validateResponse.ok) {
          toast.error('Erro ao validar feriado');
          return;
        }

        const validation = await validateResponse.json();

        // Se há conflito com plantões existentes, pede confirmação
        if (validation.conflict && validation.type === 'shifts_exist') {
          const confirmMessage = `${validation.message}\n\n${validation.warning}\n\nDeseja continuar mesmo assim?`;
          if (!confirm(confirmMessage)) {
            return;
          }
        }

        // Se há conflito com feriado existente, bloqueia
        if (validation.conflict && validation.type === 'holiday_exists') {
          toast.error(validation.message);
          return;
        }

        // Se é fim de semana, mostra aviso mas permite continuar
        if (validation.warning && validation.type === 'weekend_redundant') {
          if (!confirm(`${validation.warning}\n\nDeseja continuar?`)) {
            return;
          }
        }
      }

      const url = editingHoliday 
        ? `/api/holidays/${editingHoliday.id}`
        : '/api/holidays';
      
      const method = editingHoliday ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingHoliday ? 'Feriado atualizado com sucesso!' : 'Feriado cadastrado com sucesso!');
        setIsDialogOpen(false);
        resetForm();
        loadHolidays();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao salvar feriado');
      }
    } catch (error) {
      console.error('Erro ao salvar feriado:', error);
      toast.error('Erro ao salvar feriado');
    }
  };

  // Abre o modal de confirmação para exclusão
  const handleDeleteHoliday = (holiday: Holiday) => {
    setConfirmDelete(holiday);
  };

  // Executa a exclusão após confirmação
  const confirmDeleteHoliday = async () => {
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/holidays/${confirmDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Feriado excluído com sucesso!');
        loadHolidays();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao excluir feriado');
      }
    } catch (error) {
      console.error('Erro ao excluir feriado:', error);
      toast.error('Erro ao excluir feriado');
    } finally {
      setConfirmDelete(null);
    }
  };

  // Cancela a exclusão
  const cancelDelete = () => {
    setConfirmDelete(null);
  };

  // Formata a data para exibição usando a função que evita problemas de timezone
  const formatDate = (dateString: string) => {
    return formatDateForDisplay(dateString);
  };

  if (loading) {
    return (
      <AuthLayout title="Feriados">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando feriados...</div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Feriados">
      <div className="mb-6">
        <p className="text-gray-600">Gerencie os feriados do sistema</p>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Cadastro de Feriados</h1>
          <p className="text-muted-foreground">
            Gerencie os feriados que afetam a escala de plantões
          </p>
        </div>
        <Button onClick={handleNewHoliday}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Feriado
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Feriados Cadastrados
          </CardTitle>
          <CardDescription>
            {holidays.length} feriado(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum feriado cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Cadastre feriados para que sejam considerados na escala de plantões
              </p>
              <Button onClick={handleNewHoliday}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Primeiro Feriado
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">
                      {formatDate(holiday.date)}
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell>{holiday.description || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditHoliday(holiday)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteHoliday(holiday)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para criar/editar feriado */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? 'Editar Feriado' : 'Novo Feriado'}
            </DialogTitle>
            <DialogDescription>
              {editingHoliday 
                ? 'Edite as informações do feriado'
                : 'Cadastre um novo feriado que afetará a escala de plantões'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                disabled={!!editingHoliday} // Não permite alterar a data ao editar
              />
              {formData.date && (
                <p className="text-sm text-muted-foreground">
                  Data selecionada: {formatDateForDisplay(formData.date)}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Ex: Natal, Ano Novo, etc."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descrição opcional do feriado"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveHoliday}>
              {editingHoliday ? 'Salvar Alterações' : 'Cadastrar Feriado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o feriado "{confirmDelete?.name}"?
              <br />
              <strong>Esta ação não pode ser desfeita.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteHoliday}>
              Excluir Feriado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthLayout>
  );
}