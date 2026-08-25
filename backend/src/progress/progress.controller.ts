import { Controller, Param, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ProgressService } from './progress.service';
import { ProgressEvent } from '../export/export.types';

@Controller('api/progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Sse(':jobId')
  getProgress(@Param('jobId') jobId: string): Observable<MessageEvent> {
    return this.progressService.getStream(jobId).pipe(
      map(
        (event: ProgressEvent): MessageEvent => ({
          data: event,
        }),
      ),
    );
  }
}
