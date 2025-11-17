# Monorepo to RESTful API Architecture Refactoring Plan

## Executive Summary

This document outlines a comprehensive plan to refactor the current monorepo structure into a clean RESTful API architecture with separate CLIENT and SERVER directories, each with their own package.json and build processes.

**Overall Difficulty**: ⚠️ **MODERATE to HIGH** (6-8 hours of focused work)

**Risk Level**: 🟡 **MEDIUM** - Requires careful coordination of multiple moving parts

---

## Current Architecture Analysis

### Current Structure
```
chukka-app/
├── package.json (single, shared)
├── client/          (frontend code)
├── server/          (backend code)
├── shared/          (shared types/schemas)
├── uploads/         (file storage)
├── output/          (generated files)
└── dist/            (build output)
```

### Current Server Architecture: **Services Pattern**
- **Services Layer**: Business logic in `server/services/` (excel-parser, template-processor, userService, etc.)
- **Routes**: Massive `server/routes.ts` file (2000+ lines) with inline route handlers
- **Storage**: Database abstraction layer (`server/storage.ts`)
- **Auth**: Separate auth module with some controllers (`server/auth/userController.ts`)
- **Mixed Concerns**: Routes handle both HTTP concerns and business logic

### Architecture Comparison: Services vs MVC

#### Services Pattern (Current)
**Pros:**
- ✅ Business logic is well-separated and reusable
- ✅ Services can be easily tested in isolation
- ✅ Flexible - can be used by multiple entry points
- ✅ Already partially implemented

**Cons:**
- ❌ Routes file is monolithic (2000+ lines)
- ❌ HTTP concerns mixed with business logic
- ❌ Harder to maintain as it grows
- ❌ Not following RESTful conventions strictly
- ❌ Difficult to scale with more routes

#### MVC Pattern (Proposed)
**Pros:**
- ✅ Clear separation: Controllers (HTTP), Models (Data), Services (Business Logic)
- ✅ Industry standard for RESTful APIs
- ✅ Easier to understand and onboard new developers
- ✅ Better testability (controllers, models, services can be tested separately)
- ✅ Scales better with more routes
- ✅ Follows RESTful principles more closely

**Cons:**
- ⚠️ More files to manage
- ⚠️ Slightly more verbose
- ⚠️ Requires refactoring existing code

**Recommendation**: **MVC Pattern** - Better suited for RESTful API architecture and long-term maintainability.

---

## Proposed Architecture

### Target Structure
```
chukka-app/
├── CLIENT/
│   ├── package.json          (separate, client-only dependencies)
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/                   (all existing client code)
│
├── SERVER/
│   ├── package.json          (separate, server-only dependencies)
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts          (entry point)
│   │   ├── config/
│   │   ├── controllers/      (HTTP request/response handling)
│   │   ├── services/         (business logic - keep existing)
│   │   ├── models/           (data access layer - refactor from storage.ts)
│   │   ├── routes/           (route definitions)
│   │   ├── middleware/       (auth, validation, etc.)
│   │   ├── utils/
│   │   └── types/
│   └── templates/            (handlebars templates)
│
├── shared/                    (shared types, schemas - keep as is)
├── uploads/                   (file storage - keep as is)
├── output/                    (generated files - keep as is)
└── package.json              (root workspace config - optional)
```

---

## Detailed Refactoring Steps

### Phase 1: Preparation & Planning (30 minutes)
**Difficulty**: 🟢 **LOW** - Can be done manually

1. **Create backup branch**
   ```bash
   git checkout -b refactor/restful-architecture
   git push -u origin refactor/restful-architecture
   ```

2. **Document current dependencies**
   - List all dependencies in current package.json
   - Categorize: client-only, server-only, shared

3. **Create migration checklist**
   - List all routes in `server/routes.ts`
   - Map routes to potential controllers
   - Identify shared code dependencies

---

### Phase 2: Create Separate Package Structures (1 hour)
**Difficulty**: 🟡 **MEDIUM** - Mostly manual with some automation

