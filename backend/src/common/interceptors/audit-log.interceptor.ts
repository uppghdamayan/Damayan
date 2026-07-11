import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  private resolveAudit(method: string, path: string): { action: AuditAction; tableName: string } | null {
    if (method === 'GET') return null;

    // Accounts
    if (path === '/accounts' && method === 'POST') return { action: 'CREATE', tableName: 'users' };
    if (path.match(/^\/accounts\/[^/]+\/reset-password$/) && method === 'POST') return { action: 'UPDATE', tableName: 'users' };
    if (path.match(/^\/accounts\/[^/]+$/) && method === 'PATCH') return { action: 'UPDATE', tableName: 'users' };
    if (path.match(/^\/accounts\/[^/]+$/) && method === 'DELETE') return { action: 'DELETE', tableName: 'users' };

    // Patients
    if (path === '/patients' && method === 'POST') return { action: 'CREATE', tableName: 'patients' };
    if (path.match(/^\/patients\/[^/]+\/deactivate$/) && method === 'PATCH') return { action: 'UPDATE', tableName: 'patients' };
    if (path.match(/^\/patients\/[^/]+\/reactivate$/) && method === 'PATCH') return { action: 'UPDATE', tableName: 'patients' };
    if (path.match(/^\/patients\/[^/]+\/documents\/generate$/) && method === 'POST') return { action: 'GENERATE', tableName: 'documents' };
    if (path.match(/^\/patients\/[^/]+$/) && method === 'PATCH') return { action: 'UPDATE', tableName: 'patients' };

    // Vitals
    if (path.match(/^\/patients\/[^/]+\/vitals$/) && method === 'POST') return { action: 'CREATE', tableName: 'vitals' };
    if (path.match(/^\/patients\/[^/]+\/vitals\/[^/]+$/) && method === 'PATCH') return { action: 'UPDATE', tableName: 'vitals' };

    // Visits
    if (path.match(/^\/patients\/[^/]+\/visits$/) && method === 'POST') return { action: 'CREATE', tableName: 'visits' };
    if (path.match(/^\/patients\/[^/]+\/visits\/[^/]+$/) && method === 'PATCH') return { action: 'UPDATE', tableName: 'visits' };

    // Initial Notes
    if (path.match(/^\/patients\/[^/]+\/initial-note\/create-and-publish$/) && method === 'POST') return { action: 'CREATE', tableName: 'initial_notes' };
    if (path.match(/^\/patients\/[^/]+\/initial-note\/[^/]+\/publish$/) && method === 'POST') return { action: 'UPDATE', tableName: 'initial_notes' };
    if (path.match(/^\/patients\/[^/]+\/initial-note\/[^/]+$/) && method === 'DELETE') return { action: 'DELETE', tableName: 'initial_notes' };

    // Progress Notes
    if (path.match(/^\/patients\/[^/]+\/progress-notes\/create-and-publish$/) && method === 'POST') return { action: 'CREATE', tableName: 'progress_notes' };
    if (path.match(/^\/patients\/[^/]+\/progress-notes\/[^/]+\/publish$/) && method === 'POST') return { action: 'UPDATE', tableName: 'progress_notes' };
    if (path.match(/^\/patients\/[^/]+\/progress-notes\/drafts$/) && method === 'DELETE') return { action: 'DELETE', tableName: 'progress_notes' };
    if (path.match(/^\/patients\/[^/]+\/progress-notes\/[^/]+$/) && method === 'DELETE') return { action: 'DELETE', tableName: 'progress_notes' };

    // Problems
    if (path.match(/^\/patients\/[^/]+\/problems$/) && method === 'POST') return { action: 'CREATE', tableName: 'problems' };
    if (path.match(/^\/patients\/[^/]+\/problems\/reorder$/) && method === 'POST') return { action: 'UPDATE', tableName: 'problems' };
    if (path.match(/^\/patients\/[^/]+\/problems\/[^/]+$/) && method === 'PATCH') return { action: 'UPDATE', tableName: 'problems' };
    if (path.match(/^\/patients\/[^/]+\/problems\/[^/]+$/) && method === 'DELETE') return { action: 'DELETE', tableName: 'problems' };

    // Medications
    if (path.match(/^\/patients\/[^/]+\/medications$/) && method === 'POST') return { action: 'CREATE', tableName: 'medications' };
    if (path.match(/^\/patients\/[^/]+\/medications\/reorder$/) && method === 'POST') return { action: 'UPDATE', tableName: 'medications' };
    if (path.match(/^\/patients\/[^/]+\/medications\/[^/]+$/) && method === 'PATCH') return { action: 'UPDATE', tableName: 'medications' };
    if (path.match(/^\/patients\/[^/]+\/medications\/[^/]+$/) && method === 'DELETE') return { action: 'DELETE', tableName: 'medications' };

    // Attachments
    if (path === '/attachments/upload' && method === 'POST') return { action: 'CREATE', tableName: 'attachments' };
    if (path.match(/^\/attachments\/[^/]+$/) && method === 'DELETE') return { action: 'DELETE', tableName: 'attachments' };

    return null;
  }

  /**
   * Extracts a safe subset of the response record to enrich the `changes` field.
   * This gives the frontend access to the record's name/title/status without
   * storing the entire response (which can be very large).
   */
  private extractRecordContext(responseBody: any): Record<string, unknown> {
    if (!responseBody || typeof responseBody !== 'object') return {};

    const ctx: Record<string, unknown> = {};
    // Identification fields — used to build human-readable descriptions
    if (responseBody.title != null) ctx.title = responseBody.title;
    if (responseBody.name != null) ctx.name = responseBody.name;
    if (responseBody.firstName != null) ctx.firstName = responseBody.firstName;
    if (responseBody.lastName != null) ctx.lastName = responseBody.lastName;
    if (responseBody.status != null) ctx.status = responseBody.status;
    if (responseBody.isActive != null) ctx.isActive = responseBody.isActive;
    // Patient nested object
    if (responseBody.patient?.firstName != null) ctx.firstName = responseBody.patient.firstName;
    if (responseBody.patient?.lastName != null) ctx.lastName = responseBody.patient.lastName;
    // User nested object (accounts endpoint returns { user: {...} })
    if (responseBody.user?.firstName != null) ctx.firstName = responseBody.user.firstName;
    if (responseBody.user?.lastName != null) ctx.lastName = responseBody.user.lastName;
    return ctx;
  }

  /**
   * Returns true if the path corresponds to a publish-specific action
   * (either a dedicated /publish endpoint or a create-and-publish shortcut).
   */
  private isPublishAction(path: string, method: string): boolean {
    if (path.match(/\/publish$/) && method === 'POST') return true;
    if (path.match(/\/create-and-publish$/) && method === 'POST') return true;
    return false;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user, ip } = req;
    const path = url.split('?')[0];

    return next.handle().pipe(
      tap((responseBody) => {
        const resolved = this.resolveAudit(method, path);
        if (!resolved || !user?.id) return;

        const recordId = responseBody?.id ?? responseBody?.user?.id;
        
        const patientIdMatch = path.match(/^\/patients\/([^/]+)/);
        const patientId = responseBody?.patientId ?? responseBody?.patient?.id ?? (patientIdMatch ? patientIdMatch[1] : undefined);

        // Merge: request body fields (what the caller sent) + record context
        // (name/title/status from the saved record) + optional publish flag.
        const recordCtx = this.extractRecordContext(responseBody);
        const changes: Record<string, unknown> = {
          ...recordCtx, // response-enriched fields (status, name, title, etc.)
          _requestBody: req.body, // original request payload for field-diff
        };

        // Tag publish-specific routes so the description can distinguish them
        if (this.isPublishAction(path, method)) {
          changes._isPublish = true;
        }

        // Tag reorder routes
        if (path.match(/\/reorder$/) && method === 'POST') {
          changes._isReorder = true;
        }

        // Tag bulk draft delete routes and skip if none deleted
        if (path.match(/\/drafts$/) && method === 'DELETE') {
          if (responseBody?.count === 0) return;
          changes._isDraftsDelete = true;
          changes.count = responseBody?.count;
        }

        this.auditLogsService.create({
          userId: user.id,
          userRole: user.role,
          action: resolved.action,
          tableName: resolved.tableName,
          recordId: recordId || 'unknown',
          patientId: patientId || undefined,
          changes,
          ipAddress: ip,
        });
      }),
    );
  }
}
