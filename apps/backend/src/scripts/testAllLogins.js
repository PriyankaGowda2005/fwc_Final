// Test all login endpoints and create demo users if needed
const database = require('../database/connection');
const bcrypt = require('bcrypt');

async function testAllLogins() {
  try {
    console.log('🔌 Connecting to database...');
    await database.connect();
    console.log('✅ Connected\n');

    // Test credentials - matching frontend demo credentials
    const testUsers = [
      { email: 'admin@FWCinfotech.com', password: 'admin123', role: 'ADMIN', firstName: 'Admin', lastName: 'User' },
      { email: 'hr@FWCinfotech.com', password: 'HR@2024!', role: 'HR', firstName: 'HR', lastName: 'Manager' },
      { email: 'manager@FWCinfotech.com', password: 'manager123', role: 'MANAGER', firstName: 'Manager', lastName: 'User' },
      { email: 'employee@FWCinfotech.com', password: 'employee123', role: 'EMPLOYEE', firstName: 'John', lastName: 'Doe' }
    ];

    const testCandidate = {
      email: 'candidate.demo@FWCinfotech.com',
      password: 'candidate123',
      firstName: 'Demo',
      lastName: 'Candidate'
    };

    console.log('📋 Testing User Logins (ADMIN, HR, MANAGER, EMPLOYEE)...\n');

    // Test and create users
    for (const userData of testUsers) {
      const normalizedEmail = userData.email.toLowerCase().trim();
      
      // Find user by email
      let user = await database.findOne('users', { email: normalizedEmail });
      
      // If not found by email, try case-insensitive search
      if (!user) {
        const allUsers = await database.find('users', {});
        user = allUsers.find(u => u.email && u.email.toLowerCase().trim() === normalizedEmail);
      }
      
      if (!user) {
        console.log(`⚠️  User not found: ${normalizedEmail} - Creating...`);
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        
        // Generate unique username
        let username = normalizedEmail.split('@')[0];
        let usernameExists = await database.findOne('users', { username });
        let counter = 1;
        while (usernameExists) {
          username = `${normalizedEmail.split('@')[0]}${counter}`;
          usernameExists = await database.findOne('users', { username });
          counter++;
        }
        
        const newUser = {
          email: normalizedEmail,
          username: username,
          password: hashedPassword,
          role: userData.role,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        try {
          const userResult = await database.insertOne('users', newUser);
          user = { ...newUser, _id: userResult.insertedId };
          
          // Create employee record
          const employeeData = {
            userId: userResult.insertedId,
            firstName: userData.firstName,
            lastName: userData.lastName,
            position: userData.role === 'ADMIN' ? 'System Administrator' : 
                     userData.role === 'HR' ? 'HR Manager' :
                     userData.role === 'MANAGER' ? 'Team Manager' : 'Software Developer',
            department: 'Information Technology',
            hireDate: new Date(),
            isActive: true,
            isOnProbation: false,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await database.insertOne('employees', employeeData);
          console.log(`✅ Created user: ${normalizedEmail}`);
        } catch (error) {
          if (error.code === 11000) {
            // Duplicate key - user might exist with different email case
            console.log(`⚠️  Username conflict, trying to find existing user...`);
            user = await database.findOne('users', { username });
            if (user) {
              console.log(`✅ Found existing user with username: ${username}`);
            }
          } else {
            throw error;
          }
        }
      } else {
        console.log(`✅ User exists: ${normalizedEmail}`);
      }

      // Test password
      if (user.password) {
        const isValid = await bcrypt.compare(userData.password, user.password);
        console.log(`   Password valid: ${isValid ? '✅' : '❌'}`);
        
        if (!isValid) {
          console.log(`   ⚠️  Password mismatch! Updating...`);
          const hashedPassword = await bcrypt.hash(userData.password, 12);
          await database.updateOne(
            'users',
            { _id: user._id },
            {
              $set: {
                password: hashedPassword,
                isActive: true,
                updatedAt: new Date()
              }
            }
          );
          console.log(`   ✅ Password updated!`);
        }
      } else {
        console.log(`   ⚠️  No password! Setting...`);
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        await database.updateOne(
          'users',
          { _id: user._id },
          {
            $set: {
              password: hashedPassword,
              isActive: true,
              updatedAt: new Date()
            }
          }
        );
        console.log(`   ✅ Password set!`);
      }

      // Ensure employee record exists
      const existingEmployee = await database.findOne('employees', { userId: user._id });
      if (!existingEmployee) {
        console.log(`   ⚠️  No employee record found - Creating...`);
        const employeeData = {
          userId: user._id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          position: userData.role === 'ADMIN' ? 'System Administrator' : 
                   userData.role === 'HR' ? 'HR Manager' :
                   userData.role === 'MANAGER' ? 'Team Manager' : 'Software Developer',
          department: 'Information Technology',
          hireDate: new Date(),
          isActive: true,
          isOnProbation: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await database.insertOne('employees', employeeData);
        console.log(`   ✅ Employee record created`);
      } else {
        console.log(`   ✅ Employee record exists`);
      }

      // Verify final state
      const finalUser = await database.findOne('users', { _id: user._id });
      const finalCheck = await bcrypt.compare(userData.password, finalUser.password);
      const isActive = finalUser.isActive !== false;
      
      console.log(`   Status: ${isActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);
      console.log(`   Final password check: ${finalCheck ? '✅' : '❌'}\n`);
    }

    console.log('📋 Testing Candidate Login...\n');
    
    // Test candidate
    const normalizedCandidateEmail = testCandidate.email.toLowerCase().trim();
    let candidate = await database.findOne('candidates', { email: normalizedCandidateEmail });
    
    if (!candidate) {
      console.log(`⚠️  Candidate not found: ${normalizedCandidateEmail} - Creating...`);
      const hashedPassword = await bcrypt.hash(testCandidate.password, 12);
      
      const newCandidate = {
        email: normalizedCandidateEmail,
        password: hashedPassword,
        firstName: testCandidate.firstName,
        lastName: testCandidate.lastName,
        phone: '+1234567890',
        status: 'ACTIVE',
        profileComplete: false,
        resumeUploaded: false,
        invitedBy: 'SELF_REGISTERED',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await database.insertOne('candidates', newCandidate);
      candidate = { ...newCandidate, _id: newCandidate._id };
      console.log(`✅ Created candidate: ${normalizedCandidateEmail}`);
    } else {
      console.log(`✅ Candidate exists: ${normalizedCandidateEmail}`);
    }

    // Test password
    if (candidate.password) {
      const isValid = await bcrypt.compare(testCandidate.password, candidate.password);
      console.log(`   Password valid: ${isValid ? '✅' : '❌'}`);
      
      if (!isValid) {
        console.log(`   ⚠️  Password mismatch! Updating...`);
        const hashedPassword = await bcrypt.hash(testCandidate.password, 12);
        await database.updateOne(
          'candidates',
          { _id: candidate._id },
          {
            $set: {
              password: hashedPassword,
              status: 'ACTIVE',
              invitedBy: 'SELF_REGISTERED',
              updatedAt: new Date()
            }
          }
        );
        console.log(`   ✅ Password updated!`);
      }
    } else {
      console.log(`   ⚠️  No password! Setting...`);
      const hashedPassword = await bcrypt.hash(testCandidate.password, 12);
      await database.updateOne(
        'candidates',
        { _id: candidate._id },
        {
          $set: {
            password: hashedPassword,
            status: 'ACTIVE',
            invitedBy: 'SELF_REGISTERED',
            updatedAt: new Date()
          }
        }
      );
      console.log(`   ✅ Password set!`);
    }

    // Verify final state
    const finalCandidate = await database.findOne('candidates', { _id: candidate._id });
    const finalCheck = await bcrypt.compare(testCandidate.password, finalCandidate.password);
    const isActive = finalCandidate.status === 'ACTIVE';
    
    console.log(`   Status: ${isActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    console.log(`   Final password check: ${finalCheck ? '✅' : '❌'}\n`);

    console.log('📋 Summary:\n');
    console.log('✅ All users and candidates are ready for login!\n');
    console.log('📋 Login Credentials:\n');
    console.log('ADMIN:');
    console.log('   Email: admin@FWCinfotech.com');
    console.log('   Password: admin123\n');
    console.log('HR:');
    console.log('   Email: hr@FWCinfotech.com');
    console.log('   Password: HR@2024!\n');
    console.log('MANAGER:');
    console.log('   Email: manager@FWCinfotech.com');
    console.log('   Password: manager123\n');
    console.log('EMPLOYEE:');
    console.log('   Email: employee@FWCinfotech.com');
    console.log('   Password: employee123\n');
    console.log('CANDIDATE:');
    console.log('   Email: candidate.demo@FWCinfotech.com');
    console.log('   Password: candidate123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAllLogins();

