/**
 * Integration layer seam for external eventing/notification adapters.
 * Current implementation uses repository outbox + direct service calls;
 * this module centralizes exports for future event bus and retry workers.
 */
export { PrismaUnitOfWork } from "../repository";
