# Data Model — Users, Roles, and Groups

---

## User

```
User {
  id          String   @id @default(uuid())
  email       String   @unique
  name        String
  passwordHash String
  active      Boolean  @default(true)
  lastSeenAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  roles       UserRole[]
  groups      UserGroupMembership[]
  content     Content[]            ← authored content
  components  Component[]          ← created components
  assets      Asset[]              ← uploaded assets
  bookmarks   ContentBookmark[]
  annotations ContentAnnotation[]
  readingProgress ContentReadingProgress[]
}
```

---

## Role

```
Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  isSystem    Boolean  @default(false)  ← system roles (Admin, Author, etc.) cannot be deleted
  createdAt   DateTime

  permissions Permission[]
  users       UserRole[]
  groups      UserGroup[]
}
```

**Built-in system roles:**
- `ADMIN` — Full system access
- `AUTHOR` — Content creation, template management
- `REVIEWER` — Review assignments, comments, decisions
- `AUDIENCE` — Read-only with interaction (likes, bookmarks, etc.)

---

## Permission

```
Permission {
  id      String   @id @default(uuid())
  roleId  String   (FK → Role)
  module  String   (content | template | review | admin | analytics | channel | component | asset)
  action  String   (create | read | update | delete)
  @@unique([roleId, module, action])
}
```

---

## UserRole

Join table assigning roles to users.

```
UserRole {
  id        String   @id
  userId    String   (FK → User)
  roleId    String   (FK → Role)
  assignedBy String  (FK → User — admin who made the assignment)
  assignedAt DateTime
  @@unique([userId, roleId])
}
```

---

## UserGroup

Named collection of users sharing a common role.

```
UserGroup {
  id          String
  name        String   @unique
  description String?
  roleId      String   (FK → Role)  ← all members inherit this role
  createdAt   DateTime
  updatedAt   DateTime

  memberships UserGroupMembership[]
}
```

---

## UserGroupMembership

```
UserGroupMembership {
  id        String
  userId    String   (FK → User)
  groupId   String   (FK → UserGroup)
  addedBy   String   (FK → User)
  addedAt   DateTime
  @@unique([userId, groupId])
}
```

**Session invalidation on removal:** When a `UserGroupMembership` is deleted, the Integration Layer sets a Redis key `session:{userId}` to immediately invalidate the user's token on their next request. The `authenticate` middleware checks this key and rejects the token if it is present, forcing re-authentication.

---

## Permission Evaluation at Runtime

The Gateway Layer attaches `req.user = { userId, roles: [roleNames], groups: [groupIds] }` from the decoded JWT.

At the Service Layer, `checkResourceAccess` checks:

1. **Role-based:** Does the user's role include the required `(module, action)` permission?
2. **Object-level:** Does the user own or have specific access to the requested resource (author, co-author, reviewer, group member)?

Both checks must pass. Role permission alone is not sufficient to access a resource the user does not have object-level access to.

---

## Workspace (Future)

```
Workspace {
  id          String
  name        String
  ownerId     String   (FK → User)
  createdAt   DateTime
  updatedAt   DateTime
}
```

The `Workspace` model is in the schema as the foundation for the Collaboration module (F-COL-002 Shared Space). It is not currently used by any active feature.
