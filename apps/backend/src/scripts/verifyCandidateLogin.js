// Script to verify and fix candidate login
const database = require('../database/connection');
const bcrypt = require('bcrypt');

async function verifyCandidateLogin() {
  try {
    console.log('🔌 Connecting to database...');
    await database.connect();
    console.log('✅ Connected');

    const email = 'candidate.demo@FWCinfotech.com';
    const password = 'candidate123';

    // Find candidate
    const candidate = await database.findOne('candidates', { email: email.toLowerCase().trim() });
    
    if (!candidate) {
      console.log('❌ Candidate not found! Creating...');
      const hashedPassword = await bcrypt.hash(password, 12);
      const newCandidate = {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: 'Demo',
        lastName: 'Candidate',
        phone: '+1234567890',
        status: 'ACTIVE',
        profileComplete: false,
        resumeUploaded: false,
        invitedBy: 'SELF_REGISTERED',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await database.insertOne('candidates', newCandidate);
      console.log('✅ Candidate created!');
      return;
    }

    console.log('✅ Candidate found:');
    console.log(`   Email: ${candidate.email}`);
    console.log(`   Status: ${candidate.status}`);
    console.log(`   InvitedBy: ${candidate.invitedBy}`);
    console.log(`   Has password: ${!!candidate.password}`);

    // Test password
    if (candidate.password) {
      const isValid = await bcrypt.compare(password, candidate.password);
      console.log(`   Password valid: ${isValid}`);
      
      if (!isValid) {
        console.log('⚠️  Password mismatch! Updating password...');
        const hashedPassword = await bcrypt.hash(password, 12);
        await database.updateOne(
          'candidates',
          { _id: candidate._id },
          {
            $set: {
              password: hashedPassword,
              invitedBy: 'SELF_REGISTERED',
              status: 'ACTIVE',
              updatedAt: new Date()
            }
          }
        );
        console.log('✅ Password updated!');
        
        // Verify again
        const updatedCandidate = await database.findOne('candidates', { _id: candidate._id });
        const isValidAfter = await bcrypt.compare(password, updatedCandidate.password);
        console.log(`   Password valid after update: ${isValidAfter}`);
      }
    } else {
      console.log('⚠️  No password set! Setting password...');
      const hashedPassword = await bcrypt.hash(password, 12);
      await database.updateOne(
        'candidates',
        { _id: candidate._id },
        {
          $set: {
            password: hashedPassword,
            invitedBy: 'SELF_REGISTERED',
            status: 'ACTIVE',
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ Password set!');
    }

    // Final verification
    const finalCandidate = await database.findOne('candidates', { _id: candidate._id });
    const finalCheck = await bcrypt.compare(password, finalCandidate.password);
    
    console.log('\n📋 Final Status:');
    console.log(`   Email: ${finalCandidate.email}`);
    console.log(`   Status: ${finalCandidate.status}`);
    console.log(`   InvitedBy: ${finalCandidate.invitedBy}`);
    console.log(`   Password valid: ${finalCheck}`);
    
    if (finalCheck && finalCandidate.status === 'ACTIVE') {
      console.log('\n✅ Candidate login should work now!');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    } else {
      console.log('\n❌ Issues found:');
      if (!finalCheck) console.log('   - Password verification failed');
      if (finalCandidate.status !== 'ACTIVE') console.log(`   - Status is ${finalCandidate.status}, should be ACTIVE`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyCandidateLogin();