#### Step 2.1: Create CLIENT directory structure
**Manual Steps:**
1. Create `CLIENT/` directory at root
2. Move `client/` contents to `CLIENT/src/`
3. Move `client/index.html` to `CLIENT/index.html`
4. Create `CLIENT/package.json` with:
   - All React, Vite, UI library dependencies
   - Client-specific scripts (dev, build, preview)
   - Remove server dependencies
5. Create `CLIENT/tsconfig.json` (copy and adjust paths)
6. Create `CLIENT/vite.config.ts` (update paths for new structure)
7. Update import paths in client code:
   - `@shared/*` → `../../shared/*` or keep if using workspace
   - Update any relative imports

**Automation Potential**: 
- Script to move files ✅
- Script to update imports ⚠️ (needs careful review)

#### Step 2.2: Create SERVER directory structure
**Manual Steps:**
1. Create `SERVER/` directory at root
2. Move `server/` contents to `SERVER/src/`
3. Create `SERVER/package.json` with:
   - All Express, database, server dependencies
   - Server-specific scripts (dev, build, start)
   - Remove client dependencies
4. Create `SERVER/tsconfig.json` (copy and adjust paths)
5. Update import paths in server code:
   - `@shared/*` → `../../shared/*` or keep if using workspace
   - Update relative imports

**Automation Potential**: 
- Script to move files ✅
- Script to update imports ⚠️ (needs careful review)

#### Step 2.3: Update shared directory
**Manual Steps:**
1. Keep `shared/` at root (accessible by both)
2. Update any imports that reference shared
3. Consider creating `shared/package.json` if using workspaces

---

### Phase 3: Refactor Server to MVC Architecture (3-4 hours)
**Difficulty**: 🔴 **HIGH** - Requires careful refactoring

#### Step 3.1: Create Models Layer (1 hour)
**Manual Steps:**
1. Create `SERVER/src/models/` directory
2. Refactor `storage.ts` into model classes:
   - `FileModel.ts` (uploaded files, excel data)
   - `TemplateModel.ts` (dispatch, EOD, PAX templates)
   - `ProcessingModel.ts` (processing jobs, generated reports)
   - `UserModel.ts` (user data access)
   - `DispatchModel.ts` (dispatch records, versions, sessions)
   - `ConsolidatedPaxModel.ts` (consolidated PAX reports)
3. Each model should:
   - Extend or use base database connection
   - Have methods for CRUD operations
   - Handle data validation
   - Return typed results

**Example Structure:**
```typescript
// SERVER/src/models/FileModel.ts
export class FileModel {
  async createUploadedFile(data: InsertUploadedFile): Promise<UploadedFile> {
    // Move logic from storage.ts
  }
  
  async getUploadedFile(id: number): Promise<UploadedFile | null> {
    // Move logic from storage.ts
  }
}
```

**Automation Potential**: 
- Can extract methods from storage.ts with find/replace ⚠️
- Manual review required ✅

#### Step 3.2: Create Controllers Layer (2 hours)
**Manual Steps:**
1. Create `SERVER/src/controllers/` directory
2. Break down `routes.ts` into controllers:
   - `AuthController.ts` (already exists partially)
   - `UserController.ts` (already exists - move to controllers/)
   - `FileController.ts` (file upload/download)
   - `TemplateController.ts` (template management)
   - `ProcessingController.ts` (processing jobs)
   - `DispatchController.ts` (dispatch operations)
   - `EODController.ts` (EOD processing)
   - `PAXController.ts` (PAX processing)
   - `ConsolidatedPaxController.ts` (consolidated PAX)
   - `SharingController.ts` (document sharing)
   - `ReportController.ts` (report generation)

3. Each controller should:
   - Handle HTTP requests/responses
   - Use services for business logic
   - Use models for data access
   - Return standardized responses
   - Handle errors appropriately

