 
import { Types } from 'mongoose';
import { QueryBuilder } from '../../builder/QueryBuilder';
import { dateRangeFilter, resolveDateRange } from '../../utils/dateRange';
import { User } from '../User/user.model';
import { type TActivityAction, type TActivityLog } from './activity-log.interface';
import { ActivityLog } from './activity-log.model';

type TRecordInput = {
  userId: string | Types.ObjectId;
  action: TActivityAction;
  entity: string;
  entityId?: Types.ObjectId | string;
  entityLabel?: string;
  summary: string;
  meta?: Record<string, unknown>;
};

/**
 * Writes one audit entry.
 *
 * Auditing must never break the thing it is auditing: a failure here is logged
 * and swallowed, so a payment still succeeds even if its log entry does not.
 * Callers can therefore `void recordActivity(...)` without a catch.
 */
export const recordActivity = async (input: TRecordInput): Promise<void> => {
  try {
    const actor = await User.findById(input.userId).select('name role');
    if (!actor) return;

    await ActivityLog.create({
      actor: actor._id,
      actorName: actor.name,
      actorRole: actor.role,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId
        ? new Types.ObjectId(String(input.entityId))
        : undefined,
      entityLabel: input.entityLabel,
      summary: input.summary,
      meta: input.meta,
      at: new Date(),
    });
  } catch (error) {
    console.error('[activity-log] failed to record', input.action, error);
  }
};

const getActivities = async (query: Record<string, unknown>) => {
  const range = resolveDateRange(query);

  const baseQuery = ActivityLog.find({
    ...dateRangeFilter('at', range),
  });

  const activityQuery = new QueryBuilder(baseQuery, query)
    .search(['summary', 'actorName', 'entityLabel'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [activities, total] = await Promise.all([
    activityQuery.modelQuery,
    activityQuery.countTotal(),
  ]);

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 20),
    },
    result: activities,
  };
};

/** Most recent entries, for the dashboard panel. */
const getRecentActivity = async (limit = 12): Promise<TActivityLog[]> =>
  ActivityLog.find().sort({ at: -1 }).limit(limit);

/** Who did how much, over a window — the "monitoring" half of §4.2. */
const getActivityByUser = async (query: Record<string, unknown>) => {
  const range = resolveDateRange(query);

  return ActivityLog.aggregate([
    { $match: { ...dateRangeFilter('at', range) } },
    {
      $group: {
        _id: '$actor',
        name: { $first: '$actorName' },
        role: { $first: '$actorRole' },
        events: { $sum: 1 },
        lastSeen: { $max: '$at' },
      },
    },
    { $sort: { events: -1 } },
  ]);
};

export const ActivityLogServices = {
  recordActivity,
  getActivities,
  getRecentActivity,
  getActivityByUser,
};
