import { Router, Response } from "express";
import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { AuthRequest } from "../middleware/auth.middleware";

const router = Router();

router.post("/requests", async (req: AuthRequest, res: Response) => {
  try {
    const { contentId, contentVersionId, quorumRequired } = req.body;

    if (!contentId || !contentVersionId) {
      res.status(400).json({ error: "contentId and contentVersionId are required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const result = await uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(contentId);
      if (!content) return { notFound: true } as const;

      if (content.lifecycleState !== "DRAFT" && content.lifecycleState !== "IN_REVIEW") {
        return { notFound: false, invalidState: true, state: content.lifecycleState } as const;
      }

      if (content.lifecycleState === "DRAFT") {
        await repos.content.updateLifecycleState(contentId, "IN_REVIEW");
      }

      const request = await repos.review.createRequest({
        contentId,
        contentVersionId,
        requestedById: req.user!.id,
        quorumRequired: quorumRequired ?? 1,
      });

      await repos.audit.append({
        action: "CREATE",
        resource: "REVIEW_REQUEST",
        resourceId: request.id,
        newValue: { contentId, contentVersionId, quorumRequired: quorumRequired ?? 1 },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      await repos.outbox.add({
        aggregateType: "REVIEW_REQUEST",
        aggregateId: request.id,
        eventType: "REVIEW_REQUEST.CREATED",
        payload: { contentId, requestId: request.id, requestedById: req.user!.id },
      });

      return { notFound: false, invalidState: false, request } as const;
    });

    if (result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if (result.invalidState) {
      res.status(422).json({ error: `Content must be in DRAFT or IN_REVIEW state, currently ${result.state}` });
      return;
    }

    res.status(201).json(result.request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/requests/:id", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const request = await repos.review.getRequestById(req.params.id);
    if (!request) {
      res.status(404).json({ error: "Review request not found" });
      return;
    }

    const assignments = await repos.review.listAssignmentsForRequest(request.id);

    res.status(200).json({ ...request, assignments });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/content/:contentId", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const requests = await repos.review.listRequestsForContent(req.params.contentId);
    res.status(200).json(requests);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/requests/:id/assign", async (req: AuthRequest, res: Response) => {
  try {
    const { reviewerId } = req.body;

    if (!reviewerId) {
      res.status(400).json({ error: "reviewerId is required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const result = await uow.withTransaction(async (repos) => {
      const request = await repos.review.getRequestById(req.params.id);
      if (!request) return null;

      const assignment = await repos.review.assignReviewer({
        reviewRequestId: request.id,
        reviewerId,
        assignedById: req.user!.id,
      });

      await repos.audit.append({
        action: "ASSIGN",
        resource: "REVIEW_ASSIGNMENT",
        resourceId: assignment.id,
        newValue: { reviewRequestId: request.id, reviewerId },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      await repos.outbox.add({
        aggregateType: "REVIEW_ASSIGNMENT",
        aggregateId: assignment.id,
        eventType: "REVIEWER.ASSIGNED",
        payload: { reviewRequestId: request.id, reviewerId, assignedById: req.user!.id },
      });

      return assignment;
    });

    if (!result) {
      res.status(404).json({ error: "Review request not found" });
      return;
    }

    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/assignments/:id/decide", async (req: AuthRequest, res: Response) => {
  try {
    const { verdict, comment } = req.body;

    if (!verdict || !comment) {
      res.status(400).json({ error: "verdict and comment are required" });
      return;
    }

    const validVerdicts = ["APPROVED", "DENIED", "ROLLBACK"];
    if (!validVerdicts.includes(verdict)) {
      res.status(400).json({ error: `verdict must be one of: ${validVerdicts.join(", ")}` });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const result = await uow.withTransaction(async (repos) => {
      const assignment = await repos.review.getAssignmentById(req.params.id);
      if (!assignment) return { notFound: true } as const;

      if (assignment.status === "COMPLETED") {
        return { notFound: false, alreadyCompleted: true } as const;
      }

      await repos.review.recordDecision({
        reviewAssignmentId: assignment.id,
        verdict,
        comment,
      });

      const request = await repos.review.getRequestById(assignment.reviewRequestId);
      if (request && verdict === "APPROVED") {
        const allAssignments = await repos.review.listAssignmentsForRequest(request.id);
        const completedApprovals = allAssignments.filter(
          (a) => a.id === assignment.id || a.status === "COMPLETED"
        ).length;

        if (completedApprovals >= request.quorumRequired) {
          await repos.review.updateRequestStatus(request.id, "CLOSED");
          await repos.content.updateLifecycleState(request.contentId, "PUBLISHED");

          await repos.outbox.add({
            aggregateType: "CONTENT",
            aggregateId: request.contentId,
            eventType: "CONTENT.PUBLISHED",
            payload: { contentId: request.contentId, reviewRequestId: request.id },
          });
        }
      } else if (request && verdict === "DENIED") {
        await repos.content.updateLifecycleState(request.contentId, "DRAFT");
        await repos.review.updateRequestStatus(request.id, "CLOSED");

        await repos.outbox.add({
          aggregateType: "CONTENT",
          aggregateId: request.contentId,
          eventType: "CONTENT.DENIED",
          payload: { contentId: request.contentId, reviewRequestId: request.id, reason: comment },
        });
      } else if (request && verdict === "ROLLBACK") {
        await repos.content.updateLifecycleState(request.contentId, "IN_REVIEW");
        await repos.review.updateRequestStatus(request.id, "OPEN");

        await repos.outbox.add({
          aggregateType: "CONTENT",
          aggregateId: request.contentId,
          eventType: "CONTENT.ROLLBACK",
          payload: { contentId: request.contentId, reviewRequestId: request.id, reason: comment },
        });
      }

      await repos.audit.append({
        action: "REVIEW_DECISION",
        resource: "REVIEW_ASSIGNMENT",
        resourceId: assignment.id,
        newValue: { verdict, comment },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return { notFound: false, alreadyCompleted: false } as const;
    });

    if (result.notFound) {
      res.status(404).json({ error: "Review assignment not found" });
      return;
    }
    if (result.alreadyCompleted) {
      res.status(422).json({ error: "Assignment already completed" });
      return;
    }

    res.status(200).json({ message: `Decision recorded: ${verdict}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/my-assignments", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const assignments = await repos.review.listAssignmentsForReviewer(req.user!.id);
    res.status(200).json(assignments);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
