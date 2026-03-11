import { Router, Response } from "express";
import { authorize, type AuthRequest } from "../middleware/auth.middleware";
import { adminService } from "../../service";
import type { AuditContext } from "../../service/context";

const router = Router();

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

// ── Roles ──────────────────────────────────────────────────────────────────

router.get("/roles", async (req: AuthRequest, res: Response) => {
  try {
    const roles = await adminService.listRoles();
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
    const result = await adminService.createRole(auditContext(req), {
      name,
      description: description ?? null,
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
    const permissions = await adminService.listPermissionsForRole(req.params.id);
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
    const permission = await adminService.createPermission(auditContext(req), req.params.id, {
      action,
      resource,
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
    await adminService.assignRoleToUser(auditContext(req), req.params.userId, roleId);
    res.status(200).json({ message: "Role assigned" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/users/:userId/roles/:roleId", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    await adminService.removeRoleFromUser(
      auditContext(req),
      req.params.userId,
      req.params.roleId,
    );
    res.status(200).json({ message: "Role removed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Users ─────────────────────────────────────────────────────────────────

router.get("/users", async (req: AuthRequest, res: Response) => {
  try {
    const users = await adminService.listUsers();
    res.status(200).json(users);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/users/:id", async (req: AuthRequest, res: Response) => {
  try {
    const user = await adminService.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(200).json(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Groups ──────────────────────────────────────────────────────────────────

router.get("/groups", async (req: AuthRequest, res: Response) => {
  try {
    const groups = await adminService.listGroups();
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
    const group = await adminService.createGroup(auditContext(req), {
      name,
      description: description ?? null,
    });
    res.status(201).json(group);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/groups/:id", async (req: AuthRequest, res: Response) => {
  try {
    const group = await adminService.getGroupById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    res.status(200).json(group);
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
    await adminService.addGroupMember(auditContext(req), req.params.id, userId);
    res.status(200).json({ message: "User added to group" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/groups/:id/members/:userId", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    await adminService.removeGroupMember(
      auditContext(req),
      req.params.id,
      req.params.userId,
    );
    res.status(200).json({ message: "User removed from group" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Audit Logs ──────────────────────────────────────────────────────────────

router.get("/logs", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const filters = {
      actorId: req.query.actorId as string | undefined,
      resource: req.query.resource as string | undefined,
      resourceId: req.query.resourceId as string | undefined,
      action: req.query.action as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };
    const logs = await adminService.listLogs(filters);
    res.status(200).json(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
