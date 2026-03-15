import { Router, Response } from "express";
import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import { authorize, type AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// ── Roles ──────────────────────────────────────────────────────────────────

router.get("/roles", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const roles = await repos.userRole.listRoles();
    res.status(200).json(roles);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/roles", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getRoleByName(name);
      if (existing) return { conflict: true } as const;

      const role = await repos.userRole.createRole({ name, description: description ?? null });

      await repos.audit.append({
        action: "CREATE",
        resource: "ROLE",
        resourceId: role.id,
        newValue: { name, description },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return { conflict: false, role } as const;
    });

    if (result.conflict) {
      res.status(409).json({ error: "Role already exists" });
      return;
    }

    res.status(201).json(result.role);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/roles/:id/permissions", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const permissions = await repos.userRole.listPermissionsForRole(req.params.id);
    res.status(200).json(permissions);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/roles/:id/permissions", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const { action, resource } = req.body;
    if (!action || !resource) {
      res.status(400).json({ error: "action and resource are required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const permission = await uow.withTransaction(async (repos) => {
      const perm = await repos.userRole.createPermission({
        action,
        resource,
        roleId: req.params.id,
      });

      await repos.audit.append({
        action: "CREATE",
        resource: "PERMISSION",
        resourceId: perm.id,
        newValue: { action, resource: resource, roleId: req.params.id },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return perm;
    });

    res.status(201).json(permission);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── User-Role Assignment ────────────────────────────────────────────────────

router.post("/users/:userId/roles", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const { roleId } = req.body;
    if (!roleId) {
      res.status(400).json({ error: "roleId is required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    await uow.withTransaction(async (repos) => {
      await repos.userRole.assignRole(req.params.userId, roleId, req.user!.id);

      await repos.audit.append({
        action: "ROLE_ASSIGN",
        resource: "USER",
        resourceId: req.params.userId,
        newValue: { roleId },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    });

    res.status(200).json({ message: "Role assigned" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/users/:userId/roles/:roleId", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    await uow.withTransaction(async (repos) => {
      await repos.userRole.removeRole(req.params.userId, req.params.roleId);

      await repos.audit.append({
        action: "ROLE_REMOVE",
        resource: "USER",
        resourceId: req.params.userId,
        oldValue: { roleId: req.params.roleId },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    });

    res.status(200).json({ message: "Role removed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Users ─────────────────────────────────────────────────────────────────

router.get("/users", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const users = await repos.userRole.listUsers();
    res.status(200).json(users);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/users/:id", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const user = await repos.userRole.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const roles = await repos.userRole.listRolesForUser(user.id);
    const groups = await repos.userRole.listGroupsForUser(user.id);

    res.status(200).json({ ...user, roles, groups });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Groups ──────────────────────────────────────────────────────────────────

router.get("/groups", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const groups = await repos.userRole.listGroups();
    res.status(200).json(groups);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/groups", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const group = await uow.withTransaction(async (repos) => {
      const g = await repos.userRole.createGroup({ name, description: description ?? null });

      await repos.audit.append({
        action: "CREATE",
        resource: "GROUP",
        resourceId: g.id,
        newValue: { name, description },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return g;
    });

    res.status(201).json(group);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/groups/:id", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const group = await repos.userRole.getGroupById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const members = await repos.userRole.listGroupMembers(group.id);
    res.status(200).json({ ...group, members });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/groups/:id/members", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    await uow.withTransaction(async (repos) => {
      await repos.userRole.addUserToGroup(userId, req.params.id);

      await repos.audit.append({
        action: "GROUP_ADD_MEMBER",
        resource: "GROUP",
        resourceId: req.params.id,
        newValue: { userId },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    });

    res.status(200).json({ message: "User added to group" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/groups/:id/members/:userId", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    await uow.withTransaction(async (repos) => {
      await repos.userRole.removeUserFromGroup(req.params.userId, req.params.id);

      await repos.audit.append({
        action: "GROUP_REMOVE_MEMBER",
        resource: "GROUP",
        resourceId: req.params.id,
        oldValue: { userId: req.params.userId },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    });

    res.status(200).json({ message: "User removed from group" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Audit Logs ──────────────────────────────────────────────────────────────

router.get("/logs", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const filters = {
      actorId: req.query.actorId as string | undefined,
      resource: req.query.resource as string | undefined,
      resourceId: req.query.resourceId as string | undefined,
      action: req.query.action as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const logs = await repos.audit.list(filters);
    res.status(200).json(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
