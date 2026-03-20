-- CreateEnum
CREATE TYPE "public"."ShiftSlotDayType" AS ENUM ('WEEKDAY', 'WEEKEND');

-- CreateTable
CREATE TABLE "public"."ShiftTeamSlot" (
    "id" SERIAL NOT NULL,
    "shiftTeamId" INTEGER NOT NULL,
    "period" "public"."ShiftPeriod" NOT NULL,
    "dayType" "public"."ShiftSlotDayType" NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftTeamSlot_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."Shift" ADD COLUMN "shiftTeamSlotId" INTEGER;

-- Seed slots from current team configuration, guaranteeing enough slots for existing shifts.
WITH usage_counts AS (
    SELECT
        s."shiftTeamId",
        CASE
            WHEN EXTRACT(DOW FROM CAST(s."date" AS date)) IN (0, 6)
                OR EXISTS (
                    SELECT 1
                    FROM "public"."Holiday" h
                    WHERE h."date" = CAST(s."date" AS date)
                )
            THEN 'WEEKEND'
            ELSE 'WEEKDAY'
        END AS day_type,
        s."period",
        COUNT(*) AS shifts_in_day
    FROM "public"."Shift" s
    GROUP BY
        s."shiftTeamId",
        CAST(s."date" AS date),
        s."period",
        day_type
),
required_slots AS (
    SELECT
        st."id" AS shift_team_id,
        v.day_type::"public"."ShiftSlotDayType" AS day_type,
        v.period::"public"."ShiftPeriod" AS period,
        GREATEST(v.configured_slots, COALESCE(MAX(uc.shifts_in_day), 0)) AS slot_count
    FROM "public"."ShiftTeam" st
    CROSS JOIN LATERAL (
        VALUES
            ('WEEKDAY', 'MORNING', st."weekdayMorningSlots"),
            ('WEEKDAY', 'INTERMEDIATE', st."weekdayIntermediateSlots"),
            ('WEEKDAY', 'AFTERNOON', st."weekdayAfternoonSlots"),
            ('WEEKDAY', 'NIGHT', st."weekdayNightSlots"),
            ('WEEKEND', 'MORNING', st."weekendMorningSlots"),
            ('WEEKEND', 'INTERMEDIATE', st."weekendIntermediateSlots"),
            ('WEEKEND', 'AFTERNOON', st."weekendAfternoonSlots"),
            ('WEEKEND', 'NIGHT', st."weekendNightSlots")
    ) AS v(day_type, period, configured_slots)
    LEFT JOIN usage_counts uc
        ON uc."shiftTeamId" = st."id"
       AND uc.day_type = v.day_type
       AND uc."period" = v.period::"public"."ShiftPeriod"
    GROUP BY
        st."id",
        v.day_type,
        v.period,
        v.configured_slots
)
INSERT INTO "public"."ShiftTeamSlot" (
    "shiftTeamId",
    "period",
    "dayType",
    "description",
    "sortOrder",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    rs.shift_team_id,
    rs.period,
    rs.day_type,
    CASE rs.period
        WHEN 'MORNING' THEN 'Manhã '
        WHEN 'INTERMEDIATE' THEN 'Intermediário '
        WHEN 'AFTERNOON' THEN 'Tarde '
        WHEN 'NIGHT' THEN 'Noite '
    END || gs::text,
    gs,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM required_slots rs
CROSS JOIN LATERAL generate_series(1, rs.slot_count) AS gs
WHERE rs.slot_count > 0;

-- Backfill existing shifts into the generated slots.
WITH ranked_shifts AS (
    SELECT
        s."id",
        s."shiftTeamId",
        s."period",
        CASE
            WHEN EXTRACT(DOW FROM CAST(s."date" AS date)) IN (0, 6)
                OR EXISTS (
                    SELECT 1
                    FROM "public"."Holiday" h
                    WHERE h."date" = CAST(s."date" AS date)
                )
            THEN 'WEEKEND'
            ELSE 'WEEKDAY'
        END::"public"."ShiftSlotDayType" AS day_type,
        ROW_NUMBER() OVER (
            PARTITION BY s."shiftTeamId", CAST(s."date" AS date), s."period"
            ORDER BY s."createdAt", s."id"
        ) AS slot_order
    FROM "public"."Shift" s
),
slot_match AS (
    SELECT
        rs."id" AS shift_id,
        sts."id" AS slot_id
    FROM ranked_shifts rs
    INNER JOIN "public"."ShiftTeamSlot" sts
        ON sts."shiftTeamId" = rs."shiftTeamId"
       AND sts."period" = rs."period"
       AND sts."dayType" = rs.day_type
       AND sts."sortOrder" = rs.slot_order
)
UPDATE "public"."Shift" s
SET "shiftTeamSlotId" = sm.slot_id
FROM slot_match sm
WHERE s."id" = sm.shift_id;

-- Final constraints and indexes.
ALTER TABLE "public"."Shift"
    ALTER COLUMN "shiftTeamSlotId" SET NOT NULL;

CREATE UNIQUE INDEX "ShiftTeamSlot_shiftTeamId_period_dayType_sortOrder_key"
ON "public"."ShiftTeamSlot"("shiftTeamId", "period", "dayType", "sortOrder");

CREATE INDEX "ShiftTeamSlot_shiftTeamId_dayType_period_isActive_sortOrder_idx"
ON "public"."ShiftTeamSlot"("shiftTeamId", "dayType", "period", "isActive", "sortOrder");

CREATE UNIQUE INDEX "Shift_date_shiftTeamSlotId_key"
ON "public"."Shift"("date", "shiftTeamSlotId");

ALTER TABLE "public"."ShiftTeamSlot"
    ADD CONSTRAINT "ShiftTeamSlot_shiftTeamId_fkey"
    FOREIGN KEY ("shiftTeamId") REFERENCES "public"."ShiftTeam"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."Shift"
    ADD CONSTRAINT "Shift_shiftTeamSlotId_fkey"
    FOREIGN KEY ("shiftTeamSlotId") REFERENCES "public"."ShiftTeamSlot"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