**Example Structure:**
```typescript
// SERVER/src/controllers/TemplateController.ts
export class TemplateController {
  constructor(
    private templateService: TemplateService,
    private templateModel: TemplateModel
  ) {}
  
  async uploadDispatchTemplate(req: Request, res: Response) {
    // HTTP handling only
    // Call service for business logic
    // Return response
  }
}
```

**Automation Potential**: 
- Can extract route handlers with find/replace ⚠️
- Manual refactoring required ✅

#### Step 3.3: Organize Services (30 minutes)
**Manual Steps:**
1. Move `server/services/` to `SERVER/src/services/`
2. Update imports in services
3. Ensure services only contain business logic (no HTTP concerns)
4. Services should use models, not direct database access

**Automation Potential**: 
- Mostly file moves ✅
- Import updates can be automated ⚠️

#### Step 3.4: Create Routes Layer (1 hour)
**Manual Steps:**
1. Create `SERVER/src/routes/` directory structure:
   ```
   routes/
   ├── index.ts           (main router)
   ├── auth.routes.ts
   ├── users.routes.ts
   ├── files.routes.ts
   ├── templates.routes.ts
   ├── processing.routes.ts
   ├── dispatch.routes.ts
   ├── eod.routes.ts
   ├── pax.routes.ts
   ├── consolidated-pax.routes.ts
   ├── sharing.routes.ts
   └── reports.routes.ts
   ```

2. Each route file should:
   - Import relevant controller
   - Define routes using controller methods
   - Apply middleware (auth, validation)
   - Export router

**Example Structure:**
```typescript
// SERVER/src/routes/templates.routes.ts
import { Router } from 'express';
import { TemplateController } from '../controllers/TemplateController';
import { authenticateToken } from '../middleware/auth';
import { requireTemplateAccess } from '../middleware/roleMiddleware';

const router = Router();
const templateController = new TemplateController(/* dependencies */);

router.post('/dispatch', authenticateToken, requireTemplateAccess, 
  templateController.uploadDispatchTemplate.bind(templateController));

export default router;
```

**Automation Potential**: 
- Can extract route definitions ⚠️
- Manual organization required ✅

#### Step 3.5: Organize Middleware (30 minutes)
**Manual Steps:**
1. Create `SERVER/src/middleware/` directory
2. Move auth middleware from `server/auth/middleware.ts`
3. Move role middleware from `server/auth/roleMiddleware.ts`
4. Create validation middleware if needed
5. Update imports

**Automation Potential**: 
- Mostly file moves ✅

---

### Phase 4: Update Build Configuration (1 hour)
**Difficulty**: 🟡 **MEDIUM** - Configuration changes

#### Step 4.1: Update Vite Config
**Manual Steps:**
1. Update `CLIENT/vite.config.ts`:
   - Change root path
   - Update alias paths
   - Update build output directory
   - Update public directory references

**Automation Potential**: 
- Manual configuration ✅

#### Step 4.2: Update TypeScript Configs
**Manual Steps:**
1. Update `CLIENT/tsconfig.json`:
   - Adjust paths
   - Update include/exclude
   
2. Update `SERVER/tsconfig.json`:
   - Adjust paths
   - Update include/exclude
   - Set appropriate compiler options

**Automation Potential**: 
- Manual configuration ✅

#### Step 4.3: Update Server Entry Point
**Manual Steps:**
1. Update `SERVER/src/index.ts`:
   - Import routes from new structure
   - Update static file serving paths
   - Update Vite integration (if needed)

**Automation Potential**: 
- Manual updates required ✅

---

### Phase 5: Update Import Paths (1-2 hours)
**Difficulty**: 🟡 **MEDIUM** - Can be partially automated

#### Step 5.1: Update Client Imports
**Manual Steps:**
1. Update all `@shared/*` imports in client
2. Update relative imports
3. Test that all imports resolve

**Automation Potential**: 
- Find/replace for `@shared/*` ✅
- Relative imports need manual review ⚠️

