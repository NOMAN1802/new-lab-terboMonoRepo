import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import { ActivityLogControllers } from './activity-log.controller';

const router = express.Router();

// Audit data is Admin-only monitoring (proposal §4.2).
router.use(auth(USER_ROLE.admin));

router.get('/', ActivityLogControllers.getActivities);
router.get('/by-user', ActivityLogControllers.getActivityByUser);

export const activityLogRoutes = router;
