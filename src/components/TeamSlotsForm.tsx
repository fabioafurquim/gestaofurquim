'use client';

import { ShiftPeriod, ShiftSlotDayType } from '@prisma/client';

import {
  SHIFT_PERIOD_LABELS,
  SHIFT_SLOT_DAY_TYPE_LABELS,
  SHIFT_PERIODS,
  SHIFT_SLOT_DAY_TYPES,
  type TeamSlotPayload,
} from '@/lib/shift-team-slots';

interface TeamSlotsFormProps {
  value: TeamSlotPayload;
  onChange: (value: TeamSlotPayload) => void;
}

export default function TeamSlotsForm({ value, onChange }: TeamSlotsFormProps) {
  const updateDescription = (dayType: ShiftSlotDayType, period: ShiftPeriod, index: number, description: string) => {
    const nextValue: TeamSlotPayload = {
      WEEKDAY: {
        MORNING: [...value.WEEKDAY.MORNING],
        INTERMEDIATE: [...value.WEEKDAY.INTERMEDIATE],
        AFTERNOON: [...value.WEEKDAY.AFTERNOON],
        NIGHT: [...value.WEEKDAY.NIGHT],
      },
      WEEKEND: {
        MORNING: [...value.WEEKEND.MORNING],
        INTERMEDIATE: [...value.WEEKEND.INTERMEDIATE],
        AFTERNOON: [...value.WEEKEND.AFTERNOON],
        NIGHT: [...value.WEEKEND.NIGHT],
      },
    };

    nextValue[dayType][period][index] = description;
    onChange(nextValue);
  };

  const addSlot = (dayType: ShiftSlotDayType, period: ShiftPeriod) => {
    const nextValue = cloneValue(value);
    nextValue[dayType][period].push('');
    onChange(nextValue);
  };

  const removeSlot = (dayType: ShiftSlotDayType, period: ShiftPeriod, index: number) => {
    const nextValue = cloneValue(value);
    nextValue[dayType][period].splice(index, 1);
    onChange(nextValue);
  };

  return (
    <div className="space-y-4">
      {SHIFT_SLOT_DAY_TYPES.map((dayType) => (
        <div key={dayType} className="card mb-3">
          <div className="card-header">
            <h5 className="card-title mb-1">{SHIFT_SLOT_DAY_TYPE_LABELS[dayType]}</h5>
            <small className="text-muted">
              Cadastre cada vaga com a descrição da ala, setor ou cobertura atendida.
            </small>
          </div>

          <div className="card-body space-y-4">
            {SHIFT_PERIODS.map((period) => (
              <div key={`${dayType}-${period}`} className="rounded border p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="mb-0">{SHIFT_PERIOD_LABELS[period]}</h6>
                    <small className="text-muted">
                      {value[dayType][period].length} vaga(s) configurada(s)
                    </small>
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => addSlot(dayType, period)}
                  >
                    Adicionar vaga
                  </button>
                </div>

                {value[dayType][period].length === 0 ? (
                  <div className="rounded bg-light p-3 text-muted">
                    Nenhuma vaga cadastrada para este período.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {value[dayType][period].map((description, index) => (
                      <div key={`${dayType}-${period}-${index}`} className="d-flex gap-2 align-items-start mb-2">
                        <div className="flex-grow-1">
                          <label className="form-label small text-muted mb-1">
                            Vaga {index + 1}
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            value={description}
                            onChange={(event) => updateDescription(dayType, period, index, event.target.value)}
                            placeholder="Ex.: Ala 300, UTI 2, Sala amarela"
                          />
                        </div>

                        <button
                          type="button"
                          className="btn btn-outline-danger mt-4"
                          onClick={() => removeSlot(dayType, period, index)}
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function cloneValue(value: TeamSlotPayload): TeamSlotPayload {
  return {
    WEEKDAY: {
      MORNING: [...value.WEEKDAY.MORNING],
      INTERMEDIATE: [...value.WEEKDAY.INTERMEDIATE],
      AFTERNOON: [...value.WEEKDAY.AFTERNOON],
      NIGHT: [...value.WEEKDAY.NIGHT],
    },
    WEEKEND: {
      MORNING: [...value.WEEKEND.MORNING],
      INTERMEDIATE: [...value.WEEKEND.INTERMEDIATE],
      AFTERNOON: [...value.WEEKEND.AFTERNOON],
      NIGHT: [...value.WEEKEND.NIGHT],
    },
  };
}
