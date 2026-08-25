import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { ProgressEvent } from '../export/export.types';

@Injectable()
export class ProgressService {
  private readonly streams = new Map<string, Subject<ProgressEvent>>();

  /**
   * Get or create an Observable stream for a given jobId.
   */
  getStream(jobId: string): Observable<ProgressEvent> {
    if (!this.streams.has(jobId)) {
      this.streams.set(jobId, new Subject<ProgressEvent>());
    }
    return this.streams.get(jobId)!.asObservable();
  }

  /**
   * Emit a progress event for a job.
   */
  emit(jobId: string, event: ProgressEvent): void {
    if (!this.streams.has(jobId)) {
      this.streams.set(jobId, new Subject<ProgressEvent>());
    }
    this.streams.get(jobId)!.next(event);
  }

  /**
   * Complete the stream for a job (export is fully done).
   */
  complete(jobId: string): void {
    const subject = this.streams.get(jobId);
    if (subject) {
      subject.complete();
      // Clean up after a short delay to let clients receive the final event
      setTimeout(() => {
        this.streams.delete(jobId);
      }, 30_000);
    }
  }

  /**
   * Error the stream for a job.
   */
  error(jobId: string, err: Error): void {
    const subject = this.streams.get(jobId);
    if (subject) {
      subject.error(err);
      this.streams.delete(jobId);
    }
  }
}
