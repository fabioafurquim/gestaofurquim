-- CreateTable
CREATE TABLE "public"."UserAccessLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userRole" "public"."UserRole" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "loggedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccessLog_loggedInAt_idx" ON "public"."UserAccessLog"("loggedInAt");

-- CreateIndex
CREATE INDEX "UserAccessLog_userId_loggedInAt_idx" ON "public"."UserAccessLog"("userId", "loggedInAt");

-- CreateIndex
CREATE INDEX "UserAccessLog_userEmail_loggedInAt_idx" ON "public"."UserAccessLog"("userEmail", "loggedInAt");

-- AddForeignKey
ALTER TABLE "public"."UserAccessLog" ADD CONSTRAINT "UserAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
