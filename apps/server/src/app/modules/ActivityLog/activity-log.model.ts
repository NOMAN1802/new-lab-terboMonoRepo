import { Schema, model } from 'mongoose';
import { type TActivityLog } from './activity-log.interface';

const ActivityLogSchema = new Schema<TActivityLog>({
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, required: true },
  actorRole: { type: String, required: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId },
  entityLabel: { type: String },
  summary: { type: String, required: true },
  meta: { type: Schema.Types.Mixed },
  at: { type: Date, required: true, default: Date.now },
});

ActivityLogSchema.index({ at: -1 });
ActivityLogSchema.index({ actor: 1, at: -1 });
ActivityLogSchema.index({ action: 1, at: -1 });

// Deliberately no TTL: this is an audit trail, so entries are not expired
// automatically. Rows are small; prune manually if the 5GB host ever needs it.
export const ActivityLog = model<TActivityLog>('ActivityLog', ActivityLogSchema);
