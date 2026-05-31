import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import authRoutes from './auth';
import adminStationRoutes from './stations';
import adminImageRoutes from './images';
import adminBulkRoutes from './bulk';
import adminOpsRoutes from './ops';
import adminStatsRoutes from './stats';
import adminAuditRoutes from './audit';
import adminImportExportRoutes from './importExport';

/**
 * Admin API, mounted at /admin/api. `auth` endpoints are public (login/logout);
 * everything else sits behind an onRequest auth gate in an encapsulated child.
 */
export default async function adminRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB logos

  // Public: login / logout (/me self-guards).
  await app.register(authRoutes);

  // Everything below requires a valid admin session.
  await app.register(async (secured) => {
    secured.addHook('onRequest', secured.authenticate);
    await secured.register(adminStationRoutes);
    await secured.register(adminImageRoutes);
    await secured.register(adminBulkRoutes);
    await secured.register(adminOpsRoutes);
    await secured.register(adminStatsRoutes);
    await secured.register(adminAuditRoutes);
    await secured.register(adminImportExportRoutes);
  });
}
