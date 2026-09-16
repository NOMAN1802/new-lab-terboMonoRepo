import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../User/user.constant';
import { TestCategoryControllers } from './test-category.controller';
import { TestCategoryValidations } from './test-category.validation';

const router = express.Router();

// The catalogue is admin-maintained; receptionists read it to book tests.
router.post(
  '/',
  auth(USER_ROLE.admin),
  validateRequest(TestCategoryValidations.createTestCategoryValidationSchema),
  TestCategoryControllers.createTestCategory
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  TestCategoryControllers.getTestCategories
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  TestCategoryControllers.getTestCategory
);

router.patch(
  '/:id',
  auth(USER_ROLE.admin),
  validateRequest(TestCategoryValidations.updateTestCategoryValidationSchema),
  TestCategoryControllers.updateTestCategory
);

router.delete(
  '/:id',
  auth(USER_ROLE.admin),
  TestCategoryControllers.deleteTestCategory
);

export const testCategoryRoutes = router;
