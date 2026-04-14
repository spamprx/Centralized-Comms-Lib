import { Router, Response } from "express";
import { authorize, type AuthRequest } from "../../middlewares/auth.middleware";
import { adminService } from "../../service";
import type { AuditContext } from "../../shared/context";
import { getAdminOperationalMetrics } from "../../observability/operationalMetrics";

const router = Router();

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

// ── Roles ──────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/roles:
 *   get:
 *     summary: List all roles
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 *       500:
 *         description: Server error
 */
router.get("/roles", async (req: AuthRequest, res: Response) => {
  try {
    const roles = await adminService.listRoles();
    res.status(200).json(roles);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/admin/roles:
 *   post:
 *     summary: Create a new role
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Role created
 *       400:
 *         description: Invalid payload
 *       409:
 *         description: Role already exists
 *       500:
 *         description: Server error
 */
router.post(
  "/roles",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
  },
);

/**
 * @openapi
 * /api/v1/admin/roles/{id}:
 *   patch:
 *     summary: Update an existing role
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *               isSystem:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Role updated
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.patch(
  "/roles/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, isSystem } = req.body as {
        name?: string;
        description?: string | null;
        isSystem?: boolean;
      };
      const result = await adminService.updateRole(
        auditContext(req),
        req.params.id,
        {
          name,
          description,
          isSystem,
        },
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "Role not found" });
        return;
      }
      res.status(200).json(result.role);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/roles/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await adminService.deleteRole(
        auditContext(req),
        req.params.id,
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "Role not found" });
        return;
      }
      res.status(200).json({ message: "Role deleted" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/roles/{id}/permissions:
 *   get:
 *     summary: List permissions for a role
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of permissions
 *       500:
 *         description: Server error
 */
router.get(
  "/roles/:id/permissions",
  async (req: AuthRequest, res: Response) => {
    try {
      const permissions = await adminService.listPermissionsForRole(
        req.params.id,
      );
      res.status(200).json(permissions);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/roles/{id}/permissions:
 *   post:
 *     summary: Create a permission for a role
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - resource
 *             properties:
 *               action:
 *                 type: string
 *               resource:
 *                 type: string
 *     responses:
 *       201:
 *         description: Permission created
 *       400:
 *         description: Invalid payload
 *       500:
 *         description: Server error
 */
router.post(
  "/roles/:id/permissions",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { action, resource } = req.body;
      if (!action || !resource) {
        res.status(400).json({ error: "action and resource are required" });
        return;
      }
      const permission = await adminService.createPermission(
        auditContext(req),
        req.params.id,
        {
          action,
          resource,
        },
      );
      res.status(201).json(permission);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/permissions/{id}:
 *   patch:
 *     summary: Update a permission
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *               resource:
 *                 type: string
 *     responses:
 *       200:
 *         description: Permission updated
 *       404:
 *         description: Permission not found
 *       500:
 *         description: Server error
 */
router.patch(
  "/permissions/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { action, resource } = req.body as {
        action?: string;
        resource?: string;
      };
      const result = await adminService.updatePermission(
        auditContext(req),
        req.params.id,
        {
          action,
          resource,
        },
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "Permission not found" });
        return;
      }
      res.status(200).json(result.permission);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/permissions/{id}:
 *   delete:
 *     summary: Delete a permission
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permission deleted
 *       404:
 *         description: Permission not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/permissions/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await adminService.deletePermission(
        auditContext(req),
        req.params.id,
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "Permission not found" });
        return;
      }
      res.status(200).json({ message: "Permission deleted" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

// ── User-Role Assignment ────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/users/{userId}/roles:
 *   post:
 *     summary: Assign a role to a user
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleId
 *             properties:
 *               roleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role assigned
 *       400:
 *         description: Invalid payload
 *       500:
 *         description: Server error
 */
router.post(
  "/users/:userId/roles",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { roleId } = req.body;
      if (!roleId) {
        res.status(400).json({ error: "roleId is required" });
        return;
      }
      await adminService.assignRoleToUser(
        auditContext(req),
        req.params.userId,
        roleId,
      );
      res.status(200).json({ message: "Role assigned" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/users/{userId}/roles:
 *   patch:
 *     summary: Update a user's role (replace one role with another)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromRoleId
 *               - toRoleId
 *             properties:
 *               fromRoleId:
 *                 type: string
 *               toRoleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User role updated
 *       400:
 *         description: Invalid payload
 *       500:
 *         description: Server error
 */
router.patch(
  "/users/:userId/roles",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { fromRoleId, toRoleId } = req.body as {
        fromRoleId?: string;
        toRoleId?: string;
      };
      if (!fromRoleId || !toRoleId) {
        res.status(400).json({ error: "fromRoleId and toRoleId are required" });
        return;
      }
      await adminService.updateUserRole(
        auditContext(req),
        req.params.userId,
        fromRoleId,
        toRoleId,
      );
      res.status(200).json({ message: "User role updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/users/{userId}/roles/{roleId}:
 *   delete:
 *     summary: Remove a role from a user
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role removed
 *       500:
 *         description: Server error
 */
router.delete(
  "/users/:userId/roles/:roleId",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
  },
);

// ── Users ─────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/users:
 *   get:
 *     summary: List users
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       500:
 *         description: Server error
 */
router.get("/users", async (req: AuthRequest, res: Response) => {
  try {
    const users = await adminService.listUsersWithAssociations();
    res.status(200).json(users);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
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

router.post(
  "/users",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { email, displayName, password, roleId } = req.body as {
        email?: string;
        displayName?: string;
        password?: string;
        roleId?: string | null;
      };
      if (!email?.trim() || !displayName?.trim() || !password) {
        res
          .status(400)
          .json({ error: "email, displayName, and password are required" });
        return;
      }
      const result = await adminService.createUser(auditContext(req), {
        email: email.trim(),
        displayName: displayName.trim(),
        password,
        roleId: roleId ?? null,
      });
      if ("conflict" in result && result.conflict) {
        res.status(409).json({ error: "User with this email already exists" });
        return;
      }
      const full = await adminService.getUserById(result.user.id);
      res.status(201).json(full ?? result.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.patch(
  "/users/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { displayName, email, isActive, avatarUrl, roleId } = req.body as {
        displayName?: string;
        email?: string;
        isActive?: boolean;
        avatarUrl?: string | null;
        roleId?: string | null;
      };
      const result = await adminService.updateUser(
        auditContext(req),
        req.params.id,
        {
          displayName,
          email,
          isActive,
          avatarUrl,
          roleId,
        },
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const full = await adminService.getUserById(req.params.id);
      res.status(200).json(full ?? result.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.delete(
  "/users/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await adminService.deactivateUser(
        auditContext(req),
        req.params.id,
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.status(200).json({ deactivated: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/users/bulk-delete",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ids } = req.body as { ids?: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "ids array is required" });
        return;
      }
      const out = await adminService.bulkDeactivateUsers(
        auditContext(req),
        ids,
      );
      res.status(200).json(out);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.patch(
  "/users/:id/status",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body as { status?: string };
      if (!status) {
        res.status(400).json({ error: "status is required" });
        return;
      }
      const active = status === "active" || status === "pending";
      const result = await adminService.updateUser(
        auditContext(req),
        req.params.id,
        {
          isActive: active,
        },
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const full = await adminService.getUserById(req.params.id);
      res.status(200).json(full ?? result.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/users/:id/reset-password",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await adminService.resetUserPassword(
        auditContext(req),
        req.params.id,
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.get(
  "/settings",
  authorize("ADMIN"),
  (_req: AuthRequest, res: Response) => {
    try {
      res.status(200).json(adminService.getSettings());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.patch(
  "/settings/:section",
  authorize("ADMIN"),
  (req: AuthRequest, res: Response) => {
    try {
      const merged = adminService.patchSettingsSection(
        req.params.section,
        req.body ?? {},
      );
      res.status(200).json(merged);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Unknown settings section")) {
        res.status(400).json({ error: message });
        return;
      }
      res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/settings/test-email",
  authorize("ADMIN"),
  (_req: AuthRequest, res: Response) => {
    res
      .status(200)
      .json({ success: false, message: "Outbound email is not configured." });
  },
);

// ── Groups ──────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/groups:
 *   get:
 *     summary: List groups
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of groups
 *       500:
 *         description: Server error
 */
router.get("/groups", async (req: AuthRequest, res: Response) => {
  try {
    const groups = await adminService.listGroups();
    res.status(200).json(groups);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/admin/groups:
 *   post:
 *     summary: Create a group
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Group created
 *       400:
 *         description: Invalid payload
 *       500:
 *         description: Server error
 */
router.post(
  "/groups",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
  },
);

/**
 * @openapi
 * /api/v1/admin/groups/{id}:
 *   get:
 *     summary: Get group details
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group details
 *       404:
 *         description: Group not found
 *       500:
 *         description: Server error
 */
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

/**
 * @openapi
 * /api/v1/admin/groups/{id}:
 *   patch:
 *     summary: Update a group
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Group updated
 *       404:
 *         description: Group not found
 *       500:
 *         description: Server error
 */
router.patch(
  "/groups/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, description } = req.body as {
        name?: string;
        description?: string | null;
      };
      const result = await adminService.updateGroup(
        auditContext(req),
        req.params.id,
        {
          name,
          description,
        },
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "Group not found" });
        return;
      }
      res.status(200).json(result.group);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/groups/{id}:
 *   delete:
 *     summary: Delete a group
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group deleted
 *       404:
 *         description: Group not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/groups/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await adminService.deleteGroup(
        auditContext(req),
        req.params.id,
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "Group not found" });
        return;
      }
      res.status(200).json({ message: "Group deleted" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/groups/{id}/members:
 *   post:
 *     summary: Add a user to a group
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User added to group
 *       400:
 *         description: Invalid payload
 *       500:
 *         description: Server error
 */
router.post(
  "/groups/:id/members",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        res.status(400).json({ error: "userId is required" });
        return;
      }
      await adminService.addGroupMember(
        auditContext(req),
        req.params.id,
        userId,
      );
      res.status(200).json({ message: "User added to group" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/groups/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a user from a group
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User removed from group
 *       500:
 *         description: Server error
 */
router.delete(
  "/groups/:id/members/:userId",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
  },
);

// ── Monitoring (JSON for admin UI; use GET /metrics for Prometheus) ─────────

/**
 * @openapi
 * /api/v1/admin/monitoring/metrics:
 *   get:
 *     summary: Operational metrics snapshot for admin dashboards
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metric cards data
 *       403:
 *         description: Forbidden
 */
router.get(
  "/monitoring/metrics",
  authorize("ADMIN"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const metrics = await getAdminOperationalMetrics();
      res.status(200).json(metrics);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

// ── Audit Logs ──────────────────────────────────────────────────────────────

function parseOptionalDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function escapeAuditCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function auditCsvRow(fields: string[]): string {
  return fields.map(escapeAuditCsvField).join(",");
}

/**
 * @openapi
 * /api/v1/admin/logs:
 *   get:
 *     summary: List audit logs with optional filters (F-ADM-005)
 *     description: >
 *       Returns immutable audit log entries filterable by user, action type,
 *       content ID, and date range per F-ADM-005 REQ-2.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: actorId
 *         schema:
 *           type: string
 *         description: Filter by the user who performed the action
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: Filter by resource type (e.g. CONTENT, USER, TEMPLATE)
 *       - in: query
 *         name: resourceId
 *         schema:
 *           type: string
 *         description: Filter by specific resource / content ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type (e.g. CREATE, UPDATE, DELETE, BODY_SAVE)
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start of date range (ISO 8601). Inclusive.
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End of date range (ISO 8601). Inclusive.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of audit log entries
 *       400:
 *         description: Invalid date parameters
 *       500:
 *         description: Server error
 */
router.get(
  "/logs",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const from = parseOptionalDate(req.query.from);
      const to = parseOptionalDate(req.query.to);
      if ((req.query.from && !from) || (req.query.to && !to)) {
        res.status(400).json({ error: "Invalid from or to date" });
        return;
      }
      if (from && to && from > to) {
        res.status(400).json({ error: "`from` must be before `to`" });
        return;
      }

      const filters = {
        actorId: req.query.actorId as string | undefined,
        resource: req.query.resource as string | undefined,
        resourceId: req.query.resourceId as string | undefined,
        action: req.query.action as string | undefined,
        from,
        to,
        limit: req.query.limit
          ? parseInt(req.query.limit as string)
          : undefined,
        offset: req.query.offset
          ? parseInt(req.query.offset as string)
          : undefined,
      };
      const logs = await adminService.listLogs(filters);
      res.status(200).json(logs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/admin/logs/export:
 *   get:
 *     summary: Export audit logs in CSV or JSON format (F-ADM-005)
 *     description: >
 *       Returns a downloadable file containing audit log entries matching the
 *       given filters. Supports CSV and JSON formats per F-ADM-005 REQ-3.
 *       Entries are immutable and retained for a configurable period (default 2 years).
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *         description: Export file format
 *       - in: query
 *         name: actorId
 *         schema:
 *           type: string
 *         description: Filter by the user who performed the action
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: Filter by resource type
 *       - in: query
 *         name: resourceId
 *         schema:
 *           type: string
 *         description: Filter by specific resource / content ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start of date range (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End of date range (ISO 8601)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 1000
 *         description: Max rows to export (default 1000, max 10000)
 *     responses:
 *       200:
 *         description: Audit log export file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Invalid format or date parameters
 *       500:
 *         description: Server error
 */
router.get(
  "/logs/export",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const format = ((req.query.format as string) || "").toLowerCase();
      if (format !== "csv" && format !== "json") {
        res.status(400).json({
          error:
            "format query parameter is required and must be 'csv' or 'json'",
        });
        return;
      }

      const from = parseOptionalDate(req.query.from);
      const to = parseOptionalDate(req.query.to);
      if ((req.query.from && !from) || (req.query.to && !to)) {
        res.status(400).json({ error: "Invalid from or to date" });
        return;
      }
      if (from && to && from > to) {
        res.status(400).json({ error: "`from` must be before `to`" });
        return;
      }

      const rawLimit = req.query.limit
        ? parseInt(req.query.limit as string)
        : 1000;
      const limit = Math.min(Math.max(1, rawLimit), 10000);

      const filters = {
        actorId: req.query.actorId as string | undefined,
        resource: req.query.resource as string | undefined,
        resourceId: req.query.resourceId as string | undefined,
        action: req.query.action as string | undefined,
        from,
        to,
        limit,
        offset: 0,
      };
      const logs = await adminService.listLogs(filters);

      const fromStr = from ? from.toISOString().split("T")[0] : "all";
      const toStr = to ? to.toISOString().split("T")[0] : "now";

      if (format === "json") {
        const filename = `audit_logs_${fromStr}_to_${toStr}.json`;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        res.status(200).json(logs);
        return;
      }

      const CSV_HEADERS = [
        "ID",
        "Timestamp",
        "Actor ID",
        "Action",
        "Resource",
        "Resource ID",
        "Old Value",
        "New Value",
        "IP Address",
        "User Agent",
      ];
      const rows: string[] = [auditCsvRow(CSV_HEADERS)];

      for (const log of logs) {
        rows.push(
          auditCsvRow([
            log.id,
            log.createdAt.toISOString(),
            log.actorId ?? "",
            log.action,
            log.resource,
            log.resourceId,
            log.oldValue != null ? JSON.stringify(log.oldValue) : "",
            log.newValue != null ? JSON.stringify(log.newValue) : "",
            log.ipAddress ?? "",
            log.userAgent ?? "",
          ]),
        );
      }

      const filename = `audit_logs_${fromStr}_to_${toStr}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.status(200).send(rows.join("\n"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

export default router;
