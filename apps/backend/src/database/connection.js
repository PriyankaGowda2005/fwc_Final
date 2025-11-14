const { MongoClient } = require('mongodb');

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.lastPingTime = 0;
    this.pingInterval = 30000; // Only ping every 30 seconds
  }

  async connect(retries = 5, delay = 3000) {
    // If already connected, return the existing connection
    if (this.isConnected && this.db && this.client) {
      try {
        // Verify connection is still alive
        await this.client.db('admin').admin().ping();
        return this.db;
      } catch (error) {
        // Connection is dead, reset and reconnect
        console.warn('⚠️  Existing connection is dead, reconnecting...');
        this.isConnected = false;
        this.db = null;
        if (this.client) {
          try {
            await this.client.close();
          } catch (closeError) {
            // Ignore close errors
          }
          this.client = null;
        }
      }
    }

    const uri = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/HRMS";
    
    // Normalize URI to use IPv4 if it's localhost
    const normalizedUri = uri.replace(/mongodb:\/\/localhost:/, 'mongodb://127.0.0.1:');
    
    // Detect if this is a MongoDB Atlas connection (has mongodb.net or mongodb+srv)
    const isAtlas = normalizedUri.includes('mongodb.net') || normalizedUri.includes('mongodb+srv://');
    const isLocal = normalizedUri.includes('127.0.0.1') || normalizedUri.includes('localhost');
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔄 Attempting to connect to MongoDB (attempt ${attempt}/${retries})...`);
        console.log(`   URI: ${normalizedUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials in logs
        console.log(`   Type: ${isAtlas ? 'MongoDB Atlas (Cloud)' : isLocal ? 'Local MongoDB' : 'Remote MongoDB'}`);
        
        // Configure connection options based on connection type
        const connectionOptions = {
          // Increased timeouts for better reliability
          serverSelectionTimeoutMS: 30000, // 30 seconds (increased from 10s)
          connectTimeoutMS: 30000, // 30 seconds (increased from 10s)
          socketTimeoutMS: 60000, // 60 seconds (increased from 45s)
          
          // Connection pool settings
          maxPoolSize: 10, // Maximum number of connections in the pool
          minPoolSize: 2, // Minimum number of connections in the pool
          
          // Retry settings
          retryWrites: true,
          retryReads: true,
          
          // Heartbeat to keep connection alive
          heartbeatFrequencyMS: 10000, // Send heartbeat every 10 seconds
          
          // Direct connection for local MongoDB (faster)
          directConnection: isLocal,
        };
        
        // SSL/TLS configuration for Atlas
        if (isAtlas) {
          connectionOptions.tls = true;
          connectionOptions.tlsAllowInvalidCertificates = false;
          connectionOptions.tlsAllowInvalidHostnames = false;
        } else {
          // For local MongoDB, disable SSL
          connectionOptions.tls = false;
        }
        
        this.client = new MongoClient(normalizedUri, connectionOptions);

        // Connect with timeout handling
        await Promise.race([
          this.client.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
          )
        ]);
        
        // Test the connection
        await this.client.db('admin').admin().ping();
        
        // Extract database name from URI or use default
        let dbName = 'HRMS'; // Default
        try {
          const uriParts = normalizedUri.split('/');
          if (uriParts.length > 3) {
            const dbPart = uriParts[uriParts.length - 1].split('?')[0];
            if (dbPart && dbPart.trim() !== '') {
              dbName = dbPart.trim();
            }
          }
        } catch (error) {
          console.warn('⚠️  Could not extract database name from URI, using default: HRMS');
        }
        this.db = this.client.db(dbName);
        this.isConnected = true;
        
        console.log('✅ Connected to MongoDB successfully');
        console.log(`📊 Database: ${dbName}`);
        
        return this.db;
      } catch (error) {
        console.warn(`⚠️  MongoDB connection attempt ${attempt} failed:`, error.message);
          
        if (this.client) {
          try {
            await this.client.close();
          } catch (closeError) {
            // Ignore close errors
          }
          this.client = null;
        }
        
        if (attempt === retries) {
          console.error('❌ MongoDB connection failed after all retries');
          console.error('💡 Make sure MongoDB is running:');
          console.error('   - Windows: net start MongoDB');
          console.error('   - Or install MongoDB: https://www.mongodb.com/try/download/community');
          console.error('   - Or use MongoDB Atlas: https://www.mongodb.com/cloud/atlas');
          console.error('   - Check DATABASE_URL in .env file');
          console.error('⚠️  Server will start without database connection. Some features may not work.');
          this.isConnected = false;
          return null;
        }
        
        // Wait before retrying with exponential backoff
        if (attempt < retries) {
          const backoffDelay = delay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Retrying in ${backoffDelay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }
    
    return null;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  getCollection(name) {
    if (!this.isConnected || !this.db) {
      // Try to reconnect if not connected
      console.warn('⚠️  Database not connected. Attempting to reconnect...');
      // Don't throw immediately - try to reconnect in the background
      // But still throw to prevent silent failures
      throw new Error('Database not connected. Please ensure MongoDB is running and call connect() first.');
    }
    return this.db.collection(name);
  }


  // Helper method to ensure connection before operations
  async _ensureConnection() {
    if (!this.isConnected || !this.db || !this.client) {
      console.log('🔄 Database not connected. Attempting to reconnect...');
      try {
        await this.connect(3, 2000); // Quick reconnect with fewer retries
        if (!this.isConnected) {
          throw new Error('Failed to connect to database. Please ensure MongoDB is running.');
        }
      } catch (error) {
        console.error('❌ Failed to reconnect to database:', error.message);
        // Don't throw immediately - log and try to continue
        // This prevents cascading failures
        console.warn('⚠️  Operation may fail due to database connection issue');
        throw new Error('Database not connected. Please ensure MongoDB is running and call connect() first.');
      }
    } else {
      // Verify connection is still alive with a quick ping (but not too frequently)
      const now = Date.now();
      if (now - this.lastPingTime > this.pingInterval) {
        try {
          await this.client.db('admin').admin().ping();
          this.lastPingTime = now;
        } catch (pingError) {
          console.warn('⚠️  Connection ping failed, reconnecting...');
          this.isConnected = false;
          this.lastPingTime = 0;
          await this.connect(2, 1000); // Quick reconnect
        }
      }
    }
  }

  // Helper method to wrap database operations with timeout
  async _withTimeout(operation, timeoutMs = 10000) {
    return Promise.race([
      operation(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Database operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  // Helper methods for common operations
  async findOne(collection, query) {
    await this._ensureConnection();
    return await this._withTimeout(
      () => this.getCollection(collection).findOne(query),
      10000 // 10 second timeout
    );
  }

  async find(collection, query = {}, options = {}) {
    await this._ensureConnection();
    return await this._withTimeout(
      () => this.getCollection(collection).find(query, options).toArray(),
      15000 // 15 second timeout for queries that might return many results
    );
  }

  async insertOne(collection, document) {
    await this._ensureConnection();
    return await this.getCollection(collection).insertOne(document);
  }

  async insertMany(collection, documents) {
    await this._ensureConnection();
    return await this.getCollection(collection).insertMany(documents);
  }

  async updateOne(collection, filter, update) {
    await this._ensureConnection();
    return await this.getCollection(collection).updateOne(filter, update);
  }

  async updateMany(collection, filter, update) {
    await this._ensureConnection();
    return await this.getCollection(collection).updateMany(filter, update);
  }

  async deleteOne(collection, filter) {
    await this._ensureConnection();
    return await this.getCollection(collection).deleteOne(filter);
  }

  async deleteMany(collection, filter) {
    await this._ensureConnection();
    return await this.getCollection(collection).deleteMany(filter);
  }

  async count(collection, query = {}) {
    await this._ensureConnection();
    return await this.getCollection(collection).countDocuments(query);
  }

  // Create indexes for better performance
  async createIndexes() {
    if (!this.isConnected || !this.db) {
      console.warn('⚠️  Skipping index creation: Database not connected');
      return;
    }
    
    try {
      console.log('📊 Creating database indexes...');
      
      // Users collection indexes
      await this.createIndexIfNotExists('users', { email: 1 }, { unique: true });
      await this.createIndexIfNotExists('users', { username: 1 }, { unique: true });
      await this.createIndexIfNotExists('users', { role: 1 });

      // Employees collection indexes
      await this.createIndexIfNotExists('employees', { userId: 1 }, { unique: true });
      await this.createIndexIfNotExists('employees', { employeeId: 1 }, { unique: true, sparse: true });
      await this.createIndexIfNotExists('employees', { departmentId: 1 });
      await this.createIndexIfNotExists('employees', { isActive: 1 });

      // Attendance collection indexes
      await this.createIndexIfNotExists('attendance', { employeeId: 1, date: 1 }, { unique: true });
      await this.createIndexIfNotExists('attendance', { date: 1 });

      // Leave requests indexes
      await this.createIndexIfNotExists('leave_requests', { employeeId: 1 });
      await this.createIndexIfNotExists('leave_requests', { status: 1 });
      await this.createIndexIfNotExists('leave_requests', { startDate: 1, endDate: 1 });

      // Job postings indexes
      await this.createIndexIfNotExists('job_postings', { status: 1 });
      await this.createIndexIfNotExists('job_postings', { departmentId: 1 });
      await this.createIndexIfNotExists('job_postings', { postedAt: -1 });

      // Candidates indexes
      await this.createIndexIfNotExists('candidates', { email: 1 }, { unique: true });
      await this.createIndexIfNotExists('candidates', { status: 1 });
      await this.createIndexIfNotExists('candidates', { createdAt: -1 });

      // Candidate applications indexes
      await this.createIndexIfNotExists('candidate_applications', { candidateId: 1 });
      await this.createIndexIfNotExists('candidate_applications', { jobPostingId: 1 });
      await this.createIndexIfNotExists('candidate_applications', { status: 1 });
      await this.createIndexIfNotExists('candidate_applications', { appliedAt: -1 });

      // Interview sessions indexes
      await this.createIndexIfNotExists('interview_sessions', { candidateId: 1 });
      await this.createIndexIfNotExists('interview_sessions', { managerId: 1 });
      await this.createIndexIfNotExists('interview_sessions', { jobPostingId: 1 });
      await this.createIndexIfNotExists('interview_sessions', { status: 1 });
      await this.createIndexIfNotExists('interview_sessions', { scheduledAt: 1 });

      // Candidate resumes indexes
      await this.createIndexIfNotExists('candidate_resumes', { candidateId: 1 });
      await this.createIndexIfNotExists('candidate_resumes', { uploadedAt: -1 });

      // Job invitations indexes
      await this.createIndexIfNotExists('job_invitations', { candidateId: 1 });
      await this.createIndexIfNotExists('job_invitations', { jobPostingId: 1 });
      await this.createIndexIfNotExists('job_invitations', { status: 1 });
      await this.createIndexIfNotExists('job_invitations', { invitationDate: -1 });

      // Resume screenings indexes
      await this.createIndexIfNotExists('resume_screenings', { candidateId: 1 });
      await this.createIndexIfNotExists('resume_screenings', { jobPostingId: 1 });
      await this.createIndexIfNotExists('resume_screenings', { status: 1 });
      await this.createIndexIfNotExists('resume_screenings', { screeningDate: -1 });

      // Revoked tokens indexes
      await this.createIndexIfNotExists('revoked_tokens', { token: 1 }, { unique: true });
      await this.createIndexIfNotExists('revoked_tokens', { userId: 1 });
      await this.createIndexIfNotExists('revoked_tokens', { expiresAt: 1 }, { expireAfterSeconds: 0 });

      console.log('✅ Database indexes ready');
    } catch (error) {
      console.log('⚠️ Index creation completed with warnings (some indexes may already exist)');
    }
  }

  // Helper method to create index only if it doesn't exist
  async createIndexIfNotExists(collectionName, indexSpec, options = {}) {
    try {
      const collection = this.getCollection(collectionName);
      const indexes = await collection.listIndexes().toArray();
      
      // Check if index already exists
      const indexExists = indexes.some(index => 
        JSON.stringify(index.key) === JSON.stringify(indexSpec)
      );
      
      if (!indexExists) {
        await collection.createIndex(indexSpec, options);
        console.log(`✅ Created index on ${collectionName}:`, JSON.stringify(indexSpec));
      } else {
        console.log(`⏭️ Index already exists on ${collectionName}:`, JSON.stringify(indexSpec));
      }
    } catch (error) {
      // Ignore index creation errors (they might already exist)
      console.log(`⚠️ Index creation skipped for ${collectionName}:`, error.message);
    }
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;
