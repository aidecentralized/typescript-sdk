import { generateClientTrackingId, InMemoryClientTrackingStore } from './clients.js';
import { OAuthClientInformationFull } from '../../shared/auth.js';
import { ClientActivity } from './types.js';

describe('generateClientTrackingId', () => {
  it('should generate stable IDs for the same client', () => {
    const client: OAuthClientInformationFull = {
      client_id: 'test-client',
      client_name: 'Test Client',
      software_id: 'test-software',
      software_version: '1.0.0',
      redirect_uris: ['https://example.com/callback']
    };
    
    const id1 = generateClientTrackingId(client);
    const id2 = generateClientTrackingId(client);
    
    expect(id1).toBe(id2);
    expect(id1.length).toBe(16);
  });
  
  it('should generate different IDs for different clients', () => {
    const client1: OAuthClientInformationFull = {
      client_id: 'test-client-1',
      client_name: 'Test Client 1',
      software_id: 'test-software',
      software_version: '1.0.0',
      redirect_uris: ['https://example.com/callback']
    };
    
    const client2: OAuthClientInformationFull = {
      client_id: 'test-client-2',
      client_name: 'Test Client 2',
      software_id: 'test-software',
      software_version: '1.0.0',
      redirect_uris: ['https://example.com/callback']
    };
    
    const id1 = generateClientTrackingId(client1);
    const id2 = generateClientTrackingId(client2);
    
    expect(id1).not.toBe(id2);
  });
  
  it('should use seed when provided', () => {
    const client: OAuthClientInformationFull = {
      client_id: 'test-client',
      client_name: 'Test Client',
      software_id: 'test-software',
      software_version: '1.0.0',
      redirect_uris: ['https://example.com/callback']
    };
    
    const id1 = generateClientTrackingId(client);
    const id2 = generateClientTrackingId(client, 'custom-seed');
    
    expect(id1).not.toBe(id2);
  });
});

describe('InMemoryClientTrackingStore', () => {
  let store: InMemoryClientTrackingStore;
  const clientId = 'test-client';
  const trackingId = 'test-tracking-id';
  
  beforeEach(() => {
    store = new InMemoryClientTrackingStore();
  });
  
  describe('recordActivity', () => {
    it('should store client activities', async () => {
      const activity: ClientActivity = {
        timestamp: Date.now(),
        type: 'test',
        method: 'test-method'
      };
      
      await store.recordActivity(clientId, trackingId, activity);
      
      const activities = await store.getActivities(trackingId);
      expect(activities).toHaveLength(1);
      expect(activities[0]).toEqual(activity);
    });
    
    it('should add timestamp if not provided', async () => {
      const activity = {
        type: 'test',
        method: 'test-method'
      } as ClientActivity;
      
      await store.recordActivity(clientId, trackingId, activity);
      
      const activities = await store.getActivities(trackingId);
      expect(activities[0].timestamp).toBeDefined();
      expect(typeof activities[0].timestamp).toBe('number');
    });
  });
  
  describe('getActivities', () => {
    beforeEach(async () => {
      // Add test activities
      await store.recordActivity(clientId, trackingId, {
        timestamp: Date.now() - 5000,
        type: 'type1',
        method: 'method1',
        status: 'success'
      });
      
      await store.recordActivity(clientId, trackingId, {
        timestamp: Date.now() - 3000,
        type: 'type2',
        method: 'method2',
        status: 'error',
        error: { code: 400, message: 'Bad request' }
      });
      
      await store.recordActivity(clientId, trackingId, {
        timestamp: Date.now() - 1000,
        type: 'type1',
        method: 'method3',
        status: 'success'
      });
    });
    
    it('should get all activities without options', async () => {
      const activities = await store.getActivities(trackingId);
      expect(activities).toHaveLength(3);
    });
    
    it('should filter by startTime', async () => {
      const startTime = Date.now() - 2000;
      const activities = await store.getActivities(trackingId, { startTime });
      expect(activities).toHaveLength(1);
      expect(activities[0].method).toBe('method3');
    });
    
    it('should filter by endTime', async () => {
      const endTime = Date.now() - 2000;
      const activities = await store.getActivities(trackingId, { endTime });
      expect(activities).toHaveLength(2);
      expect(activities.some(a => a.method === 'method3')).toBe(false);
    });
    
    it('should filter by type', async () => {
      const activities = await store.getActivities(trackingId, { types: ['type1'] });
      expect(activities).toHaveLength(2);
      expect(activities.every(a => a.type === 'type1')).toBe(true);
    });
    
    it('should apply limit', async () => {
      const activities = await store.getActivities(trackingId, { limit: 2 });
      expect(activities).toHaveLength(2);
    });
    
    it('should sort in ascending order', async () => {
      const activities = await store.getActivities(trackingId, { sort: 'asc' });
      expect(activities[0].method).toBe('method1');
      expect(activities[2].method).toBe('method3');
    });
    
    it('should sort in descending order', async () => {
      const activities = await store.getActivities(trackingId, { sort: 'desc' });
      expect(activities[0].method).toBe('method3');
      expect(activities[2].method).toBe('method1');
    });
  });
  
  describe('getActivityStats', () => {
    beforeEach(async () => {
      // Add test activities
      const now = Date.now();
      
      // 2 days ago
      await store.recordActivity(clientId, trackingId, {
        timestamp: now - 48 * 60 * 60 * 1000,
        type: 'type1',
        method: 'method1',
        status: 'success'
      });
      
      // 12 hours ago
      await store.recordActivity(clientId, trackingId, {
        timestamp: now - 12 * 60 * 60 * 1000,
        type: 'type2',
        method: 'method2',
        status: 'error',
        error: { code: 400, message: 'Bad request' }
      });
      
      // 1 hour ago
      await store.recordActivity(clientId, trackingId, {
        timestamp: now - 1 * 60 * 60 * 1000,
        type: 'type1',
        method: 'method3',
        status: 'success'
      });
    });
    
    it('should calculate stats for a client', async () => {
      const stats = await store.getActivityStats(trackingId);
      
      expect(stats.totalActivities).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.errorCount).toBe(1);
      expect(stats.typeBreakdown).toEqual({
        type1: 2,
        type2: 1
      });
      
      // Time stats
      const activities = await store.getActivities(trackingId);
      const timestamps = activities.map(a => a.timestamp);
      expect(stats.firstActivityTime).toBe(Math.min(...timestamps));
      expect(stats.lastActivityTime).toBe(Math.max(...timestamps));
      
      // Hourly rate - should be ~ 2/24 since there are 2 activities in the last 24 hours
      expect(stats.averageHourlyRate).toBeCloseTo(2/24, 1);
    });
    
    it('should return default stats for nonexistent tracking ID', async () => {
      const stats = await store.getActivityStats('nonexistent');
      
      expect(stats.totalActivities).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.typeBreakdown).toEqual({});
      expect(stats.firstActivityTime).toBe(0);
      expect(stats.lastActivityTime).toBe(0);
      expect(stats.averageHourlyRate).toBe(0);
    });
  });
});