#### Step 5.2: Update Server Imports
**Manual Steps:**
1. Update all `@shared/*` imports in server
2. Update relative imports between server modules
3. Update service imports
4. Test that all imports resolve

**Automation Potential**: 
- Find/replace for `@shared/*` ✅
- Relative imports need manual review ⚠️

---

### Phase 6: Update Scripts & Tooling (30 minutes)
**Difficulty**: 🟢 **LOW** - Mostly configuration

#### Step 6.1: Update Package Scripts
**Manual Steps:**
1. Update `CLIENT/package.json` scripts:
   - `dev`: Run Vite dev server
   - `build`: Build client
   - `preview`: Preview build

2. Update `SERVER/package.json` scripts:
   - `dev`: Run server with tsx
   - `build`: Build server
   - `start`: Run production server

3. Optional: Create root `package.json` with workspace scripts:
   ```json
   {
     "scripts": {
       "dev": "concurrently \"npm run dev --prefix CLIENT\" \"npm run dev --prefix SERVER\"",
       "build": "npm run build --prefix CLIENT && npm run build --prefix SERVER"
     }
   }
   ```

**Automation Potential**: 
- Manual configuration ✅

#### Step 6.2: Update Environment Variables
**Manual Steps:**
1. Ensure `.env` files are accessible to both
2. Update any path references in env files
3. Document required environment variables

**Automation Potential**: 
- Manual review ✅

---

### Phase 7: Testing & Validation (1-2 hours)
**Difficulty**: 🟡 **MEDIUM** - Manual testing required

#### Step 7.1: Build Testing
**Manual Steps:**
1. Test client build: `cd CLIENT && npm run build`
2. Test server build: `cd SERVER && npm run build`
3. Fix any build errors
4. Test production build

**Automation Potential**: 
- Can be scripted ✅

#### Step 7.2: Runtime Testing
**Manual Steps:**
1. Start server: `cd SERVER && npm run dev`
2. Start client: `cd CLIENT && npm run dev`
3. Test all major features:
   - Authentication
   - File uploads
   - Template management
   - Report generation
   - User management
4. Fix any runtime errors

**Automation Potential**: 
- Manual testing required ✅

#### Step 7.3: Integration Testing
**Manual Steps:**
1. Test API endpoints with Postman/curl
2. Test frontend-backend communication
3. Test file serving
4. Test authentication flow
5. Test all CRUD operations

**Automation Potential**: 
- Manual testing required ✅

---

## Step-by-Step Summary

### Total Steps: **~25 distinct steps**

1. ✅ Create backup branch (Manual - 5 min)
2. ✅ Document dependencies (Manual - 15 min)
3. ✅ Create CLIENT directory structure (Manual - 20 min)
4. ✅ Create CLIENT package.json (Manual - 15 min)
5. ✅ Update CLIENT configs (Manual - 15 min)
6. ✅ Create SERVER directory structure (Manual - 20 min)
7. ✅ Create SERVER package.json (Manual - 15 min)
8. ✅ Update SERVER configs (Manual - 15 min)
9. ✅ Create Models layer (Manual - 60 min)
10. ✅ Create Controllers layer (Manual - 120 min)
11. ✅ Organize Services (Manual - 30 min)
12. ✅ Create Routes layer (Manual - 60 min)
13. ✅ Organize Middleware (Manual - 30 min)
14. ✅ Update Vite config (Manual - 15 min)
15. ✅ Update TypeScript configs (Manual - 15 min)
16. ✅ Update server entry point (Manual - 15 min)
17. ✅ Update client imports (Semi-automated - 30 min)
18. ✅ Update server imports (Semi-automated - 45 min)
19. ✅ Update package scripts (Manual - 15 min)
20. ✅ Update environment variables (Manual - 10 min)
21. ✅ Test client build (Manual - 15 min)
22. ✅ Test server build (Manual - 15 min)
23. ✅ Test runtime (Manual - 30 min)
24. ✅ Test integration (Manual - 30 min)
25. ✅ Fix issues (Manual - variable time)

