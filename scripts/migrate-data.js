const { PrismaClient } = require('@prisma/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Cliente PostgreSQL (destino)
const prismaPostgres = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Função para conectar ao SQLite (origem)
function connectSQLite() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('✅ Conectado ao SQLite');
        resolve(db);
      }
    });
  });
}

// Função para executar query no SQLite
function sqliteQuery(db, query) {
  return new Promise((resolve, reject) => {
    db.all(query, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function migrateData() {
  let sqliteDb;
  
  try {
    console.log('🚀 Iniciando migração de dados do SQLite para PostgreSQL...');
    
    // Conectar ao SQLite
    sqliteDb = await connectSQLite();
    
    // Migrar ShiftTeams
    console.log('📋 Migrando ShiftTeams...');
    const shiftTeams = await sqliteQuery(sqliteDb, 'SELECT * FROM ShiftTeam ORDER BY id');
    for (const team of shiftTeams) {
      await prismaPostgres.shiftTeam.create({
        data: {
          id: team.id,
          name: team.name,
          description: team.description,
          createdAt: new Date(team.createdAt),
          updatedAt: new Date(team.updatedAt)
        }
      });
    }
    console.log(`✅ ${shiftTeams.length} ShiftTeams migrados`);
    
    // Migrar Physiotherapists
    console.log('👨‍⚕️ Migrando Physiotherapists...');
    const physiotherapists = await sqliteQuery(sqliteDb, 'SELECT * FROM Physiotherapist ORDER BY id');
    for (const physio of physiotherapists) {
      await prismaPostgres.physiotherapist.create({
        data: {
          id: physio.id,
          name: physio.name,
          email: physio.email || `physio${physio.id}@plantaofisio.com`, // Email padrão se não existir
          crefito: physio.crefito,
          cpf: physio.cpf || `000.000.000-${String(physio.id).padStart(2, '0')}`, // CPF padrão se não existir
          startDate: physio.startDate ? new Date(physio.startDate) : new Date(), // Data de início padrão
          status: physio.contractStatus || 'ACTIVE',
          contractType: physio.contractType,
          phone: physio.phone || null,
          rg: physio.rg || null,
          birthDate: physio.birthDate ? new Date(physio.birthDate) : null,
          address: physio.address || null,
          exitDate: physio.exitDate ? new Date(physio.exitDate) : null,
          shiftValue: physio.shiftValue || 0,
          additionalValue: physio.additionalValue || 0,
          shiftTeamId: physio.shiftTeamId || null,
          createdAt: new Date(physio.createdAt),
          updatedAt: new Date(physio.updatedAt)
        }
      });
    }
    console.log(`✅ ${physiotherapists.length} Physiotherapists migrados`);
    
    // Migrar Users
    console.log('👤 Migrando Users...');
    const users = await sqliteQuery(sqliteDb, 'SELECT * FROM User ORDER BY id');
    for (const user of users) {
      await prismaPostgres.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          password: user.password,
          role: user.role,
          isFirstLogin: Boolean(user.isFirstLogin),
          mustChangePassword: Boolean(user.mustChangePassword),
          physiotherapistId: user.physiotherapistId,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
          createdBy: user.createdBy
        }
      });
    }
    console.log(`✅ ${users.length} Users migrados`);
    
    // Migrar Shifts
    console.log('📅 Migrando Shifts...');
    const shifts = await sqliteQuery(sqliteDb, 'SELECT * FROM Shift ORDER BY id');
    for (const shift of shifts) {
      await prismaPostgres.shift.create({
        data: {
          id: shift.id,
          date: new Date(shift.date),
          period: shift.period,
          physiotherapistId: shift.physiotherapistId,
          shiftTeamId: shift.shiftTeamId,
          createdAt: new Date(shift.createdAt),
          updatedAt: new Date(shift.updatedAt)
        }
      });
    }
    console.log(`✅ ${shifts.length} Shifts migrados`);
    
    // Atualizar sequências do PostgreSQL
    console.log('🔄 Atualizando sequências do PostgreSQL...');
    
    if (shiftTeams.length > 0) {
      const maxShiftTeamId = Math.max(...shiftTeams.map(t => t.id));
      await prismaPostgres.$executeRaw`SELECT setval('"ShiftTeam_id_seq"', ${maxShiftTeamId}, true)`;
    }
    
    if (physiotherapists.length > 0) {
      const maxPhysioId = Math.max(...physiotherapists.map(p => p.id));
      await prismaPostgres.$executeRaw`SELECT setval('"Physiotherapist_id_seq"', ${maxPhysioId}, true)`;
    }
    
    if (users.length > 0) {
      const maxUserId = Math.max(...users.map(u => u.id));
      await prismaPostgres.$executeRaw`SELECT setval('"User_id_seq"', ${maxUserId}, true)`;
    }
    
    if (shifts.length > 0) {
      const maxShiftId = Math.max(...shifts.map(s => s.id));
      await prismaPostgres.$executeRaw`SELECT setval('"Shift_id_seq"', ${maxShiftId}, true)`;
    }
    
    console.log('✅ Sequências atualizadas');
    console.log('🎉 Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    throw error;
  } finally {
    // Fechar conexões
    if (sqliteDb) {
      sqliteDb.close();
      console.log('🔒 Conexão SQLite fechada');
    }
    await prismaPostgres.$disconnect();
    console.log('🔒 Conexão PostgreSQL fechada');
  }
}

// Executar migração
if (require.main === module) {
  migrateData()
    .then(() => {
      console.log('✅ Script de migração finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha na migração:', error);
      process.exit(1);
    });
}

module.exports = { migrateData };