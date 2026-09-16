import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { USER_ROLE } from './user.constant';
import { UserValidation } from './user.validation';
import { UserControllers } from './user.controller';

const router = express.Router();

router.post(
  '/create-user',
  auth(USER_ROLE.admin),
  validateRequest(UserValidation.createUserValidationSchema),
  UserControllers.createUser
);

router.patch(
  '/update-user/:id',
  auth(USER_ROLE.admin),
  validateRequest(UserValidation.updateUserValidationSchema),
  UserControllers.updateUser
);

router.delete(
  '/delete-user/:id',
  auth(USER_ROLE.admin),
  UserControllers.deleteUser
);

router.get('/me', auth(), UserControllers.getCurrentUser);
router.patch(
  '/me',
  auth(),
  validateRequest(UserValidation.updateCurrentUserValidationSchema),
  UserControllers.updateCurrentUser
);

router.get('/:id', auth(USER_ROLE.admin), UserControllers.getUser);

router.get('/', auth(USER_ROLE.admin), UserControllers.getUsers);

export const userRoutes = router;