---

## Difficulty Assessment

### Overall: **MODERATE to HIGH** (6-8 hours)

**Breakdown:**
- **Low Difficulty** (🟢): Steps 1-2, 6.1-6.2, 7.1 - ~1 hour
- **Medium Difficulty** (🟡): Steps 2.1-2.3, 4.1-4.3, 5.1-5.2, 7.2-7.3 - ~3 hours
- **High Difficulty** (🔴): Steps 3.1-3.4 - ~4 hours

**Risk Factors:**
- Large routes.ts file (2000+ lines) needs careful breakdown
- Many interdependencies between services
- Import path updates could miss some references
- Testing all features is time-consuming

**Mitigation:**
- Work in phases, test after each phase
- Use TypeScript compiler to catch import errors
- Keep old structure until new one is fully working
- Use git to track changes and revert if needed

---

## Manual vs Automated Steps

### Fully Manual Steps (Require Human Judgment):
- ✅ Steps 1-2: Planning and documentation
- ✅ Steps 3.1-3.4: Architecture refactoring (requires understanding business logic)
- ✅ Steps 4.1-4.3: Configuration (needs testing)
- ✅ Steps 7.2-7.3: Testing (requires validation)

### Semi-Automated Steps (Can use find/replace with review):
- ⚠️ Steps 5.1-5.2: Import path updates
- ⚠️ Step 2.1-2.2: File moves (can script, but need to verify)

### Fully Automated Steps (Can be scripted):
- ✅ Step 7.1: Build testing
- ✅ Step 6.1: Script generation (can template)

---

## Recommendations

### Before Starting:
1. **Create comprehensive backup** - Use git branch
2. **Document current API endpoints** - List all routes
3. **Identify critical paths** - Features that must work
4. **Set up testing environment** - Separate from production

### During Refactoring:
1. **Work incrementally** - One phase at a time
2. **Test frequently** - After each major change
3. **Keep old code** - Don't delete until new code works
4. **Update documentation** - As you go

### After Refactoring:
1. **Update README** - Document new structure
2. **Update deployment scripts** - If applicable
3. **Train team** - On new architecture
4. **Monitor** - Watch for issues in production

---

## Alternative: Gradual Migration

If the full refactor is too risky, consider a **gradual migration**:

1. **Phase 1**: Create separate package.json files, keep structure
2. **Phase 2**: Move to CLIENT/SERVER directories
3. **Phase 3**: Refactor routes.ts incrementally (one controller at a time)
4. **Phase 4**: Refactor storage.ts to models
5. **Phase 5**: Final cleanup and optimization

This approach takes longer but reduces risk.

---

## Estimated Timeline

- **Fast Track** (experienced developer): 6-8 hours
- **Normal Pace** (with breaks, testing): 10-12 hours
- **Gradual Migration** (safer approach): 2-3 days (spread over time)

---

## Success Criteria

✅ Both CLIENT and SERVER have separate package.json files
✅ Both can build independently
✅ Both can run independently
✅ All routes are organized in controllers
✅ All data access is in models
✅ All business logic is in services
✅ All tests pass
✅ All features work as before
✅ Code is more maintainable than before

---

## Questions to Consider

1. **Workspace vs Separate Repos?**
   - Current plan: Keep as workspace (shared/ accessible)
   - Alternative: Separate repos (more isolation, more complexity)

2. **Keep shared/ at root?**
   - Yes, recommended for type sharing

3. **Deployment strategy?**
   - Need to update deployment scripts
   - May need separate build processes

4. **CI/CD updates?**
   - May need separate build steps
   - May need separate test commands

---

## Next Steps

1. Review this plan with team
2. Decide on timeline and approach
3. Create backup branch
4. Begin Phase 1
5. Test after each phase
6. Document as you go

---

**Last Updated**: Planning Phase
**Status**: Ready for Review

