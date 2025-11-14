// Script to create/update demo candidate for login
const database = require('../database/connection');
const bcrypt = require('bcrypt');

async function createDemoCandidate() {
  try {
    console.log('🔌 Connecting to database...');
    await database.connect();
    console.log('✅ Connected');

    const email = 'candidate.demo@FWCinfotech.com';
    const password = 'candidate123';
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if candidate exists
    const existingCandidate = await database.findOne('candidates', { email });

    const candidateData = {
      email,
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Candidate',
      phone: '+1234567890',
      status: 'ACTIVE',
      profileComplete: false,
      resumeUploaded: false,
      invitedBy: 'SELF_REGISTERED', // Allow login without invitation
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (existingCandidate) {
      // Update existing candidate
      await database.updateOne(
        'candidates',
        { _id: existingCandidate._id },
        {
          $set: {
            ...candidateData,
            password: hashedPassword, // Update password
            invitedBy: 'SELF_REGISTERED' // Ensure it's self-registered
          }
        }
      );
      console.log(`♻️  Updated candidate: ${email}`);
    } else {
      // Create new candidate
      await database.insertOne('candidates', candidateData);
      console.log(`✅ Created candidate: ${email}`);
    }

    console.log('\n✅ Demo candidate ready!');
    console.log('📋 Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('\n🎉 Candidate can now login without invitation!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating demo candidate:', error);
    process.exit(1);
  }
}

createDemoCandidate();

