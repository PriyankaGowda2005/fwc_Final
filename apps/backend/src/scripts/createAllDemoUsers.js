require('dotenv').config();
const bcrypt = require('bcrypt');
const database = require('../database/connection');

/**
 * Create all demo users for testing login with all roles
 * This ensures all roles shown on login page can successfully login
 */
async function createAllDemoUsers() {
  try {
    console.log('🌱 Creating all demo users for login testing...\n');
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    await database.connect();
    console.log('✅ Database connected\n');

    // Get or create departments first
    let hrDept = await database.findOne('departments', { name: 'Human Resources' });
    let itDept = await database.findOne('departments', { name: 'Information Technology' });
    
    if (!hrDept) {
      hrDept = await database.insertOne('departments', {
        name: 'Human Resources',
        description: 'HR Department',
        costCenter: 'HR001',
        budget: 500000,
        location: 'Main Office',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      hrDept = { _id: hrDept.insertedId, name: 'Human Resources' };
    }
    
    if (!itDept) {
      itDept = await database.insertOne('departments', {
        name: 'Information Technology',
        description: 'IT Department',
        costCenter: 'IT001',
        budget: 750000,
        location: 'Tech Hub',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      itDept = { _id: itDept.insertedId, name: 'Information Technology' };
    }

    // Define all demo users matching login page credentials
    const demoUsers = [
      {
        email: 'admin@fwcinfotech.com',
        username: 'admin',
        password: 'admin123',
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
        position: 'System Administrator',
        department: itDept.name,
        departmentId: itDept._id
      },
      {
        email: 'hr@fwcinfotech.com',
        username: 'hr_manager',
        password: 'HR@2024!',
        role: 'HR',
        firstName: 'HR',
        lastName: 'Manager',
        position: 'HR Manager',
        department: hrDept.name,
        departmentId: hrDept._id
      },
      {
        email: 'manager@fwcinfotech.com',
        username: 'manager',
        password: 'manager123',
        role: 'MANAGER',
        firstName: 'Manager',
        lastName: 'User',
        position: 'Team Manager',
        department: itDept.name,
        departmentId: itDept._id
      },
      {
        email: 'employee@fwcinfotech.com',
        username: 'employee',
        password: 'employee123',
        role: 'EMPLOYEE',
        firstName: 'John',
        lastName: 'Doe',
        position: 'Software Developer',
        department: itDept.name,
        departmentId: itDept._id
      },
      {
        email: 'candidate.demo@fwcinfotech.com',
        username: 'candidate_demo',
        password: 'candidate123',
        role: 'CANDIDATE',
        firstName: 'Demo',
        lastName: 'Candidate'
      }
    ];

    console.log('👥 Creating/updating demo users...\n');

    for (const userData of demoUsers) {
      const { email, username, password, role, firstName, lastName, position, department, departmentId } = userData;

      // Check if user already exists (by email or username)
      let existingUser = await database.findOne('users', { email });
      if (!existingUser) {
        existingUser = await database.findOne('users', { username });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      let userId;
      
      if (existingUser) {
        // Update existing user
        await database.updateOne('users', 
          { _id: existingUser._id },
          {
            $set: {
              email,
              username,
              password: hashedPassword,
              role,
              isActive: true,
              updatedAt: new Date()
            }
          }
        );
        userId = existingUser._id;
        console.log(`♻️  Updated user: ${email} (${role})`);
      } else {
        // Create new user - use upsert to avoid duplicate key errors
        try {
          const userResult = await database.insertOne('users', {
            email,
            username,
            password: hashedPassword,
            role,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          userId = userResult.insertedId;
          console.log(`➕ Created user: ${email} (${role})`);
        } catch (insertError) {
          // If insert fails due to duplicate, try to find and update
          if (insertError.code === 11000) {
            existingUser = await database.findOne('users', { 
              $or: [{ email }, { username }] 
            });
            if (existingUser) {
              await database.updateOne('users', 
                { _id: existingUser._id },
                {
                  $set: {
                    email,
                    username,
                    password: hashedPassword,
                    role,
                    isActive: true,
                    updatedAt: new Date()
                  }
                }
              );
              userId = existingUser._id;
              console.log(`♻️  Updated existing user: ${email} (${role})`);
            } else {
              throw insertError;
            }
          } else {
            throw insertError;
          }
        }
      }

      // Create/update employee record for non-candidate roles
      if (role !== 'CANDIDATE') {
        const existingEmployee = await database.findOne('employees', { userId });
        
        const employeeData = {
          userId,
          firstName,
          lastName,
          position,
          department: department || null,
          departmentId: departmentId || null,
          hireDate: new Date(),
          isActive: true,
          isOnProbation: role === 'EMPLOYEE',
          updatedAt: new Date()
        };

        if (existingEmployee) {
          await database.updateOne('employees',
            { _id: existingEmployee._id },
            { $set: employeeData }
          );
          console.log(`   ♻️  Updated employee record`);
        } else {
          employeeData.createdAt = new Date();
          await database.insertOne('employees', employeeData);
          console.log(`   ✅ Created employee record`);
        }
      } else {
        // Create/update candidate record (candidates need password for login)
        const existingCandidate = await database.findOne('candidates', { email });
        
        const candidateData = {
          email,
          password: hashedPassword, // Candidates need password for login
          firstName,
          lastName,
          phone: '+1234567890',
          status: 'ACTIVE',
          profileComplete: false,
          resumeUploaded: false,
          updatedAt: new Date()
        };

        if (existingCandidate) {
          await database.updateOne('candidates',
            { _id: existingCandidate._id },
            { $set: candidateData }
          );
          console.log(`   ♻️  Updated candidate record with password`);
        } else {
          candidateData.createdAt = new Date();
          await database.insertOne('candidates', candidateData);
          console.log(`   ✅ Created candidate record with password`);
        }
      }
    }

    console.log('\n✅ All demo users created/updated successfully!\n');
    console.log('📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:    admin@fwcinfotech.com / admin123');
    console.log('HR:       hr@fwcinfotech.com / HR@2024!');
    console.log('Manager:  manager@fwcinfotech.com / manager123');
    console.log('Employee: employee@fwcinfotech.com / employee123');
    console.log('Candidate: candidate.demo@fwcinfotech.com / candidate123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verify all users can be found
    console.log('🔍 Verifying all users exist...\n');
    for (const userData of demoUsers) {
      const user = await database.findOne('users', { email: userData.email });
      if (user) {
        console.log(`✅ ${userData.role}: ${userData.email} - EXISTS`);
      } else {
        console.log(`❌ ${userData.role}: ${userData.email} - MISSING`);
      }
    }

    console.log('\n🎉 Setup complete! All roles can now login.\n');

  } catch (error) {
    console.error('❌ Error creating demo users:', error);
    throw error;
  } finally {
    await database.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  createAllDemoUsers()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createAllDemoUsers };

