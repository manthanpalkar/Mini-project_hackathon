// Global test environment bootstrap for LOOP backend test suite
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-super-secret-key-32-chars-minimum-loop-platform!';
process.env.RESET_SECRET = process.env.RESET_SECRET || 'test-super-secret-key-32-chars-minimum-loop-platform!';
process.env.PORT = process.env.PORT || '5001';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test_db';
