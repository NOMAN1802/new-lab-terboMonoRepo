import config from '../../config';
import { User } from './user.model';
import { USER_ROLE } from './user.constant';

export const seedAdmin = async () => {
  try {
    const adminEmail = config.admin_email;
    const adminPassword = config.admin_password;
    const adminName = config.admin_name;
    const adminMobileNumber = config.admin_mobile_number;

    if (!adminEmail || !adminPassword || !adminName || !adminMobileNumber) {
      console.warn('⚠ Admin seed skipped: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_MOBILE_NUMBER must be set in .env');
      return;
    }

    const existingAdmin = await User.findOne({
      email: adminEmail,
      isDeleted: false,
    });

    if (existingAdmin) {
      console.warn('✓ Admin user already exists, skipping seed');
      return;
    }

    await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: USER_ROLE.admin,
      mobileNumber: adminMobileNumber,
      status: 'active',
      isDeleted: false,
    });

    console.warn('✓ Admin user seeded successfully');
  } catch (error) {
    console.error('Error seeding admin:', error);
    throw error;
  }
};